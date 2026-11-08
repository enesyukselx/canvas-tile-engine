import type { Bounds } from "@canvas-tile-engine/core";

/**
 * The world -> screen projection of a clip rectangle, shared by every clip
 * adapter so the four renderers cut on the same pixels.
 *
 * Bounds are continuous world coordinates in the space item positions live in
 * (integers are cell centers), which is what `worldToScreen` takes, so the two
 * corners project directly.
 *
 * The result is always sorted (non-negative width and height). The engine
 * sorts a clip before it reaches a renderer, but a direct `IDrawAPI` caller
 * does not go through it, and the adapters disagree on a negative extent:
 * Canvas2D's `rect()` and Skia's `clipRect` normalise it, while a WebGL
 * scissor collapses to 0x0 and drops every batched primitive.
 * @internal
 */
export function clipRectPx(
    clip: Bounds,
    worldToScreen: (x: number, y: number) => { x: number; y: number },
): { x: number; y: number; width: number; height: number } {
    const a = worldToScreen(clip.minX, clip.minY);
    const b = worldToScreen(clip.maxX, clip.maxY);
    return {
        x: Math.min(a.x, b.x),
        y: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x),
        height: Math.abs(b.y - a.y),
    };
}
