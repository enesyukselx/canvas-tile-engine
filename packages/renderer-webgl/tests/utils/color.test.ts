import { describe, expect, it } from "vitest";
import { ColorParser } from "../../src/utils/color";

describe("ColorParser", () => {
    it("returns opaque white for undefined input", () => {
        const parser = new ColorParser();
        expect(parser.parse(undefined)).toEqual([1, 1, 1, 1]);
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
