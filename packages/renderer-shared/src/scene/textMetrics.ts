import type { MeasuredText, TextMeasureStyle } from "@canvas-tile-engine/core";
import { LruCache } from "../cache";

/**
 * Upper bound on cached measurements.
 *
 * The working set is the strings actually measured, which for the layout work
 * this exists for — axis ticks, labels, legend entries — is small and stable.
 * 1024 clears that with room to spare; a caller that measures unbounded text
 * (every cell of a large table) simply misses more often, which costs one
 * platform call rather than degrading.
 * @internal
 */
export const TEXT_METRICS_CACHE_LIMIT = 1024;

/**
 * Memoizes text measurement across frames.
 *
 * Measurement is a platform call — a Canvas2D `measureText`, a Skia font query
 * — and layout code calls it in loops, often with the same handful of strings
 * every frame. The key carries every input that changes the answer; weight in
 * particular, because a bold string is wider and a key without it would hand
 * back the regular measurement for both.
 * @internal
 */
export class TextMetricsCache {
    private cache = new LruCache<string, MeasuredText>(TEXT_METRICS_CACHE_LIMIT);

    /** @param measure Platform measurement, called only on a miss. */
    constructor(private measure: (text: string, style: TextMeasureStyle) => MeasuredText) {}

    get(text: string, style: TextMeasureStyle): MeasuredText {
        const key = `${style.fontWeight ?? ""}|${style.fontPx}|${style.fontFamily ?? ""}|${text}`;
        const hit = this.cache.get(key);
        if (hit) {
            return hit;
        }
        const measured = this.measure(text, style);
        this.cache.set(key, measured);
        return measured;
    }

    clear() {
        this.cache.clear();
    }
}

/**
 * The CSS font shorthand for a measurement, byte-identical to what the
 * Canvas2D draw path builds — including omitting an unset weight, since the
 * shorthand resets every property it does not list.
 * @internal
 */
export function fontShorthand(style: TextMeasureStyle): string {
    const family = style.fontFamily ?? "sans-serif";
    return style.fontWeight !== undefined
        ? `${style.fontWeight} ${style.fontPx}px ${family}`
        : `${style.fontPx}px ${family}`;
}
