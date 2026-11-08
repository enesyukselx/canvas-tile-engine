/**
 * Shared item-size resolution for Circle/Image, mirroring the Text
 * `size`/`fontPx` pair: `size` is world units and scales with zoom, `sizePx`
 * is screen pixels, independent of zoom, and takes precedence.
 *
 * Extents are never negative. A negative or `NaN` size resolves to 0, and a
 * box with a negative or `NaN` axis resolves to 0 x 0, so the item paints
 * nothing (no fill, no border) and never hits on any renderer. Every renderer,
 * the hit tester and `itemsBounds` read sizes through these helpers, which is
 * what keeps that contract identical everywhere.
 *
 * `pixelSizes: false` ignores `sizePx`/`widthPx`/`heightPx` and resolves world
 * units only: static caches replay at a recorded scale, where a screen size
 * cannot hold.
 */

export interface SizedItem {
    size?: number;
    sizePx?: number;
}

/** Clamp one extent: negative and `NaN` read as 0. */
function extent(value: number): number {
    return value > 0 ? value : 0;
}

/**
 * A negative or `NaN` axis empties the whole box rather than that axis alone:
 * a box with one zero side still strokes as a line, but an invalid size must
 * paint nothing at all.
 */
function box(width: number, height: number): { width: number; height: number } {
    return width >= 0 && height >= 0 ? { width, height } : { width: 0, height: 0 };
}

/** Effective drawn size in screen pixels. `sizePx` wins; else `size * scale`; default 1 world unit. */
export function resolveSizePx(item: SizedItem, scale: number, pixelSizes = true): number {
    if (pixelSizes && item.sizePx !== undefined) {
        return extent(item.sizePx);
    }
    return extent((item.size ?? 1) * scale);
}

/**
 * Effective size in world units at the current scale. Note that a `sizePx`
 * item's world extent GROWS as the camera zooms out — culling and hit
 * queries must re-evaluate this per frame instead of caching it.
 */
export function resolveSizeWorld(item: SizedItem, scale: number, pixelSizes = true): number {
    if (pixelSizes && item.sizePx !== undefined) {
        return extent(item.sizePx / scale);
    }
    return extent(item.size ?? 1);
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
export function resolveBoxPx(item: BoxSizedItem, scale: number, pixelSizes = true): { width: number; height: number } {
    const size = item.size ?? 1;
    const width = item.width ?? size;
    const height = item.height ?? size;
    if (!pixelSizes) {
        return box(width * scale, height * scale);
    }
    return box(axisPx(item.widthPx, item, width, scale), axisPx(item.heightPx, item, height, scale));
}

/**
 * Effective box in world units at the current scale. Carries the same caveat
 * as {@link resolveSizeWorld}: a pixel-sized box grows in world units as the
 * camera zooms out, so it must be re-evaluated per frame.
 */
export function resolveBoxWorld(
    item: BoxSizedItem,
    scale: number,
    pixelSizes = true,
): { width: number; height: number } {
    const size = item.size ?? 1;
    const width = item.width ?? size;
    const height = item.height ?? size;
    if (!pixelSizes) {
        return box(width, height);
    }
    return box(axisWorld(item.widthPx, item, width, scale), axisWorld(item.heightPx, item, height, scale));
}

/** Largest pixel-sized extent an item declares; `0` when it is purely world-sized. */
export function maxPxExtent(item: BoxSizedItem): number {
    return Math.max(extent(item.widthPx ?? 0), extent(item.heightPx ?? 0), extent(item.sizePx ?? 0));
}
