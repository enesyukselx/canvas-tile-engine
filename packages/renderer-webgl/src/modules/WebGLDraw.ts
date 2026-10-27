import {
    CanvasTileEngineConfig,
    Circle,
    CoordinateTransformer,
    Coords,
    DEFAULT_VALUES,
    DrawHandle,
    ICamera,
    ImageItem,
    Line,
    PathItem,
    Rect,
    Text,
    resolveLineWidthPx,
    resolveBoxPx,
    resolveSizeWorld,
    isGradient,
    normalizeStops,
    gradientAxisPx,
    paintKey,
    resolveLineDashPx,
    overlayLineStyle,
    resolveCornerRadiusPx,
    flattenPathCommands,
    pathItemBounds,
    ARC_SEGMENT_LENGTH,
    type Subpath,
    roundedPolyline,
    roundedRing,
    resolveRadiusPx,
    resolveOrigin,
    computeOriginOffset,
    DrawTransform,
} from "@canvas-tile-engine/core";
import type {
    Paint,
    PaintBox,
    RendererClipOptions,
    LineStyle,
    LineDecorationStyle,
    PathDecorationStyle,
    RendererDrawOptions,
    RendererImageDrawOptions,
    ShapeDecorationStyle,
    TextDecorationStyle,
} from "@canvas-tile-engine/core";
import { appendDashedSegment } from "../utils/dash";
import { type DrawCallback, DrawContext, Layer } from "@canvas-tile-engine/renderer-shared/scene";
import {
    PaintedCuller,
    boxPaintBounds,
    boxPixelPadding,
    getViewportBounds,
    gridLineStep,
    intersectsBounds,
    linePaintBounds,
    pathPaintBounds,
    textPaintBounds,
} from "@canvas-tile-engine/renderer-shared/geometry";
import { CanvasTextBounds } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { GLRenderer } from "./gl/GLRenderer";
import { ImageInstance, LineInstance, ShapeInstance, type ShapeGradient } from "./gl/GLRenderer";
import { ColorParser, RGBA } from "../utils/color";

/**
 * Map a screen point into a shape instance's local frame: the unrotated,
 * center-origin space its corner offsets live in, which is where the shader
 * reads the gradient axis. `rotation` of 0 is a plain translation.
 */
function unrotate(point: Coords, cx: number, cy: number, rotation: number): Coords {
    const dx = point.x - cx;
    const dy = point.y - cy;
    if (rotation === 0) {
        return { x: dx, y: dy };
    }
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);
    return { x: dx * cos - dy * sin, y: dx * sin + dy * cos };
}

/** Fill color for a gradient with no stops: paints nothing, like Canvas2D. */
const TRANSPARENT: RGBA = [0, 0, 0, 0];
// Segment count used to approximate a stroked circle outline.
const CIRCLE_STROKE_SEGMENTS = 48;

/**
 * WebGL implementation of the engine draw API.
 *
 * Mirrors the Canvas2D `CanvasDraw` (culling, spatial indexing, origin handling,
 * rotation), but instead of issuing immediate Canvas2D calls it batches
 * consecutive compatible GPU primitives without reordering fills and strokes.
 * Text and raw draw functions are delegated to the 2D overlay context.
 * @internal
 */
/**
 * Drawing context passed to every layer callback.
 *
 * Primitives (rects, circles, images, lines) are issued through the batched
 * {@link GLRenderer} (`gl`), while text and user-supplied draw functions use the
 * stacked 2D overlay context (`ctx`), which mirrors the Canvas2D renderer API.
 * @internal
 */
export type WebGLDrawContext = DrawContext<CanvasRenderingContext2D> & { gl: GLRenderer };

export class WebGLDraw {
    /** Transform helpers handed to custom draw callbacks. */
    private drawTransform: DrawTransform = {
        worldToScreen: (x, y) => this.transformer.worldToScreen(x, y),
        screenToWorld: (x, y) => this.transformer.screenToWorld(x, y),
    };
    private colorParser = new ColorParser();
    private textBounds = new CanvasTextBounds();

    constructor(
        private layers: Layer<WebGLDrawContext>,
        private transformer: CoordinateTransformer,
        private camera: ICamera,
    ) {}

    /**
     * Register a layer callback, forwarding the registration's clip. Every
     * draw method funnels through here so a new draw kind cannot forget it.
     */
    private register(
        layer: number,
        options: RendererClipOptions | undefined,
        fn: DrawCallback<WebGLDrawContext>,
    ): DrawHandle {
        return this.layers.add(layer, fn, options?.clip);
    }

    addDrawFunction(
        fn: (
            ctx: CanvasRenderingContext2D,
            coords: Coords,
            config: Required<CanvasTileEngineConfig>,
            transform: DrawTransform,
        ) => void,
        layer: number = 1,
        options?: RendererClipOptions,
    ): DrawHandle {
        return this.register(layer, options, ({ ctx, config, topLeft }) => {
            fn(ctx, topLeft, config, this.drawTransform);
        });
    }

