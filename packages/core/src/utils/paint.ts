import { Coords, LinearGradient, Paint } from "../types";

/**
 * Paint resolution shared by every renderer, so a gradient lands on the same
 * pixels on Canvas2D, WebGL, Skia and the server.
 */

/** Narrow a fill to its gradient form. A plain CSS color string is not one. */
export function isGradient(paint: Paint | undefined): paint is LinearGradient {
    return typeof paint === "object" && paint !== null;
}

/**
 * Stops in the shape every backend wants: ascending offsets, each clamped to
 * `[0, 1]`.
 *
 * Both properties are load-bearing rather than defensive. Canvas2D's
 * `addColorStop` throws on an out-of-range offset, and Skia's
 * `MakeLinearGradient` takes a position array it expects to be ascending, so
 * an unsorted or over-range list would fail loudly on one renderer and
 * silently misdraw on another. The sort is stable, so stops sharing an offset
 * keep their authored order — that is how a hard color break is written.
 */
export function normalizeStops(stops: readonly { offset: number; color: string }[]) {
    return stops
        .map((stop, index) => ({
            offset: Math.min(1, Math.max(0, stop.offset)),
            color: stop.color,
            index,
        }))
        .sort((a, b) => a.offset - b.offset || a.index - b.index)
        .map(({ offset, color }) => ({ offset, color }));
}

/** The screen-pixel box a gradient's `"box"` units are relative to. */
export type PaintBox = { x: number; y: number; width: number; height: number };

/**
 * The gradient axis in screen pixels: the two points a backend's linear
 * gradient runs between.
 *
 * `"box"` units (the default) are fractions of the drawn box, so one gradient
 * object describes "top to bottom" for every item that uses it regardless of
 * size or position — the reason it is the default. `"world"` units are world
 * coordinates, for a ramp that spans the scene rather than the item, and need
 * the camera, which is why the caller passes its own projection in.
 */
export function gradientAxisPx(
    gradient: LinearGradient,
    box: PaintBox,
    worldToScreen: (x: number, y: number) => Coords,
): { x0: number; y0: number; x1: number; y1: number } {
    if (gradient.units === "world") {
        const from = worldToScreen(gradient.from.x, gradient.from.y);
        const to = worldToScreen(gradient.to.x, gradient.to.y);
        return { x0: from.x, y0: from.y, x1: to.x, y1: to.y };
    }

    return {
        x0: box.x + gradient.from.x * box.width,
        y0: box.y + gradient.from.y * box.height,
        x1: box.x + gradient.to.x * box.width,
        y1: box.y + gradient.to.y * box.height,
    };
}

/**
 * Gradient parameter `t` at a screen point, the value a color ramp is sampled
 * with. Projects the point onto the axis; a zero-length axis yields 0, which
 * is what Canvas2D and Skia both paint (the first stop's color).
 */
export function gradientT(axis: { x0: number; y0: number; x1: number; y1: number }, x: number, y: number): number {
    const dx = axis.x1 - axis.x0;
    const dy = axis.y1 - axis.y0;
    const lengthSq = dx * dx + dy * dy;
    if (lengthSq === 0) {
        return 0;
    }
    return ((x - axis.x0) * dx + (y - axis.y0) * dy) / lengthSq;
}

/**
 * Stable identity for a paint, for keying the per-renderer caches that hold
 * the backend's own gradient object. Two structurally identical gradients
 * share a key, so building the spec inline in a `styleOf` callback still hits
 * the cache.
 */
export function paintKey(paint: Paint): string {
    if (!isGradient(paint)) {
        return paint;
    }
    const stops = paint.stops.map((stop) => `${stop.offset}:${stop.color}`).join(",");
    const units = paint.units ?? "box";
    return `${paint.type}|${units}|${paint.from.x},${paint.from.y}|${paint.to.x},${paint.to.y}|${stops}`;
}
