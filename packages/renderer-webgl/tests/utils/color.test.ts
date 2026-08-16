import { describe, expect, it } from "vitest";
import { COLOR_CACHE_LIMIT } from "@canvas-tile-engine/renderer-shared/cache";
import { ColorParser } from "../../src/utils/color";

// These run under `environment: "node"`, so there is no 1x1 canvas to fall back
// on: every value asserted below is produced by the inline fast path, and
// anything it rejects lands on opaque white.
const WHITE = [1, 1, 1, 1];

describe("ColorParser", () => {
    it("returns opaque white for undefined input", () => {
        const parser = new ColorParser();
        expect(parser.parse(undefined)).toEqual(WHITE);
    });

    it("returns a normalized 4-component RGBA tuple", () => {
        const parser = new ColorParser();
        const rgba = parser.parse("#ff0000");

        expect(rgba).toHaveLength(4);
        for (const channel of rgba) {
            expect(channel).toBeGreaterThanOrEqual(0);
            expect(channel).toBeLessThanOrEqual(1);
        }
    });

    it("caches results so repeated parses return the same reference", () => {
        const parser = new ColorParser();
        const first = parser.parse("#123456");
        const second = parser.parse("#123456");

        expect(second).toBe(first);
    });

    it("keeps returning an equal value after clear()", () => {
        const parser = new ColorParser();
        const first = parser.parse("#abcdef");
        parser.clear();
        const second = parser.parse("#abcdef");

        expect(second).toEqual(first);
    });
});

describe("ColorParser hex fast path", () => {
    const parse = (color: string) => new ColorParser().parse(color);

    it("parses #rrggbb", () => {
        expect(parse("#ff0000")).toEqual([1, 0, 0, 1]);
        expect(parse("#0000ff")).toEqual([0, 0, 1, 1]);
        expect(parse("#808080")).toEqual([128 / 255, 128 / 255, 128 / 255, 1]);
    });

    it("parses #rrggbbaa", () => {
        expect(parse("#00ff0080")).toEqual([0, 1, 0, 128 / 255]);
    });

    it("expands the #rgb and #rgba shorthands", () => {
        expect(parse("#1af")).toEqual(parse("#11aaff"));
        expect(parse("#1af8")).toEqual(parse("#11aaff88"));
    });

    it("ignores case and surrounding whitespace", () => {
        expect(parse("  #FF0000 ")).toEqual([1, 0, 0, 1]);
    });

    it("rejects malformed hex", () => {
        expect(parse("#ff000")).toEqual(WHITE); // only 3, 4, 6, and 8 digits exist
        expect(parse("#ff00000")).toEqual(WHITE);
        expect(parse("#ff00zz")).toEqual(WHITE);
    });
});

describe("ColorParser rgb() fast path", () => {
    const parse = (color: string) => new ColorParser().parse(color);

    it("parses the legacy comma syntax", () => {
        expect(parse("rgb(255, 0, 0)")).toEqual([1, 0, 0, 1]);
        expect(parse("rgba(0, 255, 0, 0.5)")).toEqual([0, 1, 0, 0.5]);
    });

    it("parses the modern space syntax with a slash alpha", () => {
        expect(parse("rgb(0 0 255 / 50%)")).toEqual([0, 0, 1, 0.5]);
    });

    it("parses percentage components", () => {
        expect(parse("rgb(100%, 0%, 50%)")).toEqual([1, 0, 0.5, 1]);
    });

    it("clamps out-of-range components", () => {
        expect(parse("rgb(300, -20, 0)")).toEqual([1, 0, 0, 1]);
        expect(parse("rgba(0, 0, 0, 2)")).toEqual([0, 0, 0, 1]);
    });

    it("leaves anything it does not fully understand to the canvas", () => {
        expect(parse("rgb(255, 0)")).toEqual(WHITE);
        expect(parse("rgb(255, 0, none)")).toEqual(WHITE);
        expect(parse("rgb(calc(1 + 1) 0 0)")).toEqual(WHITE);
        expect(parse("rgbx(1, 2, 3)")).toEqual(WHITE);
    });
});

describe("ColorParser hsl() fast path", () => {
    const parse = (color: string) => new ColorParser().parse(color);
    const round = (rgba: number[]) => rgba.map((c) => Math.round(c * 255));

    it("converts the primaries", () => {
        expect(round(parse("hsl(0, 100%, 50%)"))).toEqual([255, 0, 0, 255]);
        expect(round(parse("hsl(120, 100%, 50%)"))).toEqual([0, 255, 0, 255]);
        expect(round(parse("hsl(240, 100%, 50%)"))).toEqual([0, 0, 255, 255]);
    });

    it("handles greys, black, and white", () => {
        expect(round(parse("hsl(0, 0%, 50%)"))).toEqual([128, 128, 128, 255]);
        expect(round(parse("hsl(200, 80%, 0%)"))).toEqual([0, 0, 0, 255]);
        expect(round(parse("hsl(200, 80%, 100%)"))).toEqual([255, 255, 255, 255]);
    });

    it("wraps the hue and accepts the deg unit", () => {
        expect(parse("hsl(480, 100%, 50%)")).toEqual(parse("hsl(120, 100%, 50%)"));
        expect(parse("hsl(-120deg, 100%, 50%)")).toEqual(parse("hsl(240, 100%, 50%)"));
    });

    it("parses alpha from both syntaxes", () => {
        expect(parse("hsla(0, 100%, 50%, 0.25)")).toEqual([1, 0, 0, 0.25]);
        expect(parse("hsl(0 100% 50% / 25%)")).toEqual([1, 0, 0, 0.25]);
    });

    it("leaves angle units it does not implement to the canvas", () => {
        expect(parse("hsl(0.5turn, 100%, 50%)")).toEqual(WHITE);
    });

    // The shape the issue calls out: a computed color per frame per item.
    it("parses an interpolated heat-map color", () => {
        const load = 0.75;
        expect(round(parse(`hsl(${load * 120}, 70%, 50%)`))).toEqual([128, 217, 38, 255]);
    });
});

describe("ColorParser cache bounds", () => {
    it("drops the least recently used color instead of growing forever", () => {
        const parser = new ColorParser();
        const first = parser.parse("hsl(0, 70%, 50%)");

        // One fresh color string per frame, exactly what an animated `styleOf`
        // produces. Without a bound these would all be resident forever.
        for (let i = 1; i <= COLOR_CACHE_LIMIT; i++) {
            parser.parse(`hsl(${i}, 70%, 50%)`);
        }

        // Evicted, so it is recomputed into a new tuple rather than returned.
        expect(parser.parse("hsl(0, 70%, 50%)")).not.toBe(first);
        expect(parser.parse("hsl(0, 70%, 50%)")).toEqual(first);
    });

    it("keeps a palette color that is used every frame", () => {
        const parser = new ColorParser();
        const palette = parser.parse("#3b82f6");

        for (let i = 0; i < COLOR_CACHE_LIMIT * 2; i++) {
            expect(parser.parse("#3b82f6")).toBe(palette);
            parser.parse(`hsl(${i % 360}.${i}, 70%, 50%)`);
        }
    });
});