    /**
     * Split a {@link Paint} into what the GPU wants: a flat color, plus an
     * atlas row and axis when it is a gradient.
     *
     * The flat color stays meaningful for a gradient — it is the first stop —
     * so anything that ignores the gradient (the stencil pass of a path fill)
     * still paints something sensible rather than black.
     */
    private resolveFill(
        gl: GLRenderer,
        paint: Paint,
        box: PaintBox,
        toScreen: (x: number, y: number) => Coords = (x, y) => this.transformer.worldToScreen(x, y),
    ): { color: RGBA; gradient?: ShapeGradient } {
        if (!isGradient(paint)) {
            return { color: this.colorParser.parse(paint) };
        }

        const stops = normalizeStops(paint.stops).map((stop) => ({
            offset: stop.offset,
            color: this.colorParser.parse(stop.color),
        }));
        const row = gl.rampRow(paintKey(paint), stops);
        return {
            color: stops[0]?.color ?? TRANSPARENT,
            gradient: { axis: gradientAxisPx(paint, box, toScreen), row },
        };
    }

    drawRect(
        items: Array<Rect> | Rect,
        layer: number = 1,
        options?: RendererDrawOptions<Rect, ShapeDecorationStyle>,
    ): DrawHandle {
        const list = Array.isArray(items) ? items : [items];
        const styleOf = options?.styleOf;
        const visibleOf = options?.visibleOf;

        const culler = new PaintedCuller(
            list,
            (item, scale) => boxPaintBounds(item, scale, item.style),
            !!styleOf,
            list.reduce((max, item) => Math.max(max, boxPixelPadding(item, item.style)), 0),
        );

        return this.register(layer, options, ({ gl, config, topLeft }) => {
            const bounds = getViewportBounds(topLeft, config);
            const visibleItems = culler.query(bounds, this.camera.scale);

            let shapes: ShapeInstance[] = [];
            let lines: LineInstance[] = [];

            for (const item of visibleItems) {
                if (visibleOf?.(item) === false) {
                    continue;
                }
                // Pixel sizes win over world units, resolved against the live scale
                const { width: pxW, height: pxH } = resolveBoxPx(item, this.camera.scale);
                if (!Number.isFinite(pxW) || !Number.isFinite(pxH)) {
                    continue;
                }
                const origin = resolveOrigin(item.origin);
                const deco = styleOf?.(item);
                const style = deco ? { ...item.style, ...deco } : item.style;

                if (!intersectsBounds(bounds, boxPaintBounds(item, this.camera.scale, style))) {
                    continue;
                }

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const { x: drawX, y: drawY } = computeOriginOffset(pos, pxW, pxH, origin, this.camera.scale);
                const cx = drawX + pxW / 2;
                const cy = drawY + pxH / 2;
                const rotation = (item.rotate ?? 0) * (Math.PI / 180);
                const radius = this.resolveRadius(resolveRadiusPx(item.radius, this.camera.scale), pxW, pxH);
                if (!radius) {
                    continue;
                }

                if (style?.fillStyle && pxW > 0 && pxH > 0) {
                    // A later fill must cover earlier strokes. Only adjacent
                    // paints using the same GPU pipeline can share a batch.
                    if (lines.length > 0) {
                        gl.drawLines(lines);
                        lines = [];
                    }
                    // The instance's gradient axis is read in the shape's own
                    // local frame, so a box-unit ramp turns with the shape and
                    // a world-unit one is un-rotated into that same frame.
                    const fill = this.resolveFill(
                        gl,
                        style.fillStyle,
                        { x: -pxW / 2, y: -pxH / 2, width: pxW, height: pxH },
                        (wx, wy) => unrotate(this.transformer.worldToScreen(wx, wy), cx, cy, rotation),
                    );
                    shapes.push({
                        cx,
                        cy,
                        halfW: pxW / 2,
                        halfH: pxH / 2,
                        radius,
                        rotation,
                        color: fill.color,
                        gradient: fill.gradient,
                    });
                }

                if (style?.strokeStyle) {
                    if (shapes.length > 0) {
                        gl.drawShapes(shapes);
                        shapes = [];
                    }
                    this.pushRectStroke(
                        lines,
                        cx,
                        cy,
                        pxW,
                        pxH,
                        radius,
                        rotation,
                        this.colorParser.parse(style.strokeStyle),
                        resolveLineWidthPx(style, this.camera.scale),
                        resolveLineDashPx(style, this.camera.scale),
                    );
                }
            }

            gl.drawShapes(shapes);
            gl.drawLines(lines);
        });
    }

