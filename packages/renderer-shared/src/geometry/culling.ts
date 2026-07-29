import { VISIBILITY_BUFFER } from "@canvas-tile-engine/core";
import type { Bounds, CanvasTileEngineConfig, Coords } from "@canvas-tile-engine/core";

/**
 * The world rectangle every renderer culls against: the visible viewport in
 * world units, grown by the tile buffer so items just off-screen still paint
 * (and partially visible ones are never dropped mid-pan).
 *
 * `topLeft` is the camera's world position; `config.size` is in logical pixels
 * and `config.scale` is pixels per world unit.
 */
export function getViewportBounds(topLeft: Coords, config: Required<CanvasTileEngineConfig>): Bounds {
    const viewW = config.size.width / config.scale;
    const viewH = config.size.height / config.scale;
    return {
        minX: topLeft.x - VISIBILITY_BUFFER.TILE_BUFFER,
        minY: topLeft.y - VISIBILITY_BUFFER.TILE_BUFFER,
        maxX: topLeft.x + viewW + VISIBILITY_BUFFER.TILE_BUFFER,
        maxY: topLeft.y + viewH + VISIBILITY_BUFFER.TILE_BUFFER,
    };
}

/** Whether an item anchored at (x, y) with `extentWorld` half-extent touches `bounds`. */
function touches(bounds: Bounds, x: number, y: number, extentWorld: number): boolean {
    return (
        x + extentWorld >= bounds.minX &&
        x - extentWorld <= bounds.maxX &&
        y + extentWorld >= bounds.minY &&
        y - extentWorld <= bounds.maxY
    );
}

/**
 * Per-item cull test for the linear draw paths (below the spatial-index
 * threshold, and for kinds that have no index). `extentWorld` is the item's
 * half-extent in world units — the anchor is treated as its center, matching
 * how the spatial index boxes items.
 */
export function isVisible(
    x: number,
    y: number,
    extentWorld: number,
    topLeft: Coords,
    config: Required<CanvasTileEngineConfig>,
): boolean {
    return touches(getViewportBounds(topLeft, config), x, y, extentWorld);
}
