import { describe, expect, it } from "vitest";
import { fitScale } from "../../src/utils/fitScale";

const VIEWPORT = { width: 800, height: 600 };

describe("fitScale", () => {
    it("returns the scale at which the tighter axis exactly fits", () => {
        // min(800 / 100, 600 / 50) = 8
        expect(fitScale({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, VIEWPORT)).toBe(8);
        // Height-limited content: min(800 / 10, 600 / 100) = 6
        expect(fitScale({ minX: 0, maxX: 10, minY: 0, maxY: 100 }, VIEWPORT)).toBe(6);
    });

    it("world padding grows the fitted area", () => {
        // min(800 / 120, 600 / 70)
        expect(fitScale({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, VIEWPORT, { padding: 10 })).toBeCloseTo(800 / 120);
    });

    it("paddingPx shrinks the viewport and wins over padding", () => {
        // min((800 - 80) / 100, (600 - 80) / 50) = 7.2
        expect(fitScale({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, VIEWPORT, { paddingPx: 40 })).toBeCloseTo(7.2);
        expect(
            fitScale({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, VIEWPORT, { padding: 10, paddingPx: 40 }),
        ).toBeCloseTo(7.2);
    });

    it("tracks content size so scale-limit constants need no retuning", () => {
        const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 50 };
        const grown = { minX: 0, maxX: 1000, minY: 0, maxY: 500 };
        // 10x content -> exactly 10x smaller fit scale (same pixel margin)
        expect(fitScale(grown, VIEWPORT, { paddingPx: 40 })).toBeCloseTo(
            fitScale(bounds, VIEWPORT, { paddingPx: 40 }) / 10,
        );
    });

    it("clamps an oversized paddingPx to 1px of fit area per axis", () => {
        // 2 * 500 exceeds both axes: avail floors at 1px -> min(1/100, 1/50)
        expect(fitScale({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, VIEWPORT, { paddingPx: 500 })).toBeCloseTo(1 / 100);
    });

    it("rejects invalid bounds, paddings, and sizes", () => {
        const bounds = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
        expect(() => fitScale({ ...bounds, maxX: 0 }, VIEWPORT)).toThrow();
        expect(() => fitScale({ ...bounds, maxY: Infinity }, VIEWPORT)).toThrow();
        expect(() => fitScale(bounds, VIEWPORT, { padding: -1 })).toThrow();
        expect(() => fitScale(bounds, VIEWPORT, { paddingPx: NaN })).toThrow();
        expect(() => fitScale(bounds, { width: 0, height: 600 })).toThrow();
        expect(() => fitScale(bounds, { width: 800, height: -5 })).toThrow();
        expect(() => fitScale(bounds, { width: 800, height: NaN })).toThrow();
    });
});
