import { describe, expect, it } from "vitest";
import { maxPxExtent, resolveBoxPx, resolveBoxWorld, resolveSizePx, resolveSizeWorld } from "../../src/utils/itemSize";

describe("resolveSizePx / resolveSizeWorld", () => {
    it("prefers sizePx over size", () => {
        expect(resolveSizePx({ size: 2, sizePx: 24 }, 40)).toBe(24);
        expect(resolveSizeWorld({ size: 2, sizePx: 24 }, 40)).toBe(0.6);
    });

    it("falls back to size, defaulting to one world unit", () => {
        expect(resolveSizePx({ size: 2 }, 40)).toBe(80);
        expect(resolveSizePx({}, 40)).toBe(40);
        expect(resolveSizeWorld({}, 40)).toBe(1);
    });
});

describe("resolveBoxPx / resolveBoxWorld", () => {
    // The precedence chain, per axis: widthPx -> sizePx -> width -> size
    it("uses the axis pixel field first", () => {
        const item = { size: 2, sizePx: 24, width: 5, height: 5, widthPx: 80, heightPx: 20 };

        expect(resolveBoxPx(item, 40)).toEqual({ width: 80, height: 20 });
        expect(resolveBoxWorld(item, 40)).toEqual({ width: 2, height: 0.5 });
    });

    it("falls back to the shared pixel size", () => {
        const item = { size: 2, sizePx: 24, width: 5 };

        expect(resolveBoxPx(item, 40)).toEqual({ width: 24, height: 24 });
        expect(resolveBoxWorld(item, 40)).toEqual({ width: 0.6, height: 0.6 });
    });

    it("falls back to world width/height, then to size", () => {
        expect(resolveBoxPx({ size: 2, width: 4 }, 10)).toEqual({ width: 40, height: 20 });
        expect(resolveBoxWorld({ size: 2, width: 4 }, 10)).toEqual({ width: 4, height: 2 });
        expect(resolveBoxWorld({}, 10)).toEqual({ width: 1, height: 1 });
    });

    it("mixes a pixel axis with a world axis", () => {
        const item = { widthPx: 80, height: 3 };

        expect(resolveBoxPx(item, 40)).toEqual({ width: 80, height: 120 });
        expect(resolveBoxWorld(item, 40)).toEqual({ width: 2, height: 3 });
    });

    it("keeps world values exact instead of round-tripping through pixels", () => {
        // 0.9 * 17 / 17 does not come back as 0.9 in binary floating point
        expect(resolveBoxWorld({ size: 0.9 }, 17)).toEqual({ width: 0.9, height: 0.9 });
    });

    it("grows the world box as the camera zooms out", () => {
        const item = { sizePx: 24 };

        expect(resolveBoxWorld(item, 48).width).toBe(0.5);
        expect(resolveBoxWorld(item, 12).width).toBe(2);
    });
});

describe("maxPxExtent", () => {
    it("reports the largest declared pixel extent", () => {
        expect(maxPxExtent({ sizePx: 24, widthPx: 80, heightPx: 20 })).toBe(80);
        expect(maxPxExtent({ heightPx: 20 })).toBe(20);
    });

    it("is zero for a purely world-sized item", () => {
        expect(maxPxExtent({ size: 4, width: 9 })).toBe(0);
    });
});
