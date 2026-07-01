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
    Path,
    Rect,
    SpatialIndex,
    Text,
    VISIBILITY_BUFFER,
} from "@canvas-tile-engine/core";
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
    private colorParser = new ColorParser();

    constructor(private layers: Layer, private transformer: CoordinateTransformer, private camera: ICamera) {}

    private isVisible(
        x: number,
        y: number,
        sizeWorld: number,
        topLeft: Coords,
        config: Required<CanvasTileEngineConfig>
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
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer: number = 1
    ): DrawHandle {
        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            fn(ctx, topLeft, config);
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
                const origin = this.resolveOrigin(item.origin);
                const style = item.style;

                if (!spatialIndex && !this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;
                const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);
                const cx = drawX + pxSize / 2;
                const cy = drawY + pxSize / 2;
                const rotation = (item.rotate ?? 0) * (Math.PI / 180);
                const radius = this.resolveRadius(item.radius, pxSize);

                if (style?.fillStyle) {
                    shapes.push({
                        cx,
                        cy,
                        halfW: pxSize / 2,
                        halfH: pxSize / 2,
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
                        pxSize,
                        pxSize,
                        rotation,
                        this.colorParser.parse(style.strokeStyle),
                        style.lineWidth ?? 1
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
                const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);
                const cx = drawX + radius;
                const cy = drawY + radius;

                if (style?.fillStyle) {
                    shapes.push({
                        cx,
                        cy,
                        halfW: radius,
                        halfH: radius,
                        radius,
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
                        style.lineWidth ?? 1
                    );
                }
            }

            gl.drawShapes(shapes);
            gl.drawLines(lines);
        });
    }

    drawLine(
        items: Array<Line> | Line,
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        return this.layers.add(layer, ({ gl, config, topLeft }) => {
            const color = this.colorParser.parse(style?.strokeStyle ?? "#000");
            const lineWidth = style?.lineWidth ?? 1;
            const lines: LineInstance[] = [];

            for (const item of list) {
                const centerX = (item.from.x + item.to.x) / 2;
                const centerY = (item.from.y + item.to.y) / 2;
                const halfExtent = Math.max(Math.abs(item.from.x - item.to.x), Math.abs(item.from.y - item.to.y)) / 2;
                if (!this.isVisible(centerX, centerY, halfExtent, topLeft, config)) continue;

                const a = this.transformer.worldToScreen(item.from.x, item.from.y);
                const b = this.transformer.worldToScreen(item.to.x, item.to.y);
                this.pushLine(lines, a, b, color, lineWidth);
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

                if (!spatialIndex && !this.isVisible(item.x, item.y, size, topLeft, config)) continue;

                // Scale-aware font size (world units)
                const pxSize = size * this.camera.scale * 0.3;
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

    drawPath(
        items: Array<Path> | Path,
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): DrawHandle {
        const list = Array.isArray(items[0]) ? (items as Array<Coords[]>) : [items as Coords[]];

        return this.layers.add(layer, ({ gl, config, topLeft }) => {
            const color = this.colorParser.parse(style?.strokeStyle ?? "#000");
            const lineWidth = style?.lineWidth ?? 1;
            const lines: LineInstance[] = [];

            for (const points of list) {
                if (points.length < 2) continue;
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

                let prev = this.transformer.worldToScreen(points[0].x, points[0].y);
                for (let i = 1; i < points.length; i++) {
                    const curr = this.transformer.worldToScreen(points[i].x, points[i].y);
                    this.pushLine(lines, prev, curr, color, lineWidth);
                    prev = curr;
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

                // preserve aspect
                const aspect = item.img.width / item.img.height;
                let drawW = pxSize;
                let drawH = pxSize;
                if (aspect > 1) drawH = pxSize / aspect;
                else drawW = pxSize * aspect;

                const { x: baseX, y: baseY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);
                const offsetX = baseX + (pxSize - drawW) / 2;
                const offsetY = baseY + (pxSize - drawH) / 2;
                const rotation = (item.rotate ?? 0) * (Math.PI / 180);

                images.push({
                    texture,
                    x: offsetX,
                    y: offsetY,
                    w: drawW,
                    h: drawH,
                    rotation,
                    alpha: 1,
                });
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

    private resolveRadius(radius: number | number[] | undefined, pxSize: number): number {
        if (radius === undefined) return 0;
        const value = Array.isArray(radius) ? radius[0] ?? 0 : radius;
        return Math.max(0, Math.min(value, pxSize / 2));
    }

    private computeOriginOffset(
        pos: Coords,
        pxSize: number,
        origin: { mode: "cell" | "self"; x: number; y: number },
        camera: ICamera
    ) {
        if (origin.mode === "cell") {
            const cell = camera.scale;
            return {
                x: pos.x - cell / 2 + origin.x * cell - pxSize / 2,
                y: pos.y - cell / 2 + origin.y * cell - pxSize / 2,
            };
        }

        return {
            x: pos.x - origin.x * pxSize,
            y: pos.y - origin.y * pxSize,
        };
    }

    /**
     * Emulate the Canvas2D `applyLineWidth` alpha trick: sub-pixel widths render
     * as a 1px line with proportionally reduced opacity.
     */
    private resolveStroke(color: RGBA, lineWidth: number): { width: number; color: RGBA } {
        if (lineWidth >= 1) return { width: lineWidth, color };
        const alpha = Math.max(0, Math.min(lineWidth, 1));
        return { width: 1, color: [color[0], color[1], color[2], color[3] * alpha] };
    }

    private pushLine(lines: LineInstance[], a: Coords, b: Coords, color: RGBA, lineWidth: number) {
        const stroke = this.resolveStroke(color, lineWidth);
        lines.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, width: stroke.width, color: stroke.color });
    }

    private pushRectStroke(
        lines: LineInstance[],
        cx: number,
        cy: number,
        w: number,
        h: number,
        rotation: number,
        color: RGBA,
        lineWidth: number
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
        this.pushLine(lines, tl, tr, color, lineWidth);
        this.pushLine(lines, tr, br, color, lineWidth);
        this.pushLine(lines, br, bl, color, lineWidth);
        this.pushLine(lines, bl, tl, color, lineWidth);
    }

    private pushCircleStroke(
        lines: LineInstance[],
        cx: number,
        cy: number,
        radius: number,
        color: RGBA,
        lineWidth: number
    ) {
        let prev: Coords = { x: cx + radius, y: cy };
        for (let i = 1; i <= CIRCLE_STROKE_SEGMENTS; i++) {
            const angle = (i / CIRCLE_STROKE_SEGMENTS) * Math.PI * 2;
            const curr: Coords = { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius };
            this.pushLine(lines, prev, curr, color, lineWidth);
            prev = curr;
        }
    }
}
