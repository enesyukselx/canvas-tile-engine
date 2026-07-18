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
    if (item.sizePx !== undefined) return item.sizePx;
    return (item.size ?? 1) * scale;
}

/**
 * Effective size in world units at the current scale. Note that a `sizePx`
 * item's world extent GROWS as the camera zooms out — culling and hit
 * queries must re-evaluate this per frame instead of caching it.
 */
export function resolveSizeWorld(item: SizedItem, scale: number): number {
    if (item.sizePx !== undefined) return item.sizePx / scale;
    return item.size ?? 1;
}