    drawCircle(
        items: Array<Circle> | Circle,
        layer: number = 1,
        options?: RendererDrawOptions<Circle, ShapeDecorationStyle>,
    ): DrawHandle {
        const list = Array.isArray(items) ? items : [items];
        const styleOf = options?.styleOf;
        const visibleOf = options?.visibleOf;

        const culler = new PaintedCuller(
            list,
            (item, scale) => boxPaintBounds(item, scale, item.style, false),
            !!styleOf,
            list.reduce((max, item) => Math.max(max, boxPixelPadding(item, item.style)), 0),
        );

        return this.register(layer, options, ({ gl, config, topLeft }) => {
            const bounds = getViewportBounds(topLeft, config);
            const visibleItems = culler.query(bounds, this.camera.scale);

            let shapes: ShapeInstance[] = [];
            let lines: LineInstance[] = [];

            for (const item of visibleItems) {
                if (visibleOf?.(item) === false) {
                    continue;
                }
                // sizePx wins over size, resolved against the live scale
                const sizeWorld = resolveSizeWorld(item, this.camera.scale);
                const origin = resolveOrigin(item.origin);
                const deco = styleOf?.(item);
                const style = deco ? { ...item.style, ...deco } : item.style;

                if (!intersectsBounds(bounds, boxPaintBounds(item, this.camera.scale, style, false))) {
                    continue;
                }

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = sizeWorld * this.camera.scale;
                const radius = pxSize / 2;
                const { x: drawX, y: drawY } = computeOriginOffset(pos, pxSize, pxSize, origin, this.camera.scale);
                const cx = drawX + radius;
                const cy = drawY + radius;

                if (style?.fillStyle) {
                    // Preserve each item's fill-then-stroke order, including
                    // when a later translucent fill overlaps an outline.
                    if (lines.length > 0) {
                        gl.drawLines(lines);
                        lines = [];
                    }
                    // Local frame like the rect path: drawShapes evaluates the
                    // axis at the instance's unrotated corner offsets, so the
                    // box is centered on the origin and a world axis is
                    // translated into that frame.
                    const fill = this.resolveFill(
                        gl,
                        style.fillStyle,
                        { x: -radius, y: -radius, width: radius * 2, height: radius * 2 },
                        (wx, wy) => unrotate(this.transformer.worldToScreen(wx, wy), cx, cy, 0),
                    );
                    shapes.push({
                        cx,
                        cy,
                        halfW: radius,
                        halfH: radius,
                        radius: [radius, radius, radius, radius],
                        rotation: 0,
                        color: fill.color,
                        gradient: fill.gradient,
                    });
                }

                if (style?.strokeStyle) {
                    if (shapes.length > 0) {
                        gl.drawShapes(shapes);
                        shapes = [];
                    }
                    this.pushCircleStroke(
                        lines,
                        cx,
                        cy,
                        radius,
                        this.colorParser.parse(style.strokeStyle),
                        resolveLineWidthPx(style, this.camera.scale),
                        resolveLineDashPx(style, this.camera.scale),
                    );
                }
            }

            gl.drawShapes(shapes);
            gl.drawLines(lines);
        });
    }

    drawLine(
        items: Array<Line> | Line,
        style?: LineStyle,
        layer: number = 1,
        options?: RendererDrawOptions<Line, LineDecorationStyle>,
    ): DrawHandle {
        const list = Array.isArray(items) ? items : [items];
        const styleOf = options?.styleOf;
        const visibleOf = options?.visibleOf;

        return this.register(layer, options, ({ gl, config, topLeft }) => {
            const bounds = getViewportBounds(topLeft, config);
            const color = this.colorParser.parse(style?.strokeStyle ?? "#000");
            const lineWidth = resolveLineWidthPx(style, this.camera.scale);
            const dash = resolveLineDashPx(style, this.camera.scale);
            const lines: LineInstance[] = [];

            for (const item of list) {
                if (visibleOf?.(item) === false) {
                    continue;
                }
                if (!intersectsBounds(bounds, linePaintBounds(item, this.camera.scale, style))) {
                    continue;
                }

                let itemColor = color;
                let itemWidth = lineWidth;
                let itemDash = dash;
                const deco = styleOf?.(item);
                if (deco || item.style) {
                    // Width resolves from the registration-time layers only
                    // (call style + item.style) — the same layers hit testing
                    // reads — so a smuggled decoration width cannot desync
                    // paint from hit. Color and dash take the full merge.
                    const registration = overlayLineStyle(style, item.style);
                    const merged = overlayLineStyle(registration, deco);
                    itemColor = this.colorParser.parse(merged.strokeStyle ?? "#000");
                    itemWidth = resolveLineWidthPx(registration, this.camera.scale);
                    itemDash = resolveLineDashPx(merged, this.camera.scale);
                }

                const a = this.transformer.worldToScreen(item.from.x, item.from.y);
                const b = this.transformer.worldToScreen(item.to.x, item.to.y);
                // Each Line item is its own subpath: the dash phase restarts.
                this.pushSegment(lines, a, b, itemColor, itemWidth, itemDash, 0);
            }

            gl.drawLines(lines);
        });
    }

