/**
 * Shared item-size resolution for Circle/Image, mirroring the Text
 * `size`/`fontPx` pair: `size` is world units and scales with zoom, `sizePx`
 * is screen pixels, independent of zoom, and takes precedence.
 */

export interface SizedItem {
    size?: number;
    sizePx?: number;
}

/** Effective drawn size in screen pixels. `sizePx` wins; else `size * scale`; default 1 world unit. */
export function resolveSizePx(item: SizedItem, scale: number): number {
    if (item.sizePx !== undefined) {
        return item.sizePx;
    }
    return (item.size ?? 1) * scale;
}

/**
 * Effective size in world units at the current scale. Note that a `sizePx`
 * item's world extent GROWS as the camera zooms out — culling and hit
 * queries must re-evaluate this per frame instead of caching it.
 */
export function resolveSizeWorld(item: SizedItem, scale: number): number {
    if (item.sizePx !== undefined) {
        return item.sizePx / scale;
    }
    return item.size ?? 1;
}

/**
 * A Rect's sizing fields. Per axis, pixels win over world units and the
 * axis-specific field wins over the shared one:
 * `widthPx` → `sizePx` → `width` → `size`.
 */
export interface BoxSizedItem extends SizedItem {
    width?: number;
    height?: number;
    widthPx?: number;
    heightPx?: number;
}

function axisPx(axis: number | undefined, item: SizedItem, world: number, scale: number): number {
    if (axis !== undefined) {
        return axis;
    }
    if (item.sizePx !== undefined) {
        return item.sizePx;
    }
    return world * scale;
}

function axisWorld(axis: number | undefined, item: SizedItem, world: number, scale: number): number {
    if (axis !== undefined) {
        return axis / scale;
    }
    if (item.sizePx !== undefined) {
        return item.sizePx / scale;
    }
    // Returned directly rather than as `axisPx(...) / scale`: the round trip
    // through pixels loses exactness on plain world values.
    return world;
}

/** Effective drawn box in screen pixels. */
export function resolveBoxPx(item: BoxSizedItem, scale: number): { width: number; height: number } {
    const size = item.size ?? 1;
    return {
        width: axisPx(item.widthPx, item, item.width ?? size, scale),
        height: axisPx(item.heightPx, item, item.height ?? size, scale),
    };
}

/**
 * Effective box in world units at the current scale. Carries the same caveat
 * as {@link resolveSizeWorld}: a pixel-sized box grows in world units as the
 * camera zooms out, so it must be re-evaluated per frame.
 */
export function resolveBoxWorld(item: BoxSizedItem, scale: number): { width: number; height: number } {
    const size = item.size ?? 1;
    return {
        width: axisWorld(item.widthPx, item, item.width ?? size, scale),
        height: axisWorld(item.heightPx, item, item.height ?? size, scale),
    };
}

/** Largest pixel-sized extent an item declares; `0` when it is purely world-sized. */
export function maxPxExtent(item: BoxSizedItem): number {
    return Math.max(item.widthPx ?? 0, item.heightPx ?? 0, item.sizePx ?? 0);
}
