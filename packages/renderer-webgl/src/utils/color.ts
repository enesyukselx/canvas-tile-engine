import { LruCache } from "@canvas-tile-engine/renderer-shared/cache";

/**
 * A color as the four floats in [0, 1] that WebGL wants.
 * @internal
 */
export type RGBA = [number, number, number, number];

const WHITE: RGBA = [1, 1, 1, 1];

/**
 * Upper bound on the parsed-color cache.
 *
 * The cache is consulted once per visible item per frame, so the working set is
 * whatever is on screen — not the whole item list. The bound has to clear that,
 * because a bounded LRU whose working set overflows it does not degrade, it
 * falls off a cliff: every lookup asks for the entry the previous frame evicted
 * and the hit rate goes to zero. 4096 covers a dense viewport where `styleOf`
 * gives every cell its own stable color, at roughly 150 bytes an entry (the key
 * string, the tuple, the map slot) — under a megabyte held.
 *
 * It is deliberately half of `renderer-skia`'s bound. A miss here is an inline
 * `parseFast` for the hex/`rgb()`/`hsl()` forms a computed `styleOf` builds, so
 * overflowing costs arithmetic; Skia has no such path and pays a native call,
 * so it buys more headroom with its memory. Keep the two sized independently.
 * @internal
 */
export const COLOR_CACHE_LIMIT = 4096;

const HASH = 35; // "#"
const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/;
/** CSS allows commas, whitespace, and a `/` before alpha to separate arguments. */
const ARGUMENT_SEPARATOR = /[\s,/]+/;