    drawText(
        items: Array<Text> | Text,
        layer: number = 2,
        options?: RendererDrawOptions<Text, TextDecorationStyle>,
    ): DrawHandle {
        this.textBounds.clear();
        const list = Array.isArray(items) ? items : [items];
        const styleOf = options?.styleOf;
        const visibleOf = options?.visibleOf;

        let culler: PaintedCuller<Text> | undefined;
        let measuringContext: CanvasRenderingContext2D;

        return this.register(layer, options, ({ ctx, config, topLeft }) => {
            const bounds = getViewportBounds(topLeft, config);
            ctx.save();
            measuringContext = ctx;
            culler ??= new PaintedCuller(
                list,
                (item, scale) =>
                    textPaintBounds(item, scale, this.textBounds.measure(measuringContext, item, item.style, scale)),
                !!styleOf,
            );
            const visibleItems = culler.query(bounds, this.camera.scale, this.textBounds.getRevision(ctx));

            for (const item of visibleItems) {
                if (visibleOf?.(item) === false) {
                    continue;
                }
                const size = item.size ?? 1;
                const deco = styleOf?.(item);
                const style = deco ? { ...item.style, ...deco } : item.style;

                const paintedBounds = textPaintBounds(
                    item,
                    this.camera.scale,
                    this.textBounds.measure(ctx, item, style, this.camera.scale),
                );
                if (!intersectsBounds(bounds, paintedBounds)) {
                    continue;
                }

                const pxSize = item.fontPx ?? size * this.camera.scale;
                const family = style?.fontFamily ?? "sans-serif";
                // Matches the Canvas2D renderer, weight omission included.
                ctx.font =
                    style?.fontWeight !== undefined
                        ? `${style.fontWeight} ${pxSize}px ${family}`
                        : `${pxSize}px ${family}`;

                // Match Canvas2D and Skia instead of inheriting overlay state.
                ctx.fillStyle = style?.fillStyle ?? "#000000";
                ctx.textAlign = style?.textAlign ?? "center";
                ctx.textBaseline = style?.textBaseline ?? "middle";

                const pos = this.transformer.worldToScreen(item.x, item.y);

                const rotationDeg = item.rotate ?? 0;
                if (rotationDeg !== 0) {
                    const rotation = rotationDeg * (Math.PI / 180);
                    ctx.save();
                    ctx.translate(pos.x, pos.y);
                    ctx.rotate(rotation);
                    ctx.fillText(item.text, 0, 0);
                    ctx.restore();
                } else {
                    ctx.fillText(item.text, pos.x, pos.y);
                }
            }
            ctx.restore();
        });
    }

    drawPath(
        items: PathItem[],
        layer: number = 1,
        options?: RendererDrawOptions<PathItem, PathDecorationStyle>,
    ): DrawHandle {
        const styleOf = options?.styleOf;
        const visibleOf = options?.visibleOf;
        // Conservative world bounds per item for culling, computed once.
        const itemBounds = items.map((item) => pathItemBounds(item));

        // WebGL has no native curves: command paths flatten in world space,
        // cached per scale bucket and re-flattened only when the camera
        // scale drifts beyond 2x — sampling stays near the on-screen pixel
        // density without per-frame CPU cost, and faceting never shows on
        // deep zoom.
        const flatCache: Array<{ scale: number; subpaths: Subpath[] } | null> = items.map(() => null);
        const subpathsFor = (n: number, item: PathItem): Subpath[] => {
            const scale = this.camera.scale;
            const cached = flatCache[n];
            if (cached && scale >= cached.scale / 2 && scale <= cached.scale * 2) {
                return cached.subpaths;
            }
            const subpaths = flattenPathCommands(item.commands!, ARC_SEGMENT_LENGTH / scale);
            flatCache[n] = { scale, subpaths };
            return subpaths;
        };

        return this.register(layer, options, ({ gl, config, topLeft }) => {
            const viewport = getViewportBounds(topLeft, config);
            let lines: LineInstance[] = [];

            for (let n = 0; n < items.length; n++) {
                const item = items[n];
                const bounds = itemBounds[n];
                if (!bounds || visibleOf?.(item) === false) {
                    continue;
                }

                if (!intersectsBounds(viewport, pathPaintBounds(bounds, item.style, this.camera.scale))) {
                    continue;
                }

                const deco = styleOf?.(item);
                const style = deco ? { ...item.style, ...deco } : item.style;
                const filled = style?.fillStyle !== undefined;

                // Screen-space subpaths: flattened commands, or the (possibly
                // corner-rounded) points polyline as a single subpath.
                let subpaths: Array<{ points: Coords[]; closed: boolean }>;
                if (item.commands !== undefined) {
                    subpaths = subpathsFor(n, item).map((sub) => ({
                        points: sub.points.map((p) => this.transformer.worldToScreen(p.x, p.y)),
                        closed: sub.closed,
                    }));
                } else {
                    const closed = item.closed === true;
                    // Registration-time only (the layer hit testing reads);
                    // the decoration types' exclusion is only type-level.
                    const radiusPx = resolveCornerRadiusPx(item.style, this.camera.scale);
                    const pts = item.points!.map((p) => this.transformer.worldToScreen(p.x, p.y));
                    // Corner rounding flattens into a denser polyline, so dash
                    // tessellation and fills run over it unchanged. Closed
                    // outlines round every vertex; open ones interior joints.
                    const outline = closed ? roundedRing(pts, radiusPx) : roundedPolyline(pts, radiusPx);
                    subpaths = [{ points: outline, closed }];
                }

                if (filled) {
                    // Stencil fills execute immediately, so earlier strokes
                    // must reach the GPU before this item's fill begins.
                    if (lines.length > 0) {
                        gl.drawLines(lines);
                        lines = [];
                    }
                    // Like Canvas2D fill(), open subpaths close implicitly.
                    // Multi-ring stencil-then-cover: winding accumulates
                    // across subpaths, so holes match Canvas2D/Skia exactly.
                    // The cover quad is unrotated screen space, so unlike the
                    // shape instances the axis is screen space too.
                    const topLeftPx = this.transformer.worldToScreen(bounds.minX, bounds.minY);
                    const bottomRightPx = this.transformer.worldToScreen(bounds.maxX, bounds.maxY);
                    const fill = this.resolveFill(gl, style!.fillStyle!, {
                        x: topLeftPx.x,
                        y: topLeftPx.y,
                        width: bottomRightPx.x - topLeftPx.x,
                        height: bottomRightPx.y - topLeftPx.y,
                    });
                    gl.fillPath(
                        subpaths.map((sub) => sub.points),
                        fill.color,
                        item.fillRule === "evenodd",
                        fill.gradient,
                    );
                }

                if (style?.strokeStyle !== undefined || !filled) {
                    const color = this.colorParser.parse(style?.strokeStyle ?? "#000");
                    // Width from item.style: registration-time only, matching
                    // the hit corridor (decoration exclusion is type-level).
                    const lineWidth = resolveLineWidthPx(item.style, this.camera.scale);
                    const dash = resolveLineDashPx(style, this.camera.scale);

                    for (const sub of subpaths) {
                        const pts = sub.points;
                        // The dash phase carries across joints so the pattern
                        // flows continuously within a subpath, resetting at
                        // the next one — like ctx subpaths.
                        let phase = 0;
                        for (let i = 1; i < pts.length; i++) {
                            phase = this.pushSegment(lines, pts[i - 1], pts[i], color, lineWidth, dash, phase);
                        }
                        if (sub.closed && pts.length > 2) {
                            this.pushSegment(lines, pts[pts.length - 1], pts[0], color, lineWidth, dash, phase);
                        }
                    }
                }
            }

            gl.drawLines(lines);
        });
    }

