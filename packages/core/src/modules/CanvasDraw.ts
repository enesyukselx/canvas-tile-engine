import { Coords, CanvasTileEngineConfig, Rect, Circle, Text, Path, ImageItem } from "../types";
import { ICamera } from "./Camera";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { Layer, type LayerHandle } from "./Layer";
import { DEFAULT_VALUES, VISIBILITY_BUFFER } from "../constants";
import { SpatialIndex } from "./SpatialIndex";
import { applyLineWidth } from "../utils/canvas";

// Threshold for using spatial indexing (below this, linear scan is faster)
const SPATIAL_INDEX_THRESHOLD = 500;
// Conservative max dimension for offscreen static cache (browser limits often 16384 or 32767)
const MAX_STATIC_CANVAS_DIMENSION = 16384;

// Cache for static layers (pre-rendered offscreen canvases)
interface StaticCache {
    canvas: OffscreenCanvas | HTMLCanvasElement;
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
    worldBounds: { minX: number; minY: number; maxX: number; maxY: number };
    scale: number;
}

/**
 * Canvas-specific helpers for adding draw callbacks to the layer stack.
 * @internal
 */
export class CanvasDraw {
    private staticCaches = new Map<string, StaticCache>();
    private staticCacheSupported: boolean;
    private warnedStaticCacheDisabled = false;

    constructor(private layers: Layer, private transformer: CoordinateTransformer, private camera: ICamera) {
        this.staticCacheSupported = typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined";
    }