function clamp01(value: number): number {
    return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Strict CSS `<number>`; rejects `none`, keywords, and anything left over. */
function toNumber(token: string): number | null {
    return NUMBER.test(token) ? Number(token) : null;
}

/** `<percentage>` or a bare `<number>` already on a 0-1 scale after division by 100. */
function toFraction(token: string): number | null {
    const value = toNumber(token.endsWith("%") ? token.slice(0, -1) : token);
    return value === null ? null : clamp01(value / 100);
}

/** An r/g/b component: `<percentage>` of full, or a `<number>` out of 255. */
function toChannel(token: string): number | null {
    if (token.endsWith("%")) {
        return toFraction(token);
    }
    const value = toNumber(token);
    return value === null ? null : clamp01(value / 255);
}

/** The optional trailing alpha: `<percentage>` or a `<number>` already in [0, 1]. */
function toAlpha(token: string | undefined): number | null {
    if (token === undefined) {
        return 1;
    }
    if (token.endsWith("%")) {
        return toFraction(token);
    }
    const value = toNumber(token);
    return value === null ? null : clamp01(value);
}

/** A hue in degrees. Only the bare and `deg` forms; `rad`/`turn` fall back. */
function toHue(token: string): number | null {
    return toNumber(token.endsWith("deg") ? token.slice(0, -3) : token);
}

/**
 * Splits `name(a, b, c)` / `namea(a b c / d)` into argument tokens.
 * Returns null for anything else, including nested functions such as
 * `rgb(calc(...) 0 0)` — those go to the canvas.
 */
function functionArguments(value: string, name: string): string[] | null {
    const open = value.indexOf("(");
    if (open === -1 || !value.endsWith(")")) {
        return null;
    }

    const fn = value.slice(0, open);
    if (fn !== name && fn !== `${name}a`) {
        return null;
    }

    const body = value.slice(open + 1, -1).trim();
    if (!body || body.includes("(")) {
        return null;
    }

    const tokens = body.split(ARGUMENT_SEPARATOR);
    return tokens.length === 3 || tokens.length === 4 ? tokens : null;
}

function parseHex(value: string): RGBA | null {
    if (!HEX.test(value)) {
        return null;
    }

    // #rgb / #rgba expand each digit to a byte: #1af -> #11aaff.
    const digits = value.length <= 5 ? Array.from(value.slice(1), (d) => d + d).join("") : value.slice(1);
    const byte = (index: number) => parseInt(digits.slice(index * 2, index * 2 + 2), 16) / 255;

    return [byte(0), byte(1), byte(2), digits.length === 8 ? byte(3) : 1];
}

function parseRgb(value: string): RGBA | null {
    const tokens = functionArguments(value, "rgb");
    if (!tokens) {
        return null;
    }

    const r = toChannel(tokens[0]);
    const g = toChannel(tokens[1]);
    const b = toChannel(tokens[2]);
    const a = toAlpha(tokens[3]);
    if (r === null || g === null || b === null || a === null) {
        return null;
    }

    return [r, g, b, a];
}

/** CSS Color 4 hsl-to-rgb, in the compact form from the spec's sample code. */
function parseHsl(value: string): RGBA | null {
    const tokens = functionArguments(value, "hsl");
    if (!tokens) {
        return null;
    }

    const h = toHue(tokens[0]);
    const s = toFraction(tokens[1]);
    const l = toFraction(tokens[2]);
    const a = toAlpha(tokens[3]);
    if (h === null || s === null || l === null || a === null) {
        return null;
    }

    const hue = (((h % 360) + 360) % 360) / 30;
    const chroma = s * Math.min(l, 1 - l);
    const channel = (n: number) => {
        const k = (n + hue) % 12;
        return clamp01(l - chroma * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
    };

    return [channel(0), channel(8), channel(4), a];
}

/**
 * Inline parser for the color forms a per-frame `styleOf` is most likely to
 * build. Returns null for everything else (named colors, `color-mix()`, ...),
 * which the canvas then normalizes.
 */
function parseFast(color: string): RGBA | null {
    const value = color.trim().toLowerCase();

    if (value.charCodeAt(0) === HASH) {
        return parseHex(value);
    }
    if (value.startsWith("rgb")) {
        return parseRgb(value);
    }
    if (value.startsWith("hsl")) {
        return parseHsl(value);
    }
    return null;
}

/**
 * Parses arbitrary CSS color strings into normalized RGBA components.
 *
 * The public draw API accepts the same CSS color strings as the Canvas2D
 * renderer ("#rrggbb", "rgba(...)", named colors, ...). To support all of them
 * without shipping a full color parser, we lean on the platform: a 1x1 offscreen
 * 2D canvas normalizes any valid CSS color, and we read the painted pixel back.
 *
 * That readback is a GPU->CPU sync, so the hex, `rgb()`, and `hsl()` forms —
 * everything a dynamic `styleOf` is likely to build per frame — are parsed
 * inline instead and never touch the canvas. Results are memoized in a bounded
 * LRU: a fixed palette stays resident because it is touched every frame, while
 * computed-per-frame colors cost a fixed amount of memory rather than one
 * permanent entry each.
 * @internal
 */
export class ColorParser {
    private cache = new LruCache<string, RGBA>(COLOR_CACHE_LIMIT);
    private ctx: CanvasRenderingContext2D | null = null;

    constructor() {
        if (typeof document !== "undefined") {
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            this.ctx = canvas.getContext("2d", { willReadFrequently: true });
        }
    }

    /**
     * Convert a CSS color string into normalized RGBA floats.
     * Falls back to opaque white for unparseable input.
     */
    parse(color: string | undefined): RGBA {
        if (!color) {
            return WHITE;
        }

        const cached = this.cache.get(color);
        if (cached) {
            return cached;
        }

        const rgba = parseFast(color) ?? this.compute(color);
        this.cache.set(color, rgba);
        return rgba;
    }

    private compute(color: string): RGBA {
        if (!this.ctx) {
            return WHITE;
        }

        try {
            this.ctx.clearRect(0, 0, 1, 1);
            this.ctx.fillStyle = "#000";
            this.ctx.fillStyle = color;
            this.ctx.fillRect(0, 0, 1, 1);
            const data = this.ctx.getImageData(0, 0, 1, 1).data;
            return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
        } catch {
            return WHITE;
        }
    }

    clear() {
        this.cache.clear();
    }
}