    drawImage(
        items: Array<ImageItem> | ImageItem,
        layer: number = 1,
        options?: RendererImageDrawOptions<HTMLImageElement>,
    ): DrawHandle {
        const list = Array.isArray(items) ? items : [items];
        const visibleOf = options?.visibleOf;

        const culler = new PaintedCuller(
            list,
            (item, scale) => boxPaintBounds(item, scale),
            false,
            list.reduce((max, item) => Math.max(max, boxPixelPadding(item)), 0),
        );

        return this.register(layer, options, ({ gl, config, topLeft }) => {
            const bounds = getViewportBounds(topLeft, config);
            const visibleItems = culler.query(bounds, this.camera.scale);

            const images: ImageInstance[] = [];

            for (const item of visibleItems) {
                if (visibleOf?.(item) === false) {
                    continue;
                }
                // sizePx wins over size, resolved against the live scale
                const sizeWorld = resolveSizeWorld(item, this.camera.scale);
                const origin = resolveOrigin(item.origin);

                if (!intersectsBounds(bounds, boxPaintBounds(item, this.camera.scale))) {
                    continue;
                }

                const texture = gl.getTexture(item.img);
                if (!texture) {
                    continue;
                }

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = sizeWorld * this.camera.scale;

                // Spritesheet source rect; defaults to the whole image
                const sprite = item.sprite;
                const srcW = sprite?.w ?? item.img.width;
                const srcH = sprite?.h ?? item.img.height;

                // preserve aspect (of the sprite frame when one is set)
                const aspect = srcW / srcH;
                let drawW = pxSize;
                let drawH = pxSize;
                if (aspect > 1) {
                    drawH = pxSize / aspect;
                } else {
                    drawW = pxSize * aspect;
                }

                const { x: baseX, y: baseY } = computeOriginOffset(pos, pxSize, pxSize, origin, this.camera.scale);
                const offsetX = baseX + (pxSize - drawW) / 2;
                const offsetY = baseY + (pxSize - drawH) / 2;
                const rotation = (item.rotate ?? 0) * (Math.PI / 180);

                const instance: ImageInstance = {
                    texture,
                    x: offsetX,
                    y: offsetY,
                    w: drawW,
                    h: drawH,
                    rotation,
                    alpha: item.opacity ?? 1,
                };

                if (sprite) {
                    // Normalize the pixel rect into 0..1 texcoords
                    instance.u0 = sprite.x / item.img.width;
                    instance.v0 = sprite.y / item.img.height;
                    instance.u1 = (sprite.x + sprite.w) / item.img.width;
                    instance.v1 = (sprite.y + sprite.h) / item.img.height;
                }

                // Mirroring = swapped texcoords; no vertex transform needed.
                if (item.flipX === true) {
                    const u0 = instance.u0 ?? 0;
                    instance.u0 = instance.u1 ?? 1;
                    instance.u1 = u0;
                }
                if (item.flipY === true) {
                    const v0 = instance.v0 ?? 0;
                    instance.v0 = instance.v1 ?? 1;
                    instance.v1 = v0;
                }

                images.push(instance);
            }

            gl.drawImages(images);
        });
    }