    /**
     * Register a generic draw callback; receives raw context, current coords, and config.
     * @param fn Callback invoked during render.
     * @param layer Layer order (lower draws first).
     */

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
    ): LayerHandle {
        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            fn(ctx, topLeft, config);
        });
    }

    drawRect(items: Array<Rect> | Rect, layer: number = 1): LayerHandle {
        const list = Array.isArray(items) ? items : [items];

        // Build spatial index for large datasets (RBush R-Tree)
        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            ctx.save();
            let lastFillStyle: string | undefined;
            let lastStrokeStyle: string | undefined;
            let lastLineWidth: number | undefined;

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const origin = {
                    mode: item.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                    x: item.origin?.x ?? 0.5,
                    y: item.origin?.y ?? 0.5,
                };
                const style = item.style;

                // Skip visibility check if using spatial index (already filtered)
                if (!spatialIndex && !this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;
                const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

                // Only update style when changed (reduces state changes)
                if (style?.fillStyle && style.fillStyle !== lastFillStyle) {
                    ctx.fillStyle = style.fillStyle;
                    lastFillStyle = style.fillStyle;
                }
                if (style?.strokeStyle && style.strokeStyle !== lastStrokeStyle) {
                    ctx.strokeStyle = style.strokeStyle;
                    lastStrokeStyle = style.strokeStyle;
                }

                let resetAlpha: (() => void) | undefined;
                if (style?.lineWidth && style.lineWidth !== lastLineWidth) {
                    resetAlpha = applyLineWidth(ctx, style.lineWidth);
                    lastLineWidth = style.lineWidth;
                }

                const rotationDeg = item.rotate ?? 0;
                const rotation = rotationDeg * (Math.PI / 180);

                const radius = item.radius;

                if (rotationDeg !== 0) {
                    const centerX = drawX + pxSize / 2;
                    const centerY = drawY + pxSize / 2;
                    ctx.save();
                    ctx.translate(centerX, centerY);
                    ctx.rotate(rotation);
                    ctx.beginPath();
                    if (radius && ctx.roundRect) {
                        ctx.roundRect(-pxSize / 2, -pxSize / 2, pxSize, pxSize, radius);
                    } else {
                        ctx.rect(-pxSize / 2, -pxSize / 2, pxSize, pxSize);
                    }
                    if (style?.fillStyle) ctx.fill();
                    if (style?.strokeStyle) ctx.stroke();
                    ctx.restore();
                } else {
                    ctx.beginPath();
                    if (radius && ctx.roundRect) {
                        ctx.roundRect(drawX, drawY, pxSize, pxSize, radius);
                    } else {
                        ctx.rect(drawX, drawY, pxSize, pxSize);
                    }
                    if (style?.fillStyle) ctx.fill();
                    if (style?.strokeStyle) ctx.stroke();
                }

                resetAlpha?.();
            }
            ctx.restore();
        });
    }

    drawLine(
        items: Array<{ from: Coords; to: Coords }> | { from: Coords; to: Coords },
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): LayerHandle {
        const list = Array.isArray(items) ? items : [items];

        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            ctx.save();
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;

            const resetAlpha = style?.lineWidth ? applyLineWidth(ctx, style.lineWidth) : undefined;

            ctx.beginPath();
            for (const item of list) {
                const centerX = (item.from.x + item.to.x) / 2;
                const centerY = (item.from.y + item.to.y) / 2;
                const halfExtent = Math.max(Math.abs(item.from.x - item.to.x), Math.abs(item.from.y - item.to.y)) / 2;
                if (!this.isVisible(centerX, centerY, halfExtent, topLeft, config)) continue;

                const a = this.transformer.worldToScreen(item.from.x, item.from.y);
                const b = this.transformer.worldToScreen(item.to.x, item.to.y);

                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
            }
            ctx.stroke();

            resetAlpha?.();
            ctx.restore();
        });
    }

    drawCircle(items: Array<Circle> | Circle, layer: number = 1): LayerHandle {
        const list = Array.isArray(items) ? items : [items];

        // Build spatial index for large datasets (RBush R-Tree)
        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            ctx.save();
            let lastFillStyle: string | undefined;
            let lastStrokeStyle: string | undefined;
            let lastLineWidth: number | undefined;

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const origin = {
                    mode: item.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                    x: item.origin?.x ?? 0.5,
                    y: item.origin?.y ?? 0.5,
                };
                const style = item.style;

                // Skip visibility check if using spatial index (already filtered)
                if (!spatialIndex && !this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;
                const radius = pxSize / 2;
                const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

                // Only update style when changed
                if (style?.fillStyle && style.fillStyle !== lastFillStyle) {
                    ctx.fillStyle = style.fillStyle;
                    lastFillStyle = style.fillStyle;
                }
                if (style?.strokeStyle && style.strokeStyle !== lastStrokeStyle) {
                    ctx.strokeStyle = style.strokeStyle;
                    lastStrokeStyle = style.strokeStyle;
                }

                let resetAlpha: (() => void) | undefined;
                if (style?.lineWidth && style.lineWidth !== lastLineWidth) {
                    resetAlpha = applyLineWidth(ctx, style.lineWidth);
                    lastLineWidth = style.lineWidth;
                }

                ctx.beginPath();
                ctx.arc(drawX + radius, drawY + radius, radius, 0, Math.PI * 2);
                if (style?.fillStyle) ctx.fill();
                if (style?.strokeStyle) ctx.stroke();

                resetAlpha?.();
            }
            ctx.restore();
        });
    }

    drawText(items: Array<Text> | Text, layer: number = 2): LayerHandle {
        const list = Array.isArray(items) ? items : [items];

        // Build spatial index for large datasets (RBush R-Tree)
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

                // Skip visibility check if using spatial index (already filtered)
                if (!spatialIndex && !this.isVisible(item.x, item.y, size, topLeft, config)) continue;

                // Scale-aware font size (world units)
                const pxSize = size * this.camera.scale * 0.3;
                const family = style?.fontFamily ?? "sans-serif";
                ctx.font = `${pxSize}px ${family}`;

                if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
                ctx.textAlign = style?.textAlign ?? "center";
                ctx.textBaseline = style?.textBaseline ?? "middle";

                const pos = this.transformer.worldToScreen(item.x, item.y);
                ctx.fillText(item.text, pos.x, pos.y);
            }
            ctx.restore();
        });
    }

    drawPath(
        items: Array<Path> | Path,
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): LayerHandle {
        const list = Array.isArray(items[0]) ? (items as Array<Coords[]>) : [items as Coords[]];

        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            ctx.save();
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;

            const resetAlpha = style?.lineWidth ? applyLineWidth(ctx, style.lineWidth) : undefined;

            ctx.beginPath();
            for (const points of list) {
                if (!points.length) continue;
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

                const first = this.transformer.worldToScreen(points[0].x, points[0].y);
                ctx.moveTo(first.x, first.y);

                for (let i = 1; i < points.length; i++) {
                    const p = this.transformer.worldToScreen(points[i].x, points[i].y);
                    ctx.lineTo(p.x, p.y);
                }
            }
            ctx.stroke();

            resetAlpha?.();
            ctx.restore();
        });
    }

    drawImage(items: Array<ImageItem> | ImageItem, layer: number = 1): LayerHandle {
        const list = Array.isArray(items) ? items : [items];

        // Build spatial index for large datasets (RBush R-Tree)
        const useSpatialIndex = list.length > SPATIAL_INDEX_THRESHOLD;
        const spatialIndex = useSpatialIndex ? SpatialIndex.fromArray(list) : null;

        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            const bounds = this.getViewportBounds(topLeft, config);
            const visibleItems = spatialIndex
                ? spatialIndex.query(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY)
                : list;

            for (const item of visibleItems) {
                const size = item.size ?? 1;
                const origin = {
                    mode: item.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                    x: item.origin?.x ?? 0.5,
                    y: item.origin?.y ?? 0.5,
                };

                // Skip visibility check if using spatial index (already filtered)
                if (!spatialIndex && !this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;

                // preserve aspect
                const aspect = item.img.width / item.img.height;

                let drawW = pxSize;
                let drawH = pxSize;

                if (aspect > 1) drawH = pxSize / aspect;
                else drawW = pxSize * aspect;

                // origin SELF/CELL
                const { x: baseX, y: baseY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

                const offsetX = baseX + (pxSize - drawW) / 2;
                const offsetY = baseY + (pxSize - drawH) / 2;

                const rotationDeg = item.rotate ?? 0;
                const rotation = rotationDeg * (Math.PI / 180);

                if (rotationDeg !== 0) {
                    const centerX = offsetX + drawW / 2;
                    const centerY = offsetY + drawH / 2;
                    ctx.save();
                    ctx.translate(centerX, centerY);
                    ctx.rotate(rotation);
                    ctx.drawImage(item.img, -drawW / 2, -drawH / 2, drawW, drawH);
                    ctx.restore();
                } else {
                    ctx.drawImage(item.img, offsetX, offsetY, drawW, drawH);
                }
            }
        });
    }

    drawGridLines(cellSize: number, style: { strokeStyle: string; lineWidth: number }, layer: number = 0): LayerHandle {
        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            const viewW = config.size.width / config.scale;
            const viewH = config.size.height / config.scale;

            const startX = Math.floor(topLeft.x / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endX = Math.ceil((topLeft.x + viewW) / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const startY = Math.floor(topLeft.y / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endY = Math.ceil((topLeft.y + viewH) / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;

            ctx.save();

            ctx.strokeStyle = style.strokeStyle;
            const resetAlpha = applyLineWidth(ctx, style.lineWidth);

            ctx.beginPath();

            for (let x = startX; x <= endX; x += cellSize) {
                const p1 = this.transformer.worldToScreen(x, startY);
                const p2 = this.transformer.worldToScreen(x, endY);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }

            for (let y = startY; y <= endY; y += cellSize) {
                const p1 = this.transformer.worldToScreen(startX, y);
                const p2 = this.transformer.worldToScreen(endX, y);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }

            ctx.stroke();
            resetAlpha();
            ctx.restore();
        });
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
     * Helper to create or get a static cache for pre-rendered content.
     * Handles bounds calculation, canvas creation, and rebuild logic.
     */
    private getOrCreateStaticCache<T extends { x: number; y: number; size?: number; radius?: number | number[] }>(
        items: T[],
        cacheKey: string,
        renderFn: (
            ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
            item: T,
            x: number,
            y: number,
            pxSize: number
        ) => void
    ): StaticCache | null {
        if (!this.staticCacheSupported) {
            if (!this.warnedStaticCacheDisabled) {
                console.warn("[CanvasDraw] Static cache disabled: OffscreenCanvas not available.");
                this.warnedStaticCacheDisabled = true;
            }
            return null;
        }

        // Calculate world bounds from items
        let minX = Infinity,
            maxX = -Infinity,
            minY = Infinity,
            maxY = -Infinity;

        for (const item of items) {
            const size = item.size ?? 1;
            if (item.x - size / 2 < minX) minX = item.x - size / 2;
            if (item.x + size / 2 > maxX) maxX = item.x + size / 2;
            if (item.y - size / 2 < minY) minY = item.y - size / 2;
            if (item.y + size / 2 > maxY) maxY = item.y + size / 2;
        }

        // Add padding
        minX -= 1;
        minY -= 1;
        maxX += 1;
        maxY += 1;

        const worldWidth = maxX - minX;
        const worldHeight = maxY - minY;

        // Use current scale for rendering
        const renderScale = this.camera.scale;
        const canvasWidth = Math.ceil(worldWidth * renderScale);
        const canvasHeight = Math.ceil(worldHeight * renderScale);

        if (canvasWidth > MAX_STATIC_CANVAS_DIMENSION || canvasHeight > MAX_STATIC_CANVAS_DIMENSION) {
            if (!this.warnedStaticCacheDisabled) {
                console.warn(`Static cache disabled: offscreen canvas too large (${canvasWidth}x${canvasHeight}).`);
                this.warnedStaticCacheDisabled = true;
            }
            return null;
        }

        // Check if we need to create or update cache
        let cache = this.staticCaches.get(cacheKey);
        const needsRebuild =
            !cache ||
            cache.scale !== renderScale ||
            cache.worldBounds.minX !== minX ||
            cache.worldBounds.maxX !== maxX ||
            cache.worldBounds.minY !== minY ||
            cache.worldBounds.maxY !== maxY;

        if (needsRebuild) {
            // Create offscreen canvas
            const offscreen =
                typeof OffscreenCanvas !== "undefined"
                    ? new OffscreenCanvas(canvasWidth, canvasHeight)
                    : document.createElement("canvas");

            // Guard instanceof with typeof to avoid ReferenceError when OffscreenCanvas is undefined (e.g., jsdom)
            const isOffscreenCanvas = typeof OffscreenCanvas !== "undefined" && offscreen instanceof OffscreenCanvas;

            if (!isOffscreenCanvas) {
                (offscreen as HTMLCanvasElement).width = canvasWidth;
                (offscreen as HTMLCanvasElement).height = canvasHeight;
            }

            const offCtx = offscreen.getContext("2d");

            if (!offCtx) {
                if (!this.warnedStaticCacheDisabled) {
                    console.warn("[CanvasDraw] Static cache disabled: 2D context unavailable.");
                    this.warnedStaticCacheDisabled = true;
                }
                return null;
            }

            // Render all items using the provided render function
            for (const item of items) {
                const size = item.size ?? 1;
                const pxSize = size * renderScale;
                const x = (item.x + DEFAULT_VALUES.CELL_CENTER_OFFSET - minX) * renderScale - pxSize / 2;
                const y = (item.y + DEFAULT_VALUES.CELL_CENTER_OFFSET - minY) * renderScale - pxSize / 2;

                renderFn(offCtx, item, x, y, pxSize);
            }

            cache = {
                canvas: offscreen,
                ctx: offCtx,
                worldBounds: { minX, minY, maxX, maxY },
                scale: renderScale,
            };

            this.staticCaches.set(cacheKey, cache);
        }

        return cache || null;
    }

    /**
     * Helper to add a layer callback that blits from a static cache.
     */
    private addStaticCacheLayer(cache: StaticCache | null, layer: number): LayerHandle | null {
        if (!cache) {
            return null;
        }
        const cachedCanvas = cache.canvas;
        const cachedBounds = cache.worldBounds;
        const cachedScale = cache.scale;

        return this.layers.add(layer, ({ ctx, config, topLeft }) => {
            const viewportWidth = config.size.width / config.scale;
            const viewportHeight = config.size.height / config.scale;

            // === Source Rectangle (cached canvas coordinates) ===
            // These define which region of the offscreen cache canvas to copy FROM
            // Calculated by finding viewport position relative to cache origin, then scaling to cache resolution
            let cacheSourceX = (topLeft.x - cachedBounds.minX) * cachedScale;
            let cacheSourceY = (topLeft.y - cachedBounds.minY) * cachedScale;
            let cacheSourceWidth = viewportWidth * cachedScale;
            let cacheSourceHeight = viewportHeight * cachedScale;

            // === Destination Rectangle (screen coordinates) ===
            // These define where to draw the copied region TO on the visible canvas
            // Note: These values get adjusted below when viewport extends beyond cached bounds
            let screenDestX = 0;
            let screenDestY = 0;
            let screenDestWidth = config.size.width;
            let screenDestHeight = config.size.height;

            // === Bounds Clamping ===
            // Problem: When viewport pans beyond the cached area, source coordinates become invalid
            //          (negative or exceeding cache dimensions). Mobile browsers
            //          fail silently or render incorrectly with out-of-bounds drawImage coordinates.
            // Solution: Clamp source rect to valid cache bounds and adjust destination rect to
            //           maintain correct positioning - only draw the portion that exists in cache.
            const cacheWidth = cachedCanvas.width;
            const cacheHeight = cachedCanvas.height;

            // Clamp left/top: When viewport is beyond cache's top-left corner
            // Shift destination right/down to compensate for the missing cached area
            if (cacheSourceX < 0) {
                const offsetWorld = -cacheSourceX / cachedScale;
                screenDestX = offsetWorld * config.scale;
                screenDestWidth -= screenDestX;
                cacheSourceWidth += cacheSourceX;
                cacheSourceX = 0;
            }
            if (cacheSourceY < 0) {
                const offsetWorld = -cacheSourceY / cachedScale;
                screenDestY = offsetWorld * config.scale;
                screenDestHeight -= screenDestY;
                cacheSourceHeight += cacheSourceY;
                cacheSourceY = 0;
            }

            // Clamp right/bottom: When viewport extends past cache's bottom-right corner
            // Shrink destination to avoid stretching the cached content
            if (cacheSourceX + cacheSourceWidth > cacheWidth) {
                const excess = cacheSourceX + cacheSourceWidth - cacheWidth;
                const excessWorld = excess / cachedScale;
                cacheSourceWidth = cacheWidth - cacheSourceX;
                screenDestWidth -= excessWorld * config.scale;
            }
            if (cacheSourceY + cacheSourceHeight > cacheHeight) {
                const excess = cacheSourceY + cacheSourceHeight - cacheHeight;
                const excessWorld = excess / cachedScale;
                cacheSourceHeight = cacheHeight - cacheSourceY;
                screenDestHeight -= excessWorld * config.scale;
            }

            // Only draw if there's something to draw
            if (cacheSourceWidth > 0 && cacheSourceHeight > 0 && screenDestWidth > 0 && screenDestHeight > 0) {
                ctx.drawImage(
                    cachedCanvas,
                    cacheSourceX,
                    cacheSourceY,
                    cacheSourceWidth,
                    cacheSourceHeight,
                    screenDestX,
                    screenDestY,
                    screenDestWidth,
                    screenDestHeight
                );
            }
        });
    }

    /**
     * Draw rectangles with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like mini-maps.
     * @param items Array of draw objects
     * @param cacheKey Unique key for this cache (e.g., "minimap-items")
     * @param layer Layer order
     */
    drawStaticRect(items: Array<Rect>, cacheKey: string, layer: number = 1): LayerHandle {
        let lastFillStyle: string | undefined;

        const cache = this.getOrCreateStaticCache(items, cacheKey, (ctx, item, x, y, pxSize) => {
            const style = item.style;
            const rotationDeg = item.rotate ?? 0;
            const rotation = rotationDeg * (Math.PI / 180);
            const radius = item.radius;

            if (style?.fillStyle && style.fillStyle !== lastFillStyle) {
                ctx.fillStyle = style.fillStyle;
                lastFillStyle = style.fillStyle;
            }

            if (rotationDeg !== 0) {
                const centerX = x + pxSize / 2;
                const centerY = y + pxSize / 2;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(rotation);
                if (radius && ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(-pxSize / 2, -pxSize / 2, pxSize, pxSize, radius);
                    ctx.fill();
                } else {
                    ctx.fillRect(-pxSize / 2, -pxSize / 2, pxSize, pxSize);
                }
                ctx.restore();
            } else {
                if (radius && ctx.roundRect) {
                    ctx.beginPath();
                    ctx.roundRect(x, y, pxSize, pxSize, radius);
                    ctx.fill();
                } else {
                    ctx.fillRect(x, y, pxSize, pxSize);
                }
            }
        });

        if (!cache) {
            return this.drawRect(items, layer);
        }

        return this.addStaticCacheLayer(cache, layer)!;
    }

    /**
     * Draw images with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like terrain tiles or static decorations.
     * @param items Array of image objects with position and HTMLImageElement
     * @param cacheKey Unique key for this cache (e.g., "terrain-cache")
     * @param layer Layer order
     */
    drawStaticImage(items: Array<ImageItem>, cacheKey: string, layer: number = 1): LayerHandle {
        const cache = this.getOrCreateStaticCache(items, cacheKey, (ctx, item, x, y, pxSize) => {
            const img = (item as { img: HTMLImageElement }).img;
            const rotationDeg = (item as { rotate?: number }).rotate ?? 0;
            const rotation = rotationDeg * (Math.PI / 180);
            const aspect = img.width / img.height;
            let drawW = pxSize;
            let drawH = pxSize;

            if (aspect > 1) drawH = pxSize / aspect;
            else drawW = pxSize * aspect;

            // x, y are top-left of pxSize box, need to center image within it
            const imgX = x + (pxSize - drawW) / 2;
            const imgY = y + (pxSize - drawH) / 2;

            if (rotationDeg !== 0) {
                const centerX = imgX + drawW / 2;
                const centerY = imgY + drawH / 2;
                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(rotation);
                ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
                ctx.restore();
            } else {
                ctx.drawImage(img, imgX, imgY, drawW, drawH);
            }
        });

        if (!cache) {
            return this.drawImage(items, layer);
        }

        return this.addStaticCacheLayer(cache, layer)!;
    }

    /**
     * Draw circles with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like mini-maps.
     * @param items Array of draw objects
     * @param cacheKey Unique key for this cache (e.g., "minimap-circles")
     * @param layer Layer order
     */
    drawStaticCircle(items: Array<Circle>, cacheKey: string, layer: number = 1): LayerHandle {
        let lastFillStyle: string | undefined;

        const cache = this.getOrCreateStaticCache(items, cacheKey, (ctx, item, x, y, pxSize) => {
            const style = item.style;
            const radius = pxSize / 2;

            if (style?.fillStyle && style.fillStyle !== lastFillStyle) {
                ctx.fillStyle = style.fillStyle;
                lastFillStyle = style.fillStyle;
            }

            ctx.beginPath();
            ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
            ctx.fill();
        });

        if (!cache) {
            return this.drawCircle(items, layer);
        }

        return this.addStaticCacheLayer(cache, layer)!;
    }

    /**
     * Clear a static cache
     * @param cacheKey The cache key to clear, or undefined to clear all
     */
    clearStaticCache(cacheKey?: string) {
        if (cacheKey) {
            this.staticCaches.delete(cacheKey);
        } else {
            this.staticCaches.clear();
        }
    }

    /**
     * Release cached canvases and layer callbacks.
     */
    destroy() {
        this.staticCaches.clear();
        this.layers.clear();
    }
}
