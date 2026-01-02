import { describe, expect, it } from "vitest";
import { gridToSize } from "../../src/utils/gridToSize";

describe("gridToSize", () => {
    it("calculates size from columns, rows, and cellSize", () => {
        const result = gridToSize({ columns: 12, rows: 12, cellSize: 50 });

        expect(result).toEqual({
            size: { width: 600, height: 600 },
            scale: 50,
        });
    });

    it("handles non-square grids", () => {
        const result = gridToSize({ columns: 20, rows: 10, cellSize: 32 });

        expect(result).toEqual({
            size: { width: 640, height: 320 },
            scale: 32,
        });
    });

    it("handles small cell sizes", () => {
        const result = gridToSize({ columns: 100, rows: 50, cellSize: 8 });

        expect(result).toEqual({
            size: { width: 800, height: 400 },
            scale: 8,
        });
    });

    it("handles single cell grid", () => {
        const result = gridToSize({ columns: 1, rows: 1, cellSize: 100 });

        expect(result).toEqual({
            size: { width: 100, height: 100 },
            scale: 100,
        });
    });

    it("returns scale equal to cellSize", () => {
        const cellSize = 64;
        const result = gridToSize({ columns: 5, rows: 3, cellSize });

        expect(result.scale).toBe(cellSize);
    });
});
