import { describe, expect, it } from "vitest";
import { itemsBounds } from "../../src/utils/itemBounds";

describe("itemsBounds", () => {
    it("returns null for an empty list", () => {
        expect(itemsBounds([])).toBeNull();
    });

    it("treats a sizeless item as one cell centered on its anchor", () => {
        expect(itemsBounds([{ x: 0, y: 0 }])).toEqual({ minX: -0.5, maxX: 0.5, minY: -0.5, maxY: 0.5 });
    });

    it("expands by half the item size", () => {
        expect(itemsBounds([{ x: 10, y: 4, size: 4 }])).toEqual({ minX: 8, maxX: 12, minY: 2, maxY: 6 });
    });

    it("lets width/height override size per axis", () => {
        expect(itemsBounds([{ x: 0, y: 0, size: 4, width: 8, height: 2 }])).toEqual({
            minX: -4,
            maxX: 4,
            minY: -1,
            maxY: 1,
        });
    });

    it("falls back to size on the axis that has no override", () => {
        expect(itemsBounds([{ x: 0, y: 0, size: 4, width: 8 }])).toEqual({
            minX: -4,
            maxX: 4,
            minY: -2,
            maxY: 2,
        });
    });

    it("encloses every item, including negative coordinates", () => {
        expect(
            itemsBounds([
                { x: 0, y: 0, size: 1 },
                { x: -10, y: 5, size: 2 },
                { x: 7, y: -3 },
            ]),
        ).toEqual({ minX: -11, maxX: 7.5, minY: -3.5, maxY: 6 });
    });

    it("ignores order", () => {
        const items = [
            { x: 3, y: 3, size: 1 },
            { x: 1, y: 1, size: 1 },
        ];
        expect(itemsBounds(items)).toEqual(itemsBounds([...items].reverse()));
    });
});
