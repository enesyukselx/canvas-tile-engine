import { describe, expect, it, beforeEach } from "vitest";
import { SpatialIndex, SpatialItem } from "../../src/modules/SpatialIndex";

interface TestItem extends SpatialItem {
    id: number;
}

describe("SpatialIndex", () => {
    let index: SpatialIndex<TestItem>;

    beforeEach(() => {
        index = new SpatialIndex<TestItem>();
    });

    describe("constructor", () => {
        it("creates an empty index", () => {
            const results = index.query(0, 0, 1000, 1000);
            expect(results).toEqual([]);
        });
    });

    describe("load", () => {
        it("loads items into the index", () => {
            const items: TestItem[] = [
                { id: 1, x: 10, y: 10 },
                { id: 2, x: 50, y: 50 },
                { id: 3, x: 90, y: 90 },
            ];
            index.load(items);
            const results = index.query(0, 0, 100, 100);
            expect(results).toHaveLength(3);
        });

        it("handles items with size", () => {
            const items: TestItem[] = [
                { id: 1, x: 10, y: 10, size: 5 },
                { id: 2, x: 50, y: 50, size: 20 },
            ];
            index.load(items);
            // Query should find item with size that overlaps
            const results = index.query(0, 0, 12, 12);
            expect(results.some((r) => r.id === 1)).toBe(true);
        });

        it("handles empty array", () => {
            index.load([]);
            const results = index.query(0, 0, 100, 100);
            expect(results).toEqual([]);
        });

        it("can load items in batches", () => {
            index.load([{ id: 1, x: 10, y: 10 }]);
            index.load([{ id: 2, x: 20, y: 20 }]);
            const results = index.query(0, 0, 100, 100);
            expect(results).toHaveLength(2);
        });
    });

    describe("query", () => {
        beforeEach(() => {
            const items: TestItem[] = [
                { id: 1, x: 10, y: 10 },
                { id: 2, x: 50, y: 50 },
                { id: 3, x: 90, y: 90 },
                { id: 4, x: 150, y: 150 },
            ];
            index.load(items);
        });

        it("returns items within query bounds", () => {
            const results = index.query(0, 0, 60, 60);
            expect(results).toHaveLength(2);
            expect(results.map((r) => r.id).sort()).toEqual([1, 2]);
        });

        it("returns empty array when no items in bounds", () => {
            const results = index.query(200, 200, 300, 300);
            expect(results).toEqual([]);
        });

        it("returns all items when bounds cover everything", () => {
            const results = index.query(0, 0, 200, 200);
            expect(results).toHaveLength(4);
        });

        it("handles negative coordinates", () => {
            const negIndex = new SpatialIndex<TestItem>();
            negIndex.load([
                { id: 1, x: -50, y: -50 },
                { id: 2, x: 50, y: 50 },
            ]);
            const results = negIndex.query(-100, -100, 0, 0);
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe(1);
        });

        it("handles point queries (min equals max)", () => {
            const results = index.query(10, 10, 10, 10);
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe(1);
        });

        it("respects item size in queries", () => {
            const sizedIndex = new SpatialIndex<TestItem>();
            sizedIndex.load([{ id: 1, x: 50, y: 50, size: 20 }]);
            // Item spans from 40-60 on both axes
            // Query that overlaps with the item's bounds
            const results = sizedIndex.query(35, 35, 45, 45);
            expect(results).toHaveLength(1);
        });

        it("excludes items when size does not overlap", () => {
            const sizedIndex = new SpatialIndex<TestItem>();
            sizedIndex.load([{ id: 1, x: 50, y: 50, size: 10 }]);
            // Item spans from 45-55 on both axes
            const results = sizedIndex.query(0, 0, 40, 40);
            expect(results).toHaveLength(0);
        });
    });

    describe("clear", () => {
        it("removes all items from the index", () => {
            index.load([
                { id: 1, x: 10, y: 10 },
                { id: 2, x: 50, y: 50 },
            ]);
            index.clear();
            const results = index.query(0, 0, 100, 100);
            expect(results).toEqual([]);
        });

        it("can load new items after clear", () => {
            index.load([{ id: 1, x: 10, y: 10 }]);
            index.clear();
            index.load([{ id: 2, x: 20, y: 20 }]);
            const results = index.query(0, 0, 100, 100);
            expect(results).toHaveLength(1);
            expect(results[0].id).toBe(2);
        });
    });

    describe("fromArray", () => {
        it("creates index from array of items", () => {
            const items: TestItem[] = [
                { id: 1, x: 10, y: 10 },
                { id: 2, x: 50, y: 50 },
            ];
            const newIndex = SpatialIndex.fromArray(items);
            const results = newIndex.query(0, 0, 100, 100);
            expect(results).toHaveLength(2);
        });

        it("creates empty index from empty array", () => {
            const newIndex = SpatialIndex.fromArray<TestItem>([]);
            const results = newIndex.query(0, 0, 100, 100);
            expect(results).toEqual([]);
        });

        it("handles items with size", () => {
            const items: TestItem[] = [{ id: 1, x: 50, y: 50, size: 30 }];
            const newIndex = SpatialIndex.fromArray(items);
            // Item spans from 35-65 on both axes
            const results = newIndex.query(30, 30, 40, 40);
            expect(results).toHaveLength(1);
        });
    });

    describe("performance characteristics", () => {
        it("handles large datasets", () => {
            const items: TestItem[] = [];
            for (let i = 0; i < 10000; i++) {
                items.push({
                    id: i,
                    x: Math.random() * 1000,
                    y: Math.random() * 1000,
                });
            }
            index.load(items);
            // Should be able to query efficiently
            const results = index.query(400, 400, 600, 600);
            expect(results.length).toBeGreaterThan(0);
            expect(results.length).toBeLessThan(10000);
        });
    });
});
