import { describe, expect, it } from "vitest";
import { resolveLineWidthPx, resolveLineDashPx, resolveRadiusPx } from "../../src/utils/strokeStyle";

describe("resolveLineWidthPx", () => {
    it("scales world lineWidth by the current scale", () => {
        expect(resolveLineWidthPx({ lineWidth: 0.1 }, 50)).toBe(5);
    });

    it("returns lineWidthPx as-is, independent of scale", () => {
        expect(resolveLineWidthPx({ lineWidthPx: 3 }, 50)).toBe(3);
        expect(resolveLineWidthPx({ lineWidthPx: 3 }, 5)).toBe(3);
    });

    it("prefers lineWidthPx over lineWidth when both are set", () => {
        expect(resolveLineWidthPx({ lineWidth: 0.1, lineWidthPx: 2 }, 50)).toBe(2);
    });

    it("falls back to a 1px hairline when neither is set", () => {
        expect(resolveLineWidthPx(undefined, 50)).toBe(1);
        expect(resolveLineWidthPx({}, 50)).toBe(1);
    });
});

describe("resolveLineDashPx", () => {
    it("scales world lineDash by the current scale", () => {
        expect(resolveLineDashPx({ lineDash: [0.2, 0.1] }, 50)).toEqual([10, 5]);
    });

    it("returns lineDashPx as-is, independent of scale", () => {
        expect(resolveLineDashPx({ lineDashPx: [8, 4] }, 50)).toEqual([8, 4]);
    });

    it("prefers lineDashPx over lineDash when both are set", () => {
        expect(resolveLineDashPx({ lineDash: [0.2], lineDashPx: [8, 4] }, 50)).toEqual([8, 4]);
    });

    it("doubles odd-length patterns like Canvas2D setLineDash", () => {
        expect(resolveLineDashPx({ lineDashPx: [5] }, 50)).toEqual([5, 5]);
        expect(resolveLineDashPx({ lineDash: [0.1] }, 10)).toEqual([1, 1]);
    });

    it("returns undefined (solid) for empty, negative, non-finite, or all-zero patterns", () => {
        expect(resolveLineDashPx(undefined, 50)).toBeUndefined();
        expect(resolveLineDashPx({}, 50)).toBeUndefined();
        expect(resolveLineDashPx({ lineDashPx: [] }, 50)).toBeUndefined();
        expect(resolveLineDashPx({ lineDashPx: [8, -4] }, 50)).toBeUndefined();
        expect(resolveLineDashPx({ lineDashPx: [8, NaN] }, 50)).toBeUndefined();
        expect(resolveLineDashPx({ lineDashPx: [0, 0] }, 50)).toBeUndefined();
    });
});

describe("resolveRadiusPx", () => {
    it("scales a single world radius", () => {
        expect(resolveRadiusPx(0.2, 50)).toBe(10);
    });

    it("scales per-corner arrays", () => {
        expect(resolveRadiusPx([0.1, 0.2, 0.3, 0.4], 10)).toEqual([1, 2, 3, 4]);
    });

    it("returns undefined when radius is absent", () => {
        expect(resolveRadiusPx(undefined, 50)).toBeUndefined();
    });
});
