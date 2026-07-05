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
import {
    matchFont,
    PaintStyle,
    Skia,
    type InputRRect,
    type SkCanvas,
    type SkColor,
    type SkFont,
    type SkImage,
    type SkPaint,
    type SkRect,
} from "@shopify/react-native-skia";
import { Layer } from "./Layer";

// Threshold for using spatial indexing (below this, linear scan is faster)
const SPATIAL_INDEX_THRESHOLD = 500;

/**
 * Skia implementation of the engine draw API.
 *
 * Mirrors the Canvas2D `CanvasDraw` (culling, spatial indexing, origin handling,
 * rotation), drawing each primitive directly onto the `SkCanvas` that is being
 * recorded into the current frame's picture. Colors are parsed by Skia itself,
 * so no DOM color parser is needed.
 * @internal
 */
export class SkiaDraw {
    // Reusable paints, mutated per draw call (draws are immediate within a frame).
    private fillPaint: SkPaint;
    private strokePaint: SkPaint;
    private imagePaint: SkPaint;
    private fontCache = new Map<string, SkFont>();
    private colorCache = new Map<string, SkColor>();

    constructor(private layers: Layer, private transformer: CoordinateTransformer, private camera: ICamera) {
        this.fillPaint = Skia.Paint();
        this.fillPaint.setAntiAlias(true);
        this.fillPaint.setStyle(PaintStyle.Fill);

        this.strokePaint = Skia.Paint();
        this.strokePaint.setAntiAlias(true);
        this.strokePaint.setStyle(PaintStyle.Stroke);

        this.imagePaint = Skia.Paint();
        this.imagePaint.setAntiAlias(true);
    }

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
        fn: (canvas: SkCanvas, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer: number = 1
    ): DrawHandle {
        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            fn(canvas, topLeft, config);
        });
    }

    drawRect(items: Array<Rect> | Rect, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

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
                const rotation = item.rotate ?? 0;
                const radius = this.resolveRadius(item.radius);

                const count = rotation !== 0 ? this.withRotation(canvas, rotation, cx, cy) : -1;

                const rect = Skia.XYWHRect(drawX, drawY, pxSize, pxSize);
                const rounded = this.hasRadius(radius);
                if (style?.fillStyle) {
                    this.fillPaint.setColor(this.color(style.fillStyle));
                    if (rounded) canvas.drawRRect(this.makeRRect(rect, radius), this.fillPaint);
                    else canvas.drawRect(rect, this.fillPaint);
                }
                if (style?.strokeStyle) {
                    this.strokePaint.setColor(this.color(style.strokeStyle));
                    this.strokePaint.setStrokeWidth(style.lineWidth ?? 1);
                    if (rounded) canvas.drawRRect(this.makeRRect(rect, radius), this.strokePaint);
                    else canvas.drawRect(rect, this.strokePaint);
                }

                if (count !== -1) canvas.restoreToCount(count);
            }
        });
    }

    drawCircle(items: Array<Circle> | Circle, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

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
                    this.fillPaint.setColor(this.color(style.fillStyle));
                    canvas.drawCircle(cx, cy, radius, this.fillPaint);
                }
                if (style?.strokeStyle) {
                    this.strokePaint.setColor(this.color(style.strokeStyle));
                    this.strokePaint.setStrokeWidth(style.lineWidth ?? 1);
                    canvas.drawCircle(cx, cy, radius, this.strokePaint);
                }
            }
        });
    }

    drawLine(
        items: Array<Line> | Line,
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            this.strokePaint.setColor(this.color(style?.strokeStyle ?? "#000000"));
            this.strokePaint.setStrokeWidth(style?.lineWidth ?? 1);

            for (const item of list) {
                const centerX = (item.from.x + item.to.x) / 2;
                const centerY = (item.from.y + item.to.y) / 2;
                const halfExtent = Math.max(Math.abs(item.from.x - item.to.x), Math.abs(item.from.y - item.to.y)) / 2;
                if (!this.isVisible(centerX, centerY, halfExtent, topLeft, config)) continue;

                const a = this.transformer.worldToScreen(item.from.x, item.from.y);
                const b = this.transformer.worldToScreen(item.to.x, item.to.y);
                canvas.drawLine(a.x, a.y, b.x, b.y, this.strokePaint);
            }
        });
    }

    drawText(items: Array<Text> | Text, layer: number = 2): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const style = item.style;

                if (!spatialIndex && !this.isVisible(item.x, item.y, size, topLeft, config)) continue;

                // Scale-aware font size (world units), matching the Canvas2D renderer.
                const pxSize = size * this.camera.scale * 0.3;
                const font = this.getFont(style?.fontFamily ?? "sans-serif", pxSize);
                this.fillPaint.setColor(this.color(style?.fillStyle ?? "#000000"));

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const { x, y } = this.alignText(item.text, pos, font, style?.textAlign, style?.textBaseline);

                const rotation = item.rotate ?? 0;
                const count = rotation !== 0 ? this.withRotation(canvas, rotation, pos.x, pos.y) : -1;
                canvas.drawText(item.text, x, y, this.fillPaint, font);
                if (count !== -1) canvas.restoreToCount(count);
            }
        });
    }

    drawPath(
        items: Array<Path> | Path,
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): DrawHandle {
        const list = Array.isArray(items[0]) ? (items as Array<Coords[]>) : [items as Coords[]];

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            this.strokePaint.setColor(this.color(style?.strokeStyle ?? "#000000"));
            this.strokePaint.setStrokeWidth(style?.lineWidth ?? 1);

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

                const path = Skia.Path.Make();
                const first = this.transformer.worldToScreen(points[0].x, points[0].y);
                path.moveTo(first.x, first.y);
                for (let i = 1; i < points.length; i++) {
                    const p = this.transformer.worldToScreen(points[i].x, points[i].y);
                    path.lineTo(p.x, p.y);
                }
                canvas.drawPath(path, this.strokePaint);
            }
        });
    }

    drawImage(items: Array<ImageItem<SkImage>> | ImageItem<SkImage>, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const origin = this.resolveOrigin(item.origin);

                if (!spatialIndex && !this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const img = item.img;
                const imgW = img.width();
                const imgH = img.height();
                if (!imgW || !imgH) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;

                // preserve aspect
                const aspect = imgW / imgH;
                let drawW = pxSize;
                let drawH = pxSize;
                if (aspect > 1) drawH = pxSize / aspect;
                else drawW = pxSize * aspect;

                const { x: baseX, y: baseY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);
                const offsetX = baseX + (pxSize - drawW) / 2;
                const offsetY = baseY + (pxSize - drawH) / 2;
                const rotation = item.rotate ?? 0;

                const cx = offsetX + drawW / 2;
                const cy = offsetY + drawH / 2;
                const count = rotation !== 0 ? this.withRotation(canvas, rotation, cx, cy) : -1;

                const src = Skia.XYWHRect(0, 0, imgW, imgH);
                const dest = Skia.XYWHRect(offsetX, offsetY, drawW, drawH);
                canvas.drawImageRect(img, src, dest, this.imagePaint);

                if (count !== -1) canvas.restoreToCount(count);
            }
        });
    }

    drawGridLines(cellSize: number, style: { strokeStyle: string; lineWidth: number }, layer: number = 0): DrawHandle {
        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const viewW = config.size.width / config.scale;
            const viewH = config.size.height / config.scale;

            const startX = Math.floor(topLeft.x / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endX = Math.ceil((topLeft.x + viewW) / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const startY = Math.floor(topLeft.y / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endY = Math.ceil((topLeft.y + viewH) / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;

            this.strokePaint.setColor(this.color(style.strokeStyle));
            this.strokePaint.setStrokeWidth(style.lineWidth);

            for (let x = startX; x <= endX; x += cellSize) {
                const p1 = this.transformer.worldToScreen(x, startY);
                const p2 = this.transformer.worldToScreen(x, endY);
                canvas.drawLine(p1.x, p1.y, p2.x, p2.y, this.strokePaint);
            }

            for (let y = startY; y <= endY; y += cellSize) {
                const p1 = this.transformer.worldToScreen(startX, y);
                const p2 = this.transformer.worldToScreen(endX, y);
                canvas.drawLine(p1.x, p1.y, p2.x, p2.y, this.strokePaint);
            }
        });
    }

    // ─── Static variants ───
    //
    // Skia records each layer into the frame picture in a single pass, so the
    // offscreen pre-render cache used by the Canvas2D renderer is unnecessary;
    // the static variants reuse the dynamic path.

    drawStaticRect(items: Array<Rect>, _cacheKey: string, layer: number = 1): DrawHandle {
        return this.drawRect(items, layer);
    }

    drawStaticCircle(items: Array<Circle>, _cacheKey: string, layer: number = 1): DrawHandle {
        return this.drawCircle(items, layer);
    }

    drawStaticImage(items: Array<ImageItem<SkImage>>, _cacheKey: string, layer: number = 1): DrawHandle {
        return this.drawImage(items, layer);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    clearStaticCache(_cacheKey?: string) {
        // No offscreen caches are kept in the Skia renderer.
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

    destroy() {
        this.layers.clear();
        this.fontCache.clear();
        this.colorCache.clear();
    }

    // ─── Helpers ───

    /**
     * Parse a CSS color string once and reuse the result — `Skia.Color` is a
     * native parse per call, which adds up over thousands of items per frame.
     */
    private color(value: string): SkColor {
        let parsed = this.colorCache.get(value);
        if (!parsed) {
            parsed = Skia.Color(value);
            this.colorCache.set(value, parsed);
        }
        return parsed;
    }

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
     * Resolves `Rect.radius` into either a single uniform radius or a
     * per-corner `[topLeft, topRight, bottomRight, bottomLeft]` tuple,
     * matching the Canvas2D backend's `ctx.roundRect` corner semantics:
     * shorter arrays expand CSS-style ([all], [tl+br, tr+bl], [tl, tr+bl, br]).
     * Overflow handling is left to Skia's RRect, which scales radii down
     * proportionally to fit the rect just like `roundRect` does.
     */
    private resolveRadius(radius: number | number[] | undefined): number | [number, number, number, number] {
        if (radius === undefined) return 0;
        if (!Array.isArray(radius)) return Math.max(0, radius);

        const r = radius.map((v) => Math.max(0, v ?? 0));
        switch (r.length) {
            case 0:
                return 0;
            case 1:
                return r[0];
            case 2:
                return [r[0], r[1], r[0], r[1]];
            case 3:
                return [r[0], r[1], r[2], r[1]];
            default:
                return [r[0], r[1], r[2], r[3]];
        }
    }

    private hasRadius(radius: number | [number, number, number, number]): boolean {
        return Array.isArray(radius) ? radius.some((r) => r > 0) : radius > 0;
    }

    /** Builds an `InputRRect` from a resolved radius, using a non-uniform RRect for per-corner values. */
    private makeRRect(rect: SkRect, radius: number | [number, number, number, number]): InputRRect {
        if (!Array.isArray(radius)) return Skia.RRectXY(rect, radius, radius);

        const [topLeft, topRight, bottomRight, bottomLeft] = radius;
        return {
            rect,
            topLeft: { x: topLeft, y: topLeft },
            topRight: { x: topRight, y: topRight },
            bottomRight: { x: bottomRight, y: bottomRight },
            bottomLeft: { x: bottomLeft, y: bottomLeft },
        };
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

    /** Save the canvas and rotate (degrees) about a pivot. Returns the save count. */
    private withRotation(canvas: SkCanvas, degrees: number, px: number, py: number): number {
        const count = canvas.save();
        canvas.rotate(degrees, px, py);
        return count;
    }

    private getFont(family: string, size: number): SkFont {
        const px = Math.max(1, Math.round(size));
        const key = `${family}|${px}`;
        let font = this.fontCache.get(key);
        if (!font) {
            font = matchFont({ fontFamily: family, fontSize: px });
            this.fontCache.set(key, font);
        }
        return font;
    }

    /**
     * Map Canvas2D-style text alignment/baseline onto Skia's baseline-left
     * `drawText` origin by offsetting the draw position.
     */
    private alignText(
        text: string,
        pos: Coords,
        font: SkFont,
        textAlign: string | undefined,
        textBaseline: string | undefined
    ): Coords {
        let x = pos.x;
        let y = pos.y;

        const width = font.measureText(text).width;
        switch (textAlign ?? "center") {
            case "center":
                x -= width / 2;
                break;
            case "right":
            case "end":
                x -= width;
                break;
            // "left" / "start" -> no offset
        }

        const metrics = font.getMetrics();
        // metrics.ascent is negative (above baseline), descent positive (below).
        switch (textBaseline ?? "middle") {
            case "middle":
                y -= (metrics.ascent + metrics.descent) / 2;
                break;
            case "top":
            case "hanging":
                y -= metrics.ascent;
                break;
            case "bottom":
            case "ideographic":
                y -= metrics.descent;
                break;
            // "alphabetic" -> baseline, no offset
        }

        return { x, y };
    }
}