    drawGridLines(
        cellSize: number,
        style: { strokeStyle: string; lineWidth: number },
        layer: number = 0,
        options?: RendererClipOptions,
    ): DrawHandle {
        if (!Number.isFinite(cellSize) || cellSize <= 0) {
            throw new RangeError("[CanvasTileEngine] cellSize must be a positive finite number");
        }
        return this.register(layer, options, ({ gl, config, topLeft }) => {
            const viewW = config.size.width / config.scale;
            const viewH = config.size.height / config.scale;

            // Zoomed far out, keep only every 2nd/4th/... line so the vertex
            // count stays bounded by the viewport size instead of growing with 1/scale.
            const step = gridLineStep(cellSize, config.scale);

            const startX = Math.floor(topLeft.x / step) * step - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endX = Math.ceil((topLeft.x + viewW) / step) * step - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const startY = Math.floor(topLeft.y / step) * step - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endY = Math.ceil((topLeft.y + viewH) / step) * step - DEFAULT_VALUES.CELL_CENTER_OFFSET;

            const color = this.colorParser.parse(style.strokeStyle);
            const lines: LineInstance[] = [];

            for (let x = startX; x <= endX; x += step) {
                const p1 = this.transformer.worldToScreen(x, startY);
                const p2 = this.transformer.worldToScreen(x, endY);
                this.pushLine(lines, p1, p2, color, style.lineWidth);
            }

            for (let y = startY; y <= endY; y += step) {
                const p1 = this.transformer.worldToScreen(startX, y);
                const p2 = this.transformer.worldToScreen(endX, y);
                this.pushLine(lines, p1, p2, color, style.lineWidth);
            }

            gl.drawLines(lines);
        });
    }

    // ─── Static variants ───
    //
    // The Canvas2D renderer pre-renders static content into an offscreen canvas
    // and blits it each frame. WebGL batches consecutive compatible paints, so
    // the static variants reuse the dynamic path.

    drawStaticRect(
        items: Array<Rect>,
        _cacheKey: string,
        layer: number = 1,
        options?: RendererClipOptions,
    ): DrawHandle {
        // Pixel sizes are stripped for the same reason as drawStaticCircle's:
        // static draws must look the same on every renderer, and the cached
        // ones replay at a recorded scale where a screen size cannot hold.
        return this.drawRect(
            items.map(({ sizePx: _sizePx, widthPx: _widthPx, heightPx: _heightPx, ...rest }) => rest),
            layer,
            options,
        );
    }

    drawStaticCircle(
        items: Array<Circle>,
        _cacheKey: string,
        layer: number = 1,
        options?: RendererClipOptions,
    ): DrawHandle {
        // sizePx is stripped even though WebGL redraws statics dynamically:
        // static draws must render identically across renderers (the cached
        // ones replay at a recorded scale), and hit boxes ignore it too.
        return this.drawCircle(
            items.map(({ sizePx: _sizePx, ...rest }) => rest),
            layer,
            options,
        );
    }

