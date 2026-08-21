import type { Bounds } from "@canvas-tile-engine/core";

/**
 * The world -> screen projection of a clip rectangle, shared by every clip
 * adapter so the four renderers cut on the same pixels.
 *
 * Bounds are continuous world coordinates in the space item positions live in
 * (integers are cell centers), which is what `worldToScreen` takes, so the two
 * corners project directly.
 * @internal
 */
export function clipRectPx(
    clip: Bounds,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
    const topLeft = worldToScreen(clip.minX, clip.minY);
    const bottomRight = worldToScreen(clip.maxX, clip.maxY);
    return {
        x: topLeft.x,
        y: topLeft.y,
        width: bottomRight.x - topLeft.x,
        height: bottomRight.y - topLeft.y,
    };
}
