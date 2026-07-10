import { Coords } from "../types";
import { DEFAULT_VALUES } from "../constants";

/** Pan the top-left point by screen pixel delta, respecting current scale. */
export function computePan(topLeft: Coords, scale: number, dx: number, dy: number): Coords {
    return { x: topLeft.x - dx / scale, y: topLeft.y - dy / scale };
}

/** Compute new top-left and scale when zooming around a mouse point. */
export function computeZoom(
    topLeft: Coords,
    oldScale: number,
    deltaY: number,
    minScale: number,
    maxScale: number,
    mouse: { x: number; y: number },
): { topLeft: Coords; scale: number } {
    const limitedDelta = Math.min(Math.max(deltaY, DEFAULT_VALUES.MIN_WHEEL_DELTA), DEFAULT_VALUES.MAX_WHEEL_DELTA);
    const scaleFactor = Math.exp(-limitedDelta * DEFAULT_VALUES.ZOOM_SENSITIVITY);
    const newScale = Math.min(maxScale, Math.max(minScale, oldScale * scaleFactor));
    if (newScale === oldScale) return { topLeft, scale: oldScale };
    return {
        topLeft: {
            x: topLeft.x + mouse.x * (1 / oldScale - 1 / newScale),
            y: topLeft.y + mouse.y * (1 / oldScale - 1 / newScale),
        },
        scale: newScale,
    };
}

/**
 * Snap an initial center coordinate for pixel-perfect grid alignment.
 *
 * Integers are cell centers (cell k spans [k-0.5, k+0.5]), so an even tile
 * count needs a half-integer center (a cell boundary) and an odd tile count
 * needs an integer center (a cell center). Snaps to the nearest valid value;
 * exact ties snap down so a center computed as N/2 for a 0-based N-cell board
 * lands on the true board center (N-1)/2.
 *
 * Non-integer tile counts have no aligned center; the value passes through.
 */
export function snapCenterToGrid(value: number, tiles: number): number {
    if (!Number.isInteger(tiles)) return value;
    return tiles % 2 === 0 ? Math.ceil(value - 1) + 0.5 : Math.ceil(value - 0.5);
}

/** Convert world grid coordinates to screen pixels using camera state. */
export function worldToScreen(world: Coords, cam: { x: number; y: number; scale: number }): Coords {
    return {
        x: (world.x + DEFAULT_VALUES.CELL_CENTER_OFFSET - cam.x) * cam.scale,
        y: (world.y + DEFAULT_VALUES.CELL_CENTER_OFFSET - cam.y) * cam.scale,
    };
}

/** Convert screen pixels back to world grid coordinates using camera state. */
export function screenToWorld(screen: Coords, cam: { x: number; y: number; scale: number }): Coords {
    return { x: cam.x + screen.x / cam.scale, y: cam.y + screen.y / cam.scale };
}
