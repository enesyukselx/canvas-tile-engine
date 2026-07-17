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
    SpatialIndex,
    Text,
    VISIBILITY_BUFFER,
    resolveLineWidthPx,
    resolveLineDashPx,
    resolveCornerRadiusPx,
    resolveRadiusPx,
    DrawTransform,
} from "@canvas-tile-engine/core";
import type { LineStyle } from "@canvas-tile-engine/core";
import { appendDashedSegment } from "../utils/dash";
import { roundedPolyline, roundedRing } from "../utils/corners";
import { Layer } from "./Layer";
import { ImageInstance, LineInstance, ShapeInstance } from "./gl/GLRenderer";
import { ColorParser, RGBA } from "../utils/color";

// Threshold for using spatial indexing (below this, linear scan is faster)
const SPATIAL_INDEX_THRESHOLD = 500;
// Segment count used to approximate a stroked circle outline.
const CIRCLE_STROKE_SEGMENTS = 48;

/**
 * WebGL implementation of the engine draw API.
 *
 * Mirrors the Canvas2D `CanvasDraw` (culling, spatial indexing, origin handling,
 * rotation), but instead of issuing immediate Canvas2D calls it accumulates GPU
 * primitives per layer and flushes each as a single batched draw call. Text and
 * raw draw functions are delegated to the 2D overlay context.
 * @internal
 */
export class WebGLDraw {
    /** Transform helpers handed to custom draw callbacks. */
    private drawTransform: DrawTransform = {
        worldToScreen: (x, y) => this.transformer.worldToScreen(x, y),
        screenToWorld: (x, y) => this.transformer.screenToWorld(x, y),
    };
    private colorParser = new ColorParser();

    constructor(
        private layers: Layer,
        private transformer: CoordinateTransformer,
        private camera: ICamera,
    ) {}

    private isVisible(
        x: number,
        y: number,
        sizeWorld: number,
        topLeft: Coords,
        config: Required<CanvasTileEngineConfig>,
    ) {
        const viewW = config.size.width / config.scale;
        const viewH = config.size.height / config.scale;
        const minX = topLeft.x - VISIBILITY_BUFFER.TILE_BUFFER;
        const minY = topLeft.y - VISIBILITY_BUFFER.TILE_BUFFER;
        const maxX = topLeft.x + viewW + VISIBILITY_BUFFER.TILE_BUFFER;
        const maxY = topLeft.y + viewH + VISIBILITY_BUFFER.TILE_BUFFER;
        return x + sizeWorld >= minX && x - sizeWorld <= maxX && y + sizeWorld >= minY && y - sizeWorld <= maxY;
    }

    private getViewportBounds(topLeft: Coords, config: Required<CanvasTileEngineConfig>) {
        const viewW = config.size.width / config.scale;
        const viewH = config.size.height / config.scale;
        return {
            minX: topLeft.x - VISIBILITY_BUFFER.TILE_BUFFER,
            minY: topLeft.y - VISIBILITY_BUFFER.TILE_BUFFER,
            maxX: topLeft.x + viewW + VISIBILITY_BUFFER.TILE_BUFFER,
            maxY: topLeft.y + viewH + VISIBILITY_BUFFER.TILE_BUFFER,
        };
    }