    drawStaticImage(
        items: Array<ImageItem>,
        _cacheKey: string,
        layer: number = 1,
        options?: RendererClipOptions,
    ): DrawHandle {
        return this.drawImage(
            items.map(({ sizePx: _sizePx, ...rest }) => rest),
            layer,
            options,
        );
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clearStaticCache(_cacheKey?: string) {
        // No offscreen caches are kept in the WebGL renderer.
    }

    // ─── Layer management ───

    removeDrawHandle(handle: DrawHandle) {
        this.layers.remove(handle);
    }

    clearLayer(layer: number) {
        this.layers.clear(layer);
    }

    clearAll() {
        this.layers.clear();
    }

    /**
     * Release cached resources and layer callbacks.
     */
    destroy() {
        this.layers.clear();
        this.colorParser.clear();
        this.textBounds.clear();
    }

    // ─── Geometry helpers ───

    /**
     * Normalize a radius value to per-corner radii [topLeft, topRight,
     * bottomRight, bottomLeft], following `ctx.roundRect` semantics: shorter
     * arrays expand CSS-style, and when adjacent radii overflow an edge all
     * radii are scaled down proportionally.
     */
    private resolveRadius(
        radius: number | number[] | undefined,
        width: number,
        height: number,
    ): [number, number, number, number] | null {
        if (radius === undefined) {
            return [0, 0, 0, 0];
        }

        let tl: number, tr: number, br: number, bl: number;
        if (Array.isArray(radius)) {
            if (radius.length < 1 || radius.length > 4) {
                throw new RangeError("Rectangle radius must contain one to four values");
            }
            const r = radius;
            switch (r.length) {
                case 1:
                    tl = tr = br = bl = r[0];
                    break;
                case 2:
                    tl = br = r[0];
                    tr = bl = r[1];
                    break;
                case 3:
                    tl = r[0];
                    tr = bl = r[1];
                    br = r[2];
                    break;
                default:
                    [tl, tr, br, bl] = r;
            }
        } else {
            tl = tr = br = bl = radius;
        }
        for (const r of [tl, tr, br, bl]) {
            if (!Number.isFinite(r)) {
                return null;
            }
            if (r < 0) {
                throw new RangeError("Rectangle radii must be non-negative");
            }
        }

        // Each adjacent pair competes for its own edge, not the shorter axis.
        // In particular, [20, 20, 0, 0] fits a 100 x 20 box unchanged. Do not
        // replace a zero ratio with 1: a collapsed edge must collapse radii.
        // Normalize first so adding two large finite radii cannot overflow.
        const largest = Math.max(tl, tr, br, bl);
        if (largest === 0) {
            return [0, 0, 0, 0];
        }
        tl /= largest;
        tr /= largest;
        br /= largest;
        bl /= largest;
        const fit = (edge: number, a: number, b: number) => (a + b > 0 ? Math.max(0, edge) / (a + b) : Infinity);
        const scale = Math.min(
            largest,
            fit(width, tl, tr),
            fit(height, tr, br),
            fit(width, br, bl),
            fit(height, bl, tl),
        );
        return [tl * scale, tr * scale, br * scale, bl * scale];
    }

    /**
     * Emulate the Canvas2D `applyLineWidth` alpha trick: sub-pixel widths render
     * as a 1px line with proportionally reduced opacity.
     */
    private resolveStroke(color: RGBA, lineWidth: number): { width: number; color: RGBA } {
        if (lineWidth >= 1) {
            return { width: lineWidth, color };
        }
        const alpha = Math.max(0, Math.min(lineWidth, 1));
        return {
            width: 1,
            color: [color[0], color[1], color[2], color[3] * alpha],
        };
    }

    /**
     * Push a→b as a solid line or, when a dash pattern is active, as its
     * CPU-tessellated sub-segments. Returns the advanced dash phase.
     */
    private pushSegment(
        lines: LineInstance[],
        a: Coords,
        b: Coords,
        color: RGBA,
        lineWidth: number,
        dash: number[] | undefined,
        phase: number,
    ): number {
        if (!dash) {
            this.pushLine(lines, a, b, color, lineWidth);
            return phase;
        }
        const segments: Array<{ a: Coords; b: Coords }> = [];
        const next = appendDashedSegment(segments, a, b, dash, phase);
        for (const s of segments) {
            this.pushLine(lines, s.a, s.b, color, lineWidth);
        }
        return next;
    }

    private pushLine(lines: LineInstance[], a: Coords, b: Coords, color: RGBA, lineWidth: number) {
        const stroke = this.resolveStroke(color, lineWidth);
        lines.push({
            x1: a.x,
            y1: a.y,
            x2: b.x,
            y2: b.y,
            width: stroke.width,
            color: stroke.color,
        });
    }

    private pushRectStroke(
        lines: LineInstance[],
        cx: number,
        cy: number,
        w: number,
        h: number,
        radius: [number, number, number, number],
        rotation: number,
        color: RGBA,
        lineWidth: number,
        dash?: number[],
    ) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = w / 2;
        const hh = h / 2;
        const corner = (ox: number, oy: number): Coords => ({
            x: cx + ox * cos - oy * sin,
            y: cy + ox * sin + oy * cos,
        });
        if (w === 0 || h === 0) {
            if (w !== 0 || h !== 0) {
                const a = corner(-hw, -hh);
                const b = corner(hw, hh);
                const firstLine = lines.length;
                const phase = this.pushSegment(lines, a, b, color, lineWidth, dash, 0);
                if (dash) {
                    // A closed collapsed rectangle traverses the same edge
                    // back again; its returning dash phase can cover gaps.
                    this.pushSegment(lines, b, a, color, lineWidth, dash, phase);
                    const strokeGroup = {};
                    for (let i = firstLine; i < lines.length; i++) {
                        lines[i].strokeGroup = strokeGroup;
                    }
                }
            }
            return;
        }
        if (radius.some((r) => r > 0)) {
            const [tl, tr, br, bl] = radius;
            const points: Coords[] = [corner(-hw + tl, -hh)];
            const arc = (x: number, y: number, r: number, start: number) => {
                // Bound both chord length and curvature error (small circles
                // need more than two samples even when their arc is short).
                const steps = Math.min(4096, Math.max(8, Math.ceil((Math.PI * r) / (2 * ARC_SEGMENT_LENGTH))));
                for (let i = 0; i <= (r > 0 ? steps : 0); i++) {
                    const angle = start + (Math.PI * i) / (2 * steps);
                    const point = corner(x + Math.cos(angle) * r, y + Math.sin(angle) * r);
                    const prev = points[points.length - 1];
                    if (Math.hypot(point.x - prev.x, point.y - prev.y) > 1e-9) {
                        points.push(point);
                    }
                }
            };
            arc(hw - tr, -hh + tr, tr, -Math.PI / 2);
            arc(hw - br, hh - br, br, 0);
            arc(-hw + bl, hh - bl, bl, Math.PI / 2);
            arc(-hw + tl, -hh + tl, tl, Math.PI);
            const firstLine = lines.length;
            const strokeGroup = {};
            let phase = 0;
            for (let i = 1; i < points.length; i++) {
                phase = this.pushSegment(lines, points[i - 1], points[i], color, lineWidth, dash, phase);
            }
            if (
                Math.hypot(points[points.length - 1].x - points[0].x, points[points.length - 1].y - points[0].y) > 1e-9
            ) {
                this.pushSegment(lines, points[points.length - 1], points[0], color, lineWidth, dash, phase);
            }
            // Shared miter endpoints close the chord joints without overlapping
            // translucent quads. Dash caps stay flat wherever a gap interrupts
            // the contour; the phase itself never restarts at an arc or edge.
            for (let i = firstLine; i < lines.length; i++) {
                const prev = lines[i === firstLine ? lines.length - 1 : i - 1];
                const curr = lines[i];
                curr.strokeGroup = strokeGroup;
                if (Math.hypot(prev.x2 - curr.x1, prev.y2 - curr.y1) > 1e-9) {
                    continue;
                }
                const prevLength = Math.hypot(prev.x2 - prev.x1, prev.y2 - prev.y1);
                const currLength = Math.hypot(curr.x2 - curr.x1, curr.y2 - curr.y1);
                const ax = -(prev.y2 - prev.y1) / prevLength;
                const ay = (prev.x2 - prev.x1) / prevLength;
                const bx = -(curr.y2 - curr.y1) / currLength;
                const by = (curr.x2 - curr.x1) / currLength;
                const divisor = 1 + ax * bx + ay * by;
                if (divisor <= 1e-9) {
                    continue;
                }
                const half = curr.width / 2;
                const offset = { x: ((ax + bx) * half) / divisor, y: ((ay + by) * half) / divisor };
                prev.endOffset = offset;
                curr.startOffset = offset;
            }
            return;
        }
        const tl = corner(-hw, -hh);
        const tr = corner(hw, -hh);
        const br = corner(hw, hh);
        const bl = corner(-hw, hh);

        if (dash) {
            // Walk the perimeter as one closed polyline so the dash phase
            // flows continuously around the corners. The solid path's
            // corner-coverage extensions are skipped: they would distort the
            // pattern, and dashed outlines have gaps by design anyway.
            let phase = 0;
            phase = this.pushSegment(lines, tl, tr, color, lineWidth, dash, phase);
            phase = this.pushSegment(lines, tr, br, color, lineWidth, dash, phase);
            phase = this.pushSegment(lines, br, bl, color, lineWidth, dash, phase);
            this.pushSegment(lines, bl, tl, color, lineWidth, dash, phase);
            return;
        }

        // Horizontal edges are extended by half the stroke width and vertical
        // edges shrunk by the same amount, so the corner squares are covered
        // exactly once — no gaps and no double-blend overlap.
        const half = Math.max(lineWidth, 1) / 2;
        const ux = cos * half; // along tl→tr
        const uy = sin * half;
        const vx = -sin * half; // along tl→bl
        const vy = cos * half;

        this.pushLine(lines, { x: tl.x - ux, y: tl.y - uy }, { x: tr.x + ux, y: tr.y + uy }, color, lineWidth);
        this.pushLine(lines, { x: bl.x - ux, y: bl.y - uy }, { x: br.x + ux, y: br.y + uy }, color, lineWidth);
        if (h > half * 2) {
            this.pushLine(lines, { x: tl.x + vx, y: tl.y + vy }, { x: bl.x - vx, y: bl.y - vy }, color, lineWidth);
            this.pushLine(lines, { x: tr.x + vx, y: tr.y + vy }, { x: br.x - vx, y: br.y - vy }, color, lineWidth);
        }
    }

