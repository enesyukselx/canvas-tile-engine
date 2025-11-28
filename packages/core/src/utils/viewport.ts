import { Coords } from "../types";

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
    mouse: { x: number; y: number }
): { topLeft: Coords; scale: number } {
    const zoomSensitivity = 0.001;
    const limitedDelta = Math.min(Math.max(deltaY, -100), 100);
    const scaleFactor = Math.exp(-limitedDelta * zoomSensitivity);
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

/** Convert world grid coordinates to screen pixels using camera state. */
export function worldToScreen(world: Coords, cam: { x: number; y: number; scale: number }): Coords {
    return { x: (world.x + 0.5 - cam.x) * cam.scale, y: (world.y + 0.5 - cam.y) * cam.scale };
}

/** Convert screen pixels back to world grid coordinates using camera state. */
export function screenToWorld(screen: Coords, cam: { x: number; y: number; scale: number }): Coords {
    return { x: cam.x + screen.x / cam.scale, y: cam.y + screen.y / cam.scale };
}