    addDrawFunction(
        fn: (
            ctx: CanvasRenderingContext2D,
            coords: Coords,
            config: Required<CanvasTileEngineConfig>,
            transform: DrawTransform,
        ) => void,
        layer: number = 1,
    ): DrawHandle {
        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            fn(ctx, topLeft, config, this.drawTransform);
        });
    }

    drawRect(items: Array<Rect> | Rect, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ gl, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            const shapes: ShapeInstance[] = [];
            const lines: LineInstance[] = [];

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const w = item.width ?? size;
                const h = item.height ?? size;
                const origin = this.resolveOrigin(item.origin);
                const style = item.style;

                if (!spatialIndex && !this.isVisible(item.x, item.y, Math.max(w, h) / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxW = w * this.camera.scale;
                const pxH = h * this.camera.scale;
                const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxW, pxH, origin, this.camera);
                const cx = drawX + pxW / 2;
                const cy = drawY + pxH / 2;
                const rotation = (item.rotate ?? 0) * (Math.PI / 180);
                const radius = this.resolveRadius(resolveRadiusPx(item.radius, this.camera.scale), Math.min(pxW, pxH));

                if (style?.fillStyle) {
                    shapes.push({
                        cx,
                        cy,
                        halfW: pxW / 2,
                        halfH: pxH / 2,
                        radius,
                        rotation,
                        color: this.colorParser.parse(style.fillStyle),
                    });
                }

                if (style?.strokeStyle) {
                    this.pushRectStroke(
                        lines,
                        cx,
                        cy,
                        pxW,
                        pxH,
                        rotation,
                        this.colorParser.parse(style.strokeStyle),
                        resolveLineWidthPx(style, this.camera.scale),
                    );
                }
            }

            gl.drawShapes(shapes);
            gl.drawLines(lines);
        });
    }

    drawCircle(items: Array<Circle> | Circle, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ gl, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            const shapes: ShapeInstance[] = [];
            const lines: LineInstance[] = [];

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const origin = this.resolveOrigin(item.origin);
                const style = item.style;

                if (!spatialIndex && !this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;
                const radius = pxSize / 2;
                const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, pxSize, origin, this.camera);
                const cx = drawX + radius;
                const cy = drawY + radius;

                if (style?.fillStyle) {
                    shapes.push({
                        cx,
                        cy,
                        halfW: radius,
                        halfH: radius,
                        radius: [radius, radius, radius, radius],
                        rotation: 0,
                        color: this.colorParser.parse(style.fillStyle),
                    });
                }

                if (style?.strokeStyle) {
                    this.pushCircleStroke(
                        lines,
                        cx,
                        cy,
                        radius,
                        this.colorParser.parse(style.strokeStyle),
                        resolveLineWidthPx(style, this.camera.scale),
                    );
                }
            }

            gl.drawShapes(shapes);
            gl.drawLines(lines);
        });
    }

    drawLine(items: Array<Line> | Line, style?: LineStyle, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        return this.layers.add(layer, ({ gl, config, topLeft }) => {
            const color = this.colorParser.parse(style?.strokeStyle ?? "#000");
            const lineWidth = resolveLineWidthPx(style, this.camera.scale);
            const dash = resolveLineDashPx(style, this.camera.scale);
            const lines: LineInstance[] = [];

            for (const item of list) {
                const centerX = (item.from.x + item.to.x) / 2;
                const centerY = (item.from.y + item.to.y) / 2;
                const halfExtent = Math.max(Math.abs(item.from.x - item.to.x), Math.abs(item.from.y - item.to.y)) / 2;
                if (!this.isVisible(centerX, centerY, halfExtent, topLeft, config)) continue;

                const a = this.transformer.worldToScreen(item.from.x, item.from.y);
                const b = this.transformer.worldToScreen(item.to.x, item.to.y);
                // Each Line item is its own subpath: the dash phase restarts.
                this.pushSegment(lines, a, b, color, lineWidth, dash, 0);
            }

            gl.drawLines(lines);
        });
    }

    drawText(items: Array<Text> | Text, layer: number = 2): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            ctx.save();

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const style = item.style;

                // fontPx is zoom-independent; its world-space extent shrinks as scale grows
                const extentWorld = item.fontPx !== undefined ? item.fontPx / this.camera.scale : size;

                if (!spatialIndex && !this.isVisible(item.x, item.y, extentWorld, topLeft, config)) continue;

                const pxSize = item.fontPx ?? size * this.camera.scale;
                const family = style?.fontFamily ?? "sans-serif";
                ctx.font = `${pxSize}px ${family}`;

                if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
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

    drawPath(items: PathItem[], layer: number = 1): DrawHandle {
        return this.layers.add(layer, ({ gl, config, topLeft }) => {
            const lines: LineInstance[] = [];

            for (const item of items) {
                const points = item.points;
                if (!points || points.length < 2) continue;

                const xs = points.map((p) => p.x);
                const ys = points.map((p) => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                const halfExtent = Math.max(maxX - minX, maxY - minY) / 2;
                if (!this.isVisible(centerX, centerY, halfExtent, topLeft, config)) continue;

                const style = item.style;
                const filled = style?.fillStyle !== undefined;
                const closed = item.closed === true;
                const radiusPx = resolveCornerRadiusPx(style, this.camera.scale);
                const pts = points.map((p) => this.transformer.worldToScreen(p.x, p.y));
                // Corner rounding flattens into a denser polyline, so dash
                // tessellation and triangulation run over it unchanged. Closed
                // outlines round every vertex; open ones only interior joints.
                const outline = closed ? roundedRing(pts, radiusPx) : roundedPolyline(pts, radiusPx);

                if (filled && points.length >= 3) {
                    // Like Canvas2D fill(), the outline closes implicitly.
                    // Stencil-then-cover fill: exact nonzero/evenodd winding
                    // (self-intersecting outlines included), same result as
                    // the Canvas2D/Skia renderers.
                    const color = this.colorParser.parse(style!.fillStyle!);
                    gl.fillPath(outline, color, item.fillRule === "evenodd");
                }

                if (style?.strokeStyle !== undefined || !filled) {
                    const color = this.colorParser.parse(style?.strokeStyle ?? "#000");
                    const lineWidth = resolveLineWidthPx(style, this.camera.scale);
                    const dash = resolveLineDashPx(style, this.camera.scale);

                    // The dash phase carries across joints so the pattern
                    // flows continuously, like a single ctx subpath.
                    let phase = 0;
                    for (let i = 1; i < outline.length; i++) {
                        phase = this.pushSegment(lines, outline[i - 1], outline[i], color, lineWidth, dash, phase);
                    }
                    if (closed && outline.length > 2) {
                        this.pushSegment(lines, outline[outline.length - 1], outline[0], color, lineWidth, dash, phase);
                    }
                }
            }

            gl.drawLines(lines);
        });
    }

    drawImage(items: Array<ImageItem> | ImageItem, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ gl, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            const images: ImageInstance[] = [];

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const origin = this.resolveOrigin(item.origin);

                if (!spatialIndex && !this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const texture = gl.getTexture(item.img);
                if (!texture) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;

                // Spritesheet source rect; defaults to the whole image
                const sprite = item.sprite;
                const srcW = sprite?.w ?? item.img.width;
                const srcH = sprite?.h ?? item.img.height;

                // preserve aspect (of the sprite frame when one is set)
                const aspect = srcW / srcH;
                let drawW = pxSize;
                let drawH = pxSize;
                if (aspect > 1) drawH = pxSize / aspect;
                else drawW = pxSize * aspect;

                const { x: baseX, y: baseY } = this.computeOriginOffset(pos, pxSize, pxSize, origin, this.camera);
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

                images.push(instance);
            }

            gl.drawImages(images);
        });
    }

    drawGridLines(cellSize: number, style: { strokeStyle: string; lineWidth: number }, layer: number = 0): DrawHandle {
        return this.layers.add(layer, ({ gl, config, topLeft }) => {
            const viewW = config.size.width / config.scale;
            const viewH = config.size.height / config.scale;

            const startX = Math.floor(topLeft.x / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endX = Math.ceil((topLeft.x + viewW) / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const startY = Math.floor(topLeft.y / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endY = Math.ceil((topLeft.y + viewH) / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;

            const color = this.colorParser.parse(style.strokeStyle);
            const lines: LineInstance[] = [];

            for (let x = startX; x <= endX; x += cellSize) {
                const p1 = this.transformer.worldToScreen(x, startY);
                const p2 = this.transformer.worldToScreen(x, endY);
                this.pushLine(lines, p1, p2, color, style.lineWidth);
            }

            for (let y = startY; y <= endY; y += cellSize) {
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
    // and blits it each frame. With WebGL the per-frame cost of a batched draw is
    // already a single GPU call, so the static variants reuse the dynamic path.

    drawStaticRect(items: Array<Rect>, _cacheKey: string, layer: number = 1): DrawHandle {
        return this.drawRect(items, layer);
    }

    drawStaticCircle(items: Array<Circle>, _cacheKey: string, layer: number = 1): DrawHandle {
        return this.drawCircle(items, layer);
    }

    drawStaticImage(items: Array<ImageItem>, _cacheKey: string, layer: number = 1): DrawHandle {
        return this.drawImage(items, layer);
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
    }

    // ─── Geometry helpers ───

    private resolveOrigin(origin: { mode?: string; x?: number; y?: number } | undefined): {
        mode: "cell" | "self";
        x: number;
        y: number;
    } {
        return {
            mode: origin?.mode === "self" ? "self" : "cell",
            x: origin?.x ?? 0.5,
            y: origin?.y ?? 0.5,
        };
    }

    /**
     * Normalize a radius value to per-corner radii [topLeft, topRight,
     * bottomRight, bottomLeft], following `ctx.roundRect` semantics: shorter
     * arrays expand CSS-style, and when adjacent radii overflow an edge all
     * radii are scaled down proportionally.
     */
    private resolveRadius(radius: number | number[] | undefined, pxSize: number): [number, number, number, number] {
        if (radius === undefined) return [0, 0, 0, 0];

        let tl: number, tr: number, br: number, bl: number;
        if (Array.isArray(radius)) {
            const r = radius.map((v) => Math.max(0, v ?? 0));
            switch (r.length) {
                case 0:
                    tl = tr = br = bl = 0;
                    break;
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
            tl = tr = br = bl = Math.max(0, radius);
        }

        const scale = Math.min(
            1,
            pxSize / (tl + tr) || 1,
            pxSize / (tr + br) || 1,
            pxSize / (br + bl) || 1,
            pxSize / (bl + tl) || 1,
        );
        return [tl * scale, tr * scale, br * scale, bl * scale];
    }

    private computeOriginOffset(
        pos: Coords,
        pxW: number,
        pxH: number,
        origin: { mode: "cell" | "self"; x: number; y: number },
        camera: ICamera,
    ) {
        if (origin.mode === "cell") {
            const cell = camera.scale;
            return {
                x: pos.x - cell / 2 + origin.x * cell - pxW / 2,
                y: pos.y - cell / 2 + origin.y * cell - pxH / 2,
            };
        }

        return {
            x: pos.x - origin.x * pxW,
            y: pos.y - origin.y * pxH,
        };
    }

    /**
     * Emulate the Canvas2D `applyLineWidth` alpha trick: sub-pixel widths render
     * as a 1px line with proportionally reduced opacity.
     */
    private resolveStroke(color: RGBA, lineWidth: number): { width: number; color: RGBA } {
        if (lineWidth >= 1) return { width: lineWidth, color };
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
        for (const s of segments) this.pushLine(lines, s.a, s.b, color, lineWidth);
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
        rotation: number,
        color: RGBA,
        lineWidth: number,
    ) {
        const cos = Math.cos(rotation);
        const sin = Math.sin(rotation);
        const hw = w / 2;
        const hh = h / 2;
        const corner = (ox: number, oy: number): Coords => ({
            x: cx + ox * cos - oy * sin,
            y: cy + ox * sin + oy * cos,
        });
        const tl = corner(-hw, -hh);
        const tr = corner(hw, -hh);
        const br = corner(hw, hh);
        const bl = corner(-hw, hh);

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
    ) {
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
