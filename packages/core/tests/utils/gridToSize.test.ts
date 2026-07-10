import { describe, expect, it } from "vitest";
import { gridToSize } from "../../src/utils/gridToSize";

describe("gridToSize", () => {
    it("calculates size from columns, rows, and cellSize", () => {
        const result = gridToSize({ columns: 12, rows: 12, cellSize: 50 });

        expect(result).toEqual({
            size: { width: 600, height: 600 },
            scale: 50,
            center: { x: 5.5, y: 5.5 },
        });
    });

    it("handles non-square grids", () => {
        const result = gridToSize({ columns: 20, rows: 10, cellSize: 32 });

        expect(result).toEqual({
            size: { width: 640, height: 320 },
            scale: 32,
            center: { x: 9.5, y: 4.5 },
        });
    });

    it("handles small cell sizes", () => {
        const result = gridToSize({ columns: 100, rows: 50, cellSize: 8 });

        expect(result).toEqual({
            size: { width: 800, height: 400 },
            scale: 8,
            center: { x: 49.5, y: 24.5 },
        });
    });

    it("handles single cell grid", () => {
        const result = gridToSize({ columns: 1, rows: 1, cellSize: 100 });

        expect(result).toEqual({
            size: { width: 100, height: 100 },
            scale: 100,
            center: { x: 0, y: 0 },
        });
    });

    it("returns scale equal to cellSize", () => {
        const cellSize = 64;
        const result = gridToSize({ columns: 5, rows: 3, cellSize });

        expect(result.scale).toBe(cellSize);
    });

    describe("center", () => {
        // Integers are cell centers: a board of cells 0..N-1 spans world
        // [-0.5, N-0.5], so its center is (N-1)/2 on each axis.
        it("returns the board center for even cell counts (half-integer)", () => {
            const result = gridToSize({ columns: 20, rows: 20, cellSize: 15 });
            expect(result.center).toEqual({ x: 9.5, y: 9.5 });
        });

        it("returns the board center for odd cell counts (integer)", () => {
            const result = gridToSize({ columns: 5, rows: 3, cellSize: 10 });
            expect(result.center).toEqual({ x: 2, y: 1 });
        });
    });
});