    private pushCircleStroke(
        lines: LineInstance[],
        cx: number,
        cy: number,
        radius: number,
        color: RGBA,
        lineWidth: number,
        dash?: number[],
    ) {
        if (dash) {
            // Thread the dash phase through the chord polyline so the pattern
            // flows continuously around the circle. No miter extensions: they
            // would distort the pattern, and dashed outlines gap by design.
            let phase = 0;
            let prev: Coords = { x: cx + radius, y: cy };
            for (let i = 1; i <= CIRCLE_STROKE_SEGMENTS; i++) {
                const angle = (i / CIRCLE_STROKE_SEGMENTS) * Math.PI * 2;
                const curr: Coords = {
                    x: cx + Math.cos(angle) * radius,
                    y: cy + Math.sin(angle) * radius,
                };
                phase = this.pushSegment(lines, prev, curr, color, lineWidth, dash, phase);
                prev = curr;
            }
            return;
        }

        // Extend each chord by the miter length so adjacent segments meet
        // without gaps on the outside of the joint.
        const ext = (Math.max(lineWidth, 1) / 2) * Math.tan(Math.PI / CIRCLE_STROKE_SEGMENTS);
        let prev: Coords = { x: cx + radius, y: cy };
        for (let i = 1; i <= CIRCLE_STROKE_SEGMENTS; i++) {
            const angle = (i / CIRCLE_STROKE_SEGMENTS) * Math.PI * 2;
            const curr: Coords = {
                x: cx + Math.cos(angle) * radius,
                y: cy + Math.sin(angle) * radius,
            };
            const len = Math.hypot(curr.x - prev.x, curr.y - prev.y) || 1;
            const dx = ((curr.x - prev.x) / len) * ext;
            const dy = ((curr.y - prev.y) / len) * ext;
            this.pushLine(
                lines,
                { x: prev.x - dx, y: prev.y - dy },
                { x: curr.x + dx, y: curr.y + dy },
                color,
                lineWidth,
            );
            prev = curr;
        }
    }
}
