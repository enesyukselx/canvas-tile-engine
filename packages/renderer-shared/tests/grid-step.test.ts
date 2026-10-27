import { describe, expect, it } from "vitest";
import { gridLineStep, MIN_GRID_LINE_SPACING_PX } from "../src/geometry";

describe("gridLineStep", () => {
    it("keeps the requested cellSize when lines are at least MIN_GRID_LINE_SPACING_PX apart", () => {
        expect(MIN_GRID_LINE_SPACING_PX).toBe(2);
        expect(gridLineStep(1, 10)).toBe(1);
        expect(gridLineStep(0.5, 10)).toBe(0.5);
        expect(gridLineStep(5, 1)).toBe(5);
    });

    it("keeps the requested cellSize at exactly the threshold", () => {
        expect(gridLineStep(1, 2)).toBe(1);
        expect(gridLineStep(0.5, 4)).toBe(0.5);
        expect(gridLineStep(20, 0.1)).toBe(20); // 20 * 0.1 rounds to exactly 2
    });

    it.each([
        // [cellSize, scale, expected step]
        [1, 1.999, 2],
        [1, 1, 2],
        [1, 0.5, 4],
        [1, 0.1, 32], // 16 * 0.1 = 1.6px < 2, 32 * 0.1 = 3.2px
        [0.25, 1, 2],
        [3, 0.2, 12],
    ])("doubles cellSize %s at scale %s up to %s", (cellSize, scale, expected) => {
        const step = gridLineStep(cellSize, scale);
        expect(step).toBe(expected);
        expect(step * scale).toBeGreaterThanOrEqual(MIN_GRID_LINE_SPACING_PX);
        // The smallest such power: half the step would be too dense.
        expect((step / 2) * scale).toBeLessThan(MIN_GRID_LINE_SPACING_PX);
    });

    it("returns a power-of-two multiple of cellSize, so snapped lines stay on the requested lattice", () => {
        // Binary-exact cell sizes keep the lattice check free of rounding noise.
        for (const cellSize of [1, 3, 0.5, 0.25, 7.25]) {
            for (const scale of [0.001, 0.07, 0.3, 1]) {
                const step = gridLineStep(cellSize, scale);
                expect(Number.isInteger(Math.log2(step / cellSize))).toBe(true);

                for (const topLeft of [-1234.5, -3, 0, 17, 98765.25]) {
                    const line = Math.floor(topLeft / step) * step;
                    expect(Number.isInteger(line / cellSize)).toBe(true);
                }
            }
        }
    });

    it("terminates for huge and tiny inputs", () => {
        expect(gridLineStep(1e300, 1e300)).toBe(1e300);
        expect(gridLineStep(1, 1e-300) * 1e-300).toBeGreaterThanOrEqual(MIN_GRID_LINE_SPACING_PX);
        expect(gridLineStep(Number.MIN_VALUE, Number.MIN_VALUE)).toBe(Infinity);
        // Degenerate scales never reach the threshold; the loop is capped.
        for (const scale of [0, -1, NaN]) {
            expect(() => gridLineStep(1, scale)).not.toThrow();
        }
    });
});
