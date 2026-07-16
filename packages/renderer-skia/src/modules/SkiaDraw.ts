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
    Polygon,
    Rect,
    SpatialIndex,
    Text,
    VISIBILITY_BUFFER,
    resolveLineWidthPx,
    resolveLineDashPx,
    resolveRadiusPx,
    DrawTransform,
} from "@canvas-tile-engine/core";
import type { LineStyle } from "@canvas-tile-engine/core";
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
    type SkPicture,
    type SkRect,
} from "@shopify/react-native-skia";
import { Layer } from "./Layer";
import { DEFAULT_SANS_SERIF } from "../utils/fonts";

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
    /** Transform helpers handed to custom draw callbacks. */
    private drawTransform: DrawTransform = {
        worldToScreen: (x, y) => this.transformer.worldToScreen(x, y),
        screenToWorld: (x, y) => this.transformer.screenToWorld(x, y),
    };
    // Reusable paints, mutated per draw call (draws are immediate within a frame).
    private fillPaint: SkPaint;
    private strokePaint: SkPaint;
    private imagePaint: SkPaint;
    private fontCache = new Map<string, SkFont>();
    private colorCache = new Map<string, SkColor>();
    // Pre-recorded pictures for the drawStatic* variants, keyed by cacheKey.
    private staticPictureCache = new Map<
        string,
        { picture: SkPicture; recordScale: number }
    >();

    constructor(
        private layers: Layer,
        private transformer: CoordinateTransformer,
        private camera: ICamera,
    ) {
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
        config: Required<CanvasTileEngineConfig>,
    ) {
        const viewW = config.size.width / config.scale;
        const viewH = config.size.height / config.scale;
        const minX = topLeft.x - VISIBILITY_BUFFER.TILE_BUFFER;
        const minY = topLeft.y - VISIBILITY_BUFFER.TILE_BUFFER;
        const maxX = topLeft.x + viewW + VISIBILITY_BUFFER.TILE_BUFFER;
        const maxY = topLeft.y + viewH + VISIBILITY_BUFFER.TILE_BUFFER;
        return (
            x + sizeWorld >= minX &&
            x - sizeWorld <= maxX &&
            y + sizeWorld >= minY &&
            y - sizeWorld <= maxY
        );
    }

    private getViewportBounds(
        topLeft: Coords,
        config: Required<CanvasTileEngineConfig>,
    ) {
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
            canvas: SkCanvas,
            coords: Coords,
            config: Required<CanvasTileEngineConfig>,
            transform: DrawTransform,
        ) => void,
        layer: number = 1,
    ): DrawHandle {
        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            fn(canvas, topLeft, config, this.drawTransform);
        });
    }

    drawRect(items: Array<Rect> | Rect, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex
            ? SpatialIndex.fromArray(list)
            : null;

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(
                      bounds.minX,
                      bounds.minY,
                      bounds.maxX,
                      bounds.maxY,
                  )
                : list;

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const extent =
                    Math.max(item.width ?? size, item.height ?? size) / 2;

                if (
                    !spatialIndex &&
                    !this.isVisible(item.x, item.y, extent, topLeft, config)
                )
                    continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                this.paintRect(canvas, item, pos, this.camera.scale);
            }
        });
    }

    /** Paint a single rect at a resolved position; `cellSize` is the pixel size of one world cell. */
    private paintRect(
        canvas: SkCanvas,
        item: Rect,
        pos: Coords,
        cellSize: number,
    ) {
        const size = item.size ?? 1;
        const origin = this.resolveOrigin(item.origin);
        const style = item.style;
        const pxW = (item.width ?? size) * cellSize;
        const pxH = (item.height ?? size) * cellSize;
        const { x: drawX, y: drawY } = this.computeOriginOffset(
            pos,
            pxW,
            pxH,
            origin,
            cellSize,
        );
        const cx = drawX + pxW / 2;
        const cy = drawY + pxH / 2;
        const rotation = item.rotate ?? 0;
        const radius = this.resolveRadius(
            resolveRadiusPx(item.radius, cellSize),
        );

        const count =
            rotation !== 0 ? this.withRotation(canvas, rotation, cx, cy) : -1;

        const rect = Skia.XYWHRect(drawX, drawY, pxW, pxH);
        const rounded = this.hasRadius(radius);
        if (style?.fillStyle) {
            this.fillPaint.setColor(this.color(style.fillStyle));
            if (rounded)
                canvas.drawRRect(this.makeRRect(rect, radius), this.fillPaint);
            else canvas.drawRect(rect, this.fillPaint);
        }
        if (style?.strokeStyle) {
            this.strokePaint.setColor(this.color(style.strokeStyle));
            this.strokePaint.setStrokeWidth(
                resolveLineWidthPx(style, cellSize),
            );
            if (rounded)
                canvas.drawRRect(
                    this.makeRRect(rect, radius),
                    this.strokePaint,
                );
            else canvas.drawRect(rect, this.strokePaint);
        }

        if (count !== -1) canvas.restoreToCount(count);
    }

    drawCircle(items: Array<Circle> | Circle, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex
            ? SpatialIndex.fromArray(list)
            : null;

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(
                      bounds.minX,
                      bounds.minY,
                      bounds.maxX,
                      bounds.maxY,
                  )
                : list;

            for (const item of visibleItems) {
                const size = item.size ?? 1;

                if (
                    !spatialIndex &&
                    !this.isVisible(item.x, item.y, size / 2, topLeft, config)
                )
                    continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                this.paintCircle(canvas, item, pos, this.camera.scale);
            }
        });
    }

    /** Paint a single circle at a resolved position; `cellSize` is the pixel size of one world cell. */
    private paintCircle(
        canvas: SkCanvas,
        item: Circle,
        pos: Coords,
        cellSize: number,
    ) {
        const size = item.size ?? 1;
        const origin = this.resolveOrigin(item.origin);
        const style = item.style;
        const pxSize = size * cellSize;
        const radius = pxSize / 2;
        const { x: drawX, y: drawY } = this.computeOriginOffset(
            pos,
            pxSize,
            pxSize,
            origin,
            cellSize,
        );
        const cx = drawX + radius;
        const cy = drawY + radius;

        if (style?.fillStyle) {
            this.fillPaint.setColor(this.color(style.fillStyle));
            canvas.drawCircle(cx, cy, radius, this.fillPaint);
        }
        if (style?.strokeStyle) {
            this.strokePaint.setColor(this.color(style.strokeStyle));
            this.strokePaint.setStrokeWidth(
                resolveLineWidthPx(style, cellSize),
            );
            canvas.drawCircle(cx, cy, radius, this.strokePaint);
        }
    }

    drawLine(
        items: Array<Line> | Line,
        style?: LineStyle,
        layer: number = 1,
    ): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            this.strokePaint.setColor(
                this.color(style?.strokeStyle ?? "#000000"),
            );
            this.strokePaint.setStrokeWidth(
                resolveLineWidthPx(style, this.camera.scale),
            );
            const dash = resolveLineDashPx(style, this.camera.scale);
            if (dash)
                this.strokePaint.setPathEffect(
                    Skia.PathEffect.MakeDash(dash, 0),
                );

            for (const item of list) {
                const centerX = (item.from.x + item.to.x) / 2;
                const centerY = (item.from.y + item.to.y) / 2;
                const halfExtent =
                    Math.max(
                        Math.abs(item.from.x - item.to.x),
                        Math.abs(item.from.y - item.to.y),
                    ) / 2;
                if (
                    !this.isVisible(
                        centerX,
                        centerY,
                        halfExtent,
                        topLeft,
                        config,
                    )
                )
                    continue;

                const a = this.transformer.worldToScreen(
                    item.from.x,
                    item.from.y,
                );
                const b = this.transformer.worldToScreen(item.to.x, item.to.y);
                canvas.drawLine(a.x, a.y, b.x, b.y, this.strokePaint);
            }
            if (dash) this.strokePaint.setPathEffect(null);
        });
    }

    drawText(items: Array<Text> | Text, layer: number = 2): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex
            ? SpatialIndex.fromArray(list)
            : null;

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(
                      bounds.minX,
                      bounds.minY,
                      bounds.maxX,
                      bounds.maxY,
                  )
                : list;

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const style = item.style;

                // fontPx is zoom-independent; its world-space extent shrinks as scale grows
                const extentWorld =
                    item.fontPx !== undefined
                        ? item.fontPx / this.camera.scale
                        : size;

                if (
                    !spatialIndex &&
                    !this.isVisible(
                        item.x,
                        item.y,
                        extentWorld,
                        topLeft,
                        config,
                    )
                )
                    continue;

                // Font sizing matches the Canvas2D renderer: fontPx wins, else size * scale.
                const pxSize = item.fontPx ?? size * this.camera.scale;
                const font = this.getFont(
                    style?.fontFamily ?? DEFAULT_SANS_SERIF,
                    pxSize,
                );
                this.fillPaint.setColor(
                    this.color(style?.fillStyle ?? "#000000"),
                );

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const { x, y } = this.alignText(
                    item.text,
                    pos,
                    font,
                    style?.textAlign,
                    style?.textBaseline,
                );

                const rotation = item.rotate ?? 0;
                const count =
                    rotation !== 0
                        ? this.withRotation(canvas, rotation, pos.x, pos.y)
                        : -1;
                canvas.drawText(item.text, x, y, this.fillPaint, font);
                if (count !== -1) canvas.restoreToCount(count);
            }
        });
    }

    drawPath(
        items: Array<Path> | Path,
        style?: LineStyle,
        layer: number = 1,
    ): DrawHandle {
        const list = Array.isArray(items[0])
            ? (items as Array<Coords[]>)
            : [items as Coords[]];

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            this.strokePaint.setColor(
                this.color(style?.strokeStyle ?? "#000000"),
            );
            this.strokePaint.setStrokeWidth(
                resolveLineWidthPx(style, this.camera.scale),
            );
            const dash = resolveLineDashPx(style, this.camera.scale);
            if (dash)
                this.strokePaint.setPathEffect(
                    Skia.PathEffect.MakeDash(dash, 0),
                );

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
                if (
                    !this.isVisible(
                        centerX,
                        centerY,
                        halfExtent,
                        topLeft,
                        config,
                    )
                )
                    continue;

                const path = Skia.Path.Make();
                const first = this.transformer.worldToScreen(
                    points[0].x,
                    points[0].y,
                );
                path.moveTo(first.x, first.y);
                for (let i = 1; i < points.length; i++) {
                    const p = this.transformer.worldToScreen(
                        points[i].x,
                        points[i].y,
                    );
                    path.lineTo(p.x, p.y);
                }
                canvas.drawPath(path, this.strokePaint);
            }
            if (dash) this.strokePaint.setPathEffect(null);
        });
    }

    drawPolygon(items: Array<Polygon> | Polygon, layer: number = 1): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            for (const item of list) {
                const points = item.points;
                if (points.length < 3) continue;
                const xs = points.map((p) => p.x);
                const ys = points.map((p) => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                const halfExtent = Math.max(maxX - minX, maxY - minY) / 2;
                if (!this.isVisible(centerX, centerY, halfExtent, topLeft, config))
                    continue;

                const path = Skia.Path.Make();
                const first = this.transformer.worldToScreen(
                    points[0].x,
                    points[0].y,
                );
                path.moveTo(first.x, first.y);
                for (let i = 1; i < points.length; i++) {
                    const p = this.transformer.worldToScreen(
                        points[i].x,
                        points[i].y,
                    );
                    path.lineTo(p.x, p.y);
                }
                path.close();

                const style = item.style;
                if (style?.fillStyle) {
                    this.fillPaint.setColor(this.color(style.fillStyle));
                    canvas.drawPath(path, this.fillPaint);
                }
                if (style?.strokeStyle) {
                    this.strokePaint.setColor(this.color(style.strokeStyle));
                    this.strokePaint.setStrokeWidth(
                        resolveLineWidthPx(style, this.camera.scale),
                    );
                    canvas.drawPath(path, this.strokePaint);
                }
            }
        });
    }

    drawImage(
        items: Array<ImageItem<SkImage>> | ImageItem<SkImage>,
        layer: number = 1,
    ): DrawHandle {
        const list = Array.isArray(items) ? items : [items];

        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex
            ? SpatialIndex.fromArray(list)
            : null;

        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(
                      bounds.minX,
                      bounds.minY,
                      bounds.maxX,
                      bounds.maxY,
                  )
                : list;

            for (const item of visibleItems) {
                const size = item.size ?? 1;

                if (
                    !spatialIndex &&
                    !this.isVisible(item.x, item.y, size / 2, topLeft, config)
                )
                    continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                this.paintImage(canvas, item, pos, this.camera.scale);
            }
        });
    }

    /** Paint a single image at a resolved position; `cellSize` is the pixel size of one world cell. */
    private paintImage(
        canvas: SkCanvas,
        item: ImageItem<SkImage>,
        pos: Coords,
        cellSize: number,
    ) {
        const size = item.size ?? 1;
        const origin = this.resolveOrigin(item.origin);

        const img = item.img;
        const imgW = img.width();
        const imgH = img.height();
        if (!imgW || !imgH) return;

        const pxSize = size * cellSize;

        // Spritesheet source rect; defaults to the whole image
        const srcX = item.sprite?.x ?? 0;
        const srcY = item.sprite?.y ?? 0;
        const srcW = item.sprite?.w ?? imgW;
        const srcH = item.sprite?.h ?? imgH;

        // preserve aspect (of the sprite frame when one is set)
        const aspect = srcW / srcH;
        let drawW = pxSize;
        let drawH = pxSize;
        if (aspect > 1) drawH = pxSize / aspect;
        else drawW = pxSize * aspect;

        const { x: baseX, y: baseY } = this.computeOriginOffset(
            pos,
            pxSize,
            pxSize,
            origin,
            cellSize,
        );
        const offsetX = baseX + (pxSize - drawW) / 2;
        const offsetY = baseY + (pxSize - drawH) / 2;
        const rotation = item.rotate ?? 0;

        const cx = offsetX + drawW / 2;
        const cy = offsetY + drawH / 2;
        const count =
            rotation !== 0 ? this.withRotation(canvas, rotation, cx, cy) : -1;

        const src = Skia.XYWHRect(srcX, srcY, srcW, srcH);
        const dest = Skia.XYWHRect(offsetX, offsetY, drawW, drawH);
        // Skia snapshots paint state at draw time, so mutating the shared paint
        // per item is safe (same pattern as fill/stroke paints).
        const opacity = item.opacity ?? 1;
        if (opacity !== 1) this.imagePaint.setAlphaf(opacity);
        canvas.drawImageRect(img, src, dest, this.imagePaint);
        if (opacity !== 1) this.imagePaint.setAlphaf(1);

        if (count !== -1) canvas.restoreToCount(count);
    }

    drawGridLines(
        cellSize: number,
        style: { strokeStyle: string; lineWidth: number },
        layer: number = 0,
    ): DrawHandle {
        return this.layers.add(layer, ({ canvas, config, topLeft }) => {
            const viewW = config.size.width / config.scale;
            const viewH = config.size.height / config.scale;

            const startX =
                Math.floor(topLeft.x / cellSize) * cellSize -
                DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endX =
                Math.ceil((topLeft.x + viewW) / cellSize) * cellSize -
                DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const startY =
                Math.floor(topLeft.y / cellSize) * cellSize -
                DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endY =
                Math.ceil((topLeft.y + viewH) / cellSize) * cellSize -
                DEFAULT_VALUES.CELL_CENTER_OFFSET;

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
    // Unlike the dynamic draw* methods, which re-issue one Skia call per visible
    // item on every frame (each a JSI hop on React Native), the static variants
    // record the full item set once into an SkPicture and replay it per frame
    // with a single drawPicture under the camera transform. Replay cost is a
    // handful of calls regardless of item count — this is the Skia equivalent
    // of the Canvas2D renderer's offscreen cache. The picture is recorded at
    // the camera scale active at record time and replayed under the camera
    // transform, so world-unit style values (lineWidth, radius) scale with
    // zoom exactly as intended. Pixel-denominated opt-ins (lineWidthPx) are
    // baked in at the record scale and scale along on replay — use the
    // dynamic draw methods when a zoom-independent px width must hold.

    drawStaticRect(
        items: Array<Rect>,
        cacheKey: string,
        layer: number = 1,
    ): DrawHandle {
        return this.addStaticPictureLayer(
            cacheKey,
            items,
            layer,
            (canvas, item, pos, cellSize) =>
                this.paintRect(canvas, item, pos, cellSize),
        );
    }

    drawStaticCircle(
        items: Array<Circle>,
        cacheKey: string,
        layer: number = 1,
    ): DrawHandle {
        return this.addStaticPictureLayer(
            cacheKey,
            items,
            layer,
            (canvas, item, pos, cellSize) =>
                this.paintCircle(canvas, item, pos, cellSize),
        );
    }

    drawStaticImage(
        items: Array<ImageItem<SkImage>>,
        cacheKey: string,
        layer: number = 1,
    ): DrawHandle {
        return this.addStaticPictureLayer(
            cacheKey,
            items,
            layer,
            (canvas, item, pos, cellSize) =>
                this.paintImage(canvas, item, pos, cellSize),
        );
    }

    clearStaticCache(cacheKey?: string) {
        // Only drop the references: a still-registered layer callback may keep
        // replaying its picture, so native memory is reclaimed by the GC
        // finalizer rather than an explicit dispose here.
        if (cacheKey === undefined) this.staticPictureCache.clear();
        else this.staticPictureCache.delete(cacheKey);
    }

    /**
     * Register a layer callback that replays a cached picture of `items` under
     * the current camera transform, recording it first if `cacheKey` is new.
     */
    private addStaticPictureLayer<
        T extends { x: number; y: number; size?: number },
    >(
        cacheKey: string,
        items: T[],
        layer: number,
        paintItem: (
            canvas: SkCanvas,
            item: T,
            pos: Coords,
            cellSize: number,
        ) => void,
    ): DrawHandle {
        if (items.length === 0) {
            return this.layers.add(layer, () => {});
        }

        let entry = this.staticPictureCache.get(cacheKey);
        if (!entry) {
            entry = this.recordStaticPicture(items, paintItem);
            this.staticPictureCache.set(cacheKey, entry);
        }
        const { picture, recordScale } = entry;

        return this.layers.add(layer, ({ canvas, topLeft }) => {
            // worldToScreen(w) = (w + CELL_CENTER_OFFSET - topLeft) * scale, and
            // the picture was recorded with a camera at (0, 0, recordScale), so
            // the recorded coordinates only miss the -topLeft term and the
            // scale ratio.
            const scale = this.camera.scale;
            const count = canvas.save();
            canvas.translate(-topLeft.x * scale, -topLeft.y * scale);
            canvas.scale(scale / recordScale, scale / recordScale);
            canvas.drawPicture(picture);
            canvas.restoreToCount(count);
        });
    }

    /** Record `items` into a picture using a camera fixed at (0, 0) and the current scale. */
    private recordStaticPicture<
        T extends { x: number; y: number; size?: number },
    >(
        items: T[],
        paintItem: (
            canvas: SkCanvas,
            item: T,
            pos: Coords,
            cellSize: number,
        ) => void,
    ): { picture: SkPicture; recordScale: number } {
        const recordScale = this.camera.scale;

        // Cull rect covering all items, padded by one world unit for origin
        // offsets and rotation — same bounds heuristic as the Canvas2D cache.
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const item of items) {
            const half = (item.size ?? 1) / 2;
            if (item.x - half < minX) minX = item.x - half;
            if (item.x + half > maxX) maxX = item.x + half;
            if (item.y - half < minY) minY = item.y - half;
            if (item.y + half > maxY) maxY = item.y + half;
        }
        minX -= 1;
        minY -= 1;
        maxX += 1;
        maxY += 1;

        const recorder = Skia.PictureRecorder();
        const canvas = recorder.beginRecording(
            Skia.XYWHRect(
                (minX + DEFAULT_VALUES.CELL_CENTER_OFFSET) * recordScale,
                (minY + DEFAULT_VALUES.CELL_CENTER_OFFSET) * recordScale,
                (maxX - minX) * recordScale,
                (maxY - minY) * recordScale,
            ),
        );

        for (const item of items) {
            const pos = {
                x: (item.x + DEFAULT_VALUES.CELL_CENTER_OFFSET) * recordScale,
                y: (item.y + DEFAULT_VALUES.CELL_CENTER_OFFSET) * recordScale,
            };
            paintItem(canvas, item, pos, recordScale);
        }

        return { picture: recorder.finishRecordingAsPicture(), recordScale };
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
        this.staticPictureCache.clear();
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

    private resolveOrigin(
        origin: { mode?: string; x?: number; y?: number } | undefined,
    ): {
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
    private resolveRadius(
        radius: number | number[] | undefined,
    ): number | [number, number, number, number] {
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

    private hasRadius(
        radius: number | [number, number, number, number],
    ): boolean {
        return Array.isArray(radius) ? radius.some((r) => r > 0) : radius > 0;
    }

    /** Builds an `InputRRect` from a resolved radius, using a non-uniform RRect for per-corner values. */
    private makeRRect(
        rect: SkRect,
        radius: number | [number, number, number, number],
    ): InputRRect {
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
        pxW: number,
        pxH: number,
        origin: { mode: "cell" | "self"; x: number; y: number },
        cellSize: number,
    ) {
        if (origin.mode === "cell") {
            const cell = cellSize;
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

    /** Save the canvas and rotate (degrees) about a pivot. Returns the save count. */
    private withRotation(
        canvas: SkCanvas,
        degrees: number,
        px: number,
        py: number,
    ): number {
        const count = canvas.save();
        canvas.rotate(degrees, px, py);
        return count;
    }

    /**
     * One cached font per family; the size is set per call so text scales
     * continuously with zoom (fonts are snapshotted into the recorded picture
     * at draw time, so mutating the shared instance between draws is safe).
     */
    private getFont(family: string, size: number): SkFont {
        let font = this.fontCache.get(family);
        if (!font) {
            font = matchFont({ fontFamily: family, fontSize: size });
            this.fontCache.set(family, font);
        }
        font.setSize(size);
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
        textBaseline: string | undefined,
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
