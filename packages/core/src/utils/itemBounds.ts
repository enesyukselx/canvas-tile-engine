import type { Bounds } from "../types";

/**
 * Minimal item shape the bounds math reads: an anchor plus the optional world
 * size fields. Every drawable item (`Rect`, `Circle`, `Text`, `ImageItem`)
 * satisfies it.
 */
export interface BoundedItem {
    x: number;
    y: number;
    /** World-unit size; defaults to 1, the size the renderers draw with. */
    size?: number;
    /** Per-axis world width, overriding `size` on the x axis (non-square rects). */
    width?: number;
    /** Per-axis world height, overriding `size` on the y axis. */
    height?: number;
}

/**
 * World-space rectangle enclosing every item's cell area: an item covers
 * `width ?? size` x `height ?? size` world units (default 1) centered on its
 * anchor. Feeds {@link Bounds}-taking APIs directly, so framing a selection is
 * one call: `engine.fitBounds(itemsBounds(selected), { paddingPx: 24 })`.
 *
 * Anchor-centered by design, which keeps it camera-independent: `origin`
 * offsets and `rotate` are not applied (both stay within half an item of this
 * box), and `sizePx` is ignored because it only resolves against a camera
 * scale. Callers that need slack add their own padding.
 *
 * Returns null for an empty list — there is no rectangle to describe.
 */
export function itemsBounds(items: BoundedItem[]): Bounds | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const item of items) {
        const size = item.size ?? 1;
        const halfW = (item.width ?? size) / 2;
        const halfH = (item.height ?? size) / 2;
        if (item.x - halfW < minX) {
            minX = item.x - halfW;
        }
        if (item.x + halfW > maxX) {
            maxX = item.x + halfW;
        }
        if (item.y - halfH < minY) {
            minY = item.y - halfH;
        }
        if (item.y + halfH > maxY) {
            maxY = item.y + halfH;
        }
    }

    if (minX === Infinity) {
        return null;
    }
    return { minX, maxX, minY, maxY };
}
