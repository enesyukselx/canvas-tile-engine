import { describe, expect, it } from "vitest";
import { SpatialIndex, type SpatialItem } from "../../src/modules/SpatialIndex";

const makeItems = (): SpatialItem[] => [
    { x: 0, y: 0 }, // point (size defaults to 0)
    { x: 10, y: 10, size: 4 }, // square from (8,8) to (12,12)
    { x: -5, y: -5, size: 2 }, // square from (-6,-6) to (-4,-4)
];

describe("SpatialIndex", () => {
    it("loads items and queries by bounding box", () => {
        const index = new SpatialIndex<SpatialItem>();
        index.load(makeItems());

        const hits = index.query(7, 7, 11, 11);
        expect(hits).toEqual([{ x: 10, y: 10, size: 4 }]);

        const pointHit = index.query(-1, -1, 1, 1);
        expect(pointHit).toEqual([{ x: 0, y: 0 }]);
    });

    it("clears all items", () => {
        const index = new SpatialIndex<SpatialItem>();
        index.load(makeItems());
        index.clear();
        expect(index.query(-100, -100, 100, 100)).toEqual([]);
    });

    it("creates index from array via static constructor", () => {
        const items = makeItems();
        const index = SpatialIndex.fromArray(items);
        const hits = index.query(-10, -10, -1, -1);
        expect(hits).toEqual([{ x: -5, y: -5, size: 2 }]);
    });
});
