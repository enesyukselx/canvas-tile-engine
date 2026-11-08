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

    describe("registration order", () => {
        it.each([499, 500, 501])("preserves input order for %i overlapping items", (count) => {
            const items = Array.from({ length: count }, (_, id) => ({ id, x: 0, y: 0, size: 2 }));
            index.load(items);

            expect(index.query(-1, -1, 1, 1)).toEqual(items);
        });

        it("preserves relative input order for spatially scattered query subsets", () => {
            const items = Array.from({ length: 1000 }, (_, id) => ({
                id,
                x: (id * 37) % 101,
                y: (id * 17) % 97,
                size: 2,
            }));
            index.load(items);

            for (const [minX, minY, maxX, maxY] of [
                [20, 30, 60, 70],
                [0, 0, 20, 20],
                [50, 50, 100, 100],
            ]) {
                const expected = items.filter(
                    (item) => item.x + 1 >= minX && item.x - 1 <= maxX && item.y + 1 >= minY && item.y - 1 <= maxY,
                );
                expect(expected.length).toBeGreaterThan(1);
                expect(expected.length).toBeLessThan(items.length);
                expect(index.query(minX, minY, maxX, maxY)).toEqual(expected);
            }
            // Sorting a query's results must not change later queries or the caller's array.
            expect(index.query(-1, -1, 102, 98)).toEqual(items);
            expect(items.map((item) => item.id)).toEqual(Array.from({ length: 1000 }, (_, id) => id));
        });

        it("appends batches and individual items in load order", () => {
            const items = Array.from({ length: 700 }, (_, id) => ({ id, x: id % 23, y: id % 31 }));
            index.load(items.slice(0, 199));
            index.load([]);
            index.load(items.slice(199, 699));
            index.load(items.slice(699));

            expect(index.query(-1, -1, 32, 32)).toEqual(items);
            expect(index.query(5, 10, 15, 20)).toEqual(
                items.filter((item) => item.x >= 5 && item.x <= 15 && item.y >= 10 && item.y <= 20),
            );
        });

        it("keeps repeated object references at their own registration positions without mutating items", () => {
            const repeated = Object.freeze({ id: -1, x: 0, y: 0 });
            const middle = Array.from({ length: 501 }, (_, id) => Object.freeze({ id, x: 0, y: 0 }));
            const items = [repeated, ...middle, repeated];
            index.load(items.slice(0, 250));
            index.load(items.slice(250));

            const results = index.query(-1, -1, 1, 1);
            expect(results).toEqual(items);
            results.forEach((item, i) => expect(item).toBe(items[i]));
            expect(Object.keys(repeated)).toEqual(["id", "x", "y"]);
        });

        it("preserves new load order after clearing a populated index", () => {
            index.load(Array.from({ length: 501 }, (_, id) => ({ id, x: 0, y: 0 })));
            index.clear();
            expect(index.query(-1, -1, 1, 1)).toEqual([]);

            const items = Array.from({ length: 501 }, (_, i) => ({ id: 1000 - i, x: 0, y: 0 }));
            index.load(items.slice(0, 300));
            index.load(items.slice(300));
            expect(index.query(-1, -1, 1, 1)).toEqual(items);
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

    describe("incremental changes", () => {
        it("updates old and new spatial partitions while preserving registration order", () => {
            const items = Array.from({ length: 1000 }, (_, id) => ({ id, x: id * 10, y: id % 17, size: 2 }));
            const tokens = index.load(items);
            const moved = { ...items[5], x: 9000, y: 0, width: 40, height: 4 };

            expect(index.update(tokens[5], moved)).toBe(true);
            expect(index.query(49, 4, 51, 6)).toEqual([]);
            expect(index.query(8990, -1, 8991, 1)).toContain(moved);
            expect(index.query(-1, -1, 10001, 20)).toEqual(items.map((item, i) => (i === 5 ? moved : item)));
        });

        it("removes by saved bounds even when the item object itself was mutated", () => {
            const items = Array.from({ length: 1000 }, (_, id) => ({ id, x: id * 10, y: 0, size: 2 }));
            const tokens = index.load(items);
            items[5].x = 50000;

            expect(index.update(tokens[5], items[5])).toBe(true);
            expect(index.query(49, -1, 51, 1)).toEqual([]);
            expect(index.query(49999, -1, 50001, 1)).toEqual([items[5]]);
            expect(index.query(-1, -1, 50001, 1)).toHaveLength(items.length);
        });

        it("addresses repeated object references independently", () => {
            const repeated = { id: 1, x: 0, y: 0 };
            const middle = { id: 2, x: 0, y: 0 };
            const tokens = index.load([repeated, middle, repeated]);
            const replacement = { id: 3, x: 0, y: 0 };

            expect(tokens[0]).not.toBe(tokens[2]);
            expect(index.update(tokens[2], replacement)).toBe(true);
            expect(index.query(-1, -1, 1, 1)).toEqual([repeated, middle, replacement]);
            expect(index.remove(tokens[0])).toBe(true);
            expect(index.query(-1, -1, 1, 1)).toEqual([middle, replacement]);
        });

        it("appends inserted occurrences after bulk loads and does not resurrect removed tokens", () => {
            const first = { id: 1, x: 0, y: 0 };
            const [token] = index.load([first]);
            const second = { id: 2, x: 0, y: 0 };
            index.insert(second);
            expect(index.remove(token)).toBe(true);
            expect(index.remove(token)).toBe(false);
            expect(index.update(token, first)).toBe(false);
            index.insert(first);
            expect(index.query(-1, -1, 1, 1)).toEqual([second, first]);
        });

        it("rejects foreign and cleared tokens without changing either tree", () => {
            const item = { id: 1, x: 0, y: 0 };
            const token = index.insert(item);
            const other = new SpatialIndex<TestItem>();
            expect(other.remove(token)).toBe(false);
            expect(other.update(token, { ...item, x: 10 })).toBe(false);
            expect(index.query(-1, -1, 1, 1)).toEqual([item]);
            index.clear();
            const replacement = { id: 2, x: 0, y: 0 };
            index.insert(replacement);
            expect(index.remove(token)).toBe(false);
            expect(index.update(token, item)).toBe(false);
            expect(index.query(-1, -1, 1, 1)).toEqual([replacement]);
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

describe("non-square bounding boxes", () => {
    it("uses width/height for the bbox instead of size when present", () => {
        const index = SpatialIndex.fromArray([{ x: 10, y: 10, size: 1, width: 8, height: 2 }]);

        // Inside the 8-wide box but outside a size-1 box
        expect(index.query(13, 10, 14, 10)).toHaveLength(1);
        // Inside vertically only for the 2-high box
        expect(index.query(10, 10.9, 10, 10.9)).toHaveLength(1);
        // Outside the 2-high box
        expect(index.query(10, 11.5, 10, 11.5)).toHaveLength(0);
    });
});

describe("negative and NaN extents", () => {
    it("indexes a negative-size item as its anchor point instead of an inverted box", () => {
        const index = SpatialIndex.fromArray([{ x: 10, y: 10, size: -4 }]);

        // An inverted box (minX 12 > maxX 8) only matched queries spanning it whole.
        expect(index.query(10, 10, 10, 10)).toHaveLength(1);
        expect(index.query(11, 10, 11, 10)).toHaveLength(0);
    });

    it("clamps each axis independently", () => {
        const index = SpatialIndex.fromArray([{ x: 0, y: 0, width: 4, height: -2 }]);

        expect(index.query(1.5, 0, 1.5, 0)).toHaveLength(1);
        expect(index.query(0, 0.5, 0, 0.5)).toHaveLength(0);
    });

    it("does not let a NaN extent hide the rest of the tree", () => {
        // NaN bounds propagate into every ancestor node, and no query can
        // intersect a NaN box, so one bad item used to blank the whole index.
        const items = Array.from({ length: 50 }, (_, i) => ({ x: i, y: 0, size: 1 }));
        items[7].size = NaN;
        const index = SpatialIndex.fromArray(items);

        expect(index.query(20, 0, 20, 0)).toEqual([items[20]]);
        expect(index.query(7, 0, 7, 0)).toEqual([items[7]]);
    });
});

describe("non-finite positions", () => {
    const grid = () => Array.from({ length: 200 }, (_, i) => ({ x: i % 20, y: Math.floor(i / 20), size: 1 }));

    it.each([NaN, Infinity, -Infinity])("indexes an item at %s nowhere without hiding the rest", (value) => {
        const items = grid();
        items[7].x = value;
        items[42].y = value;
        const index = SpatialIndex.fromArray(items);

        expect(index.query(-1e9, -1e9, 1e9, 1e9)).toHaveLength(198);
        expect(index.query(8, 0, 8, 0)).toEqual([items[8]]);
        expect(index.query(15, 9, 15, 9)).toEqual([items[195]]);
    });

    it("keeps insert, update and remove working around nowhere entries", () => {
        const items = grid();
        const index = new SpatialIndex<{ x: number; y: number; size: number }>();
        const tokens = index.load(items);
        const lost = { x: NaN, y: 3, size: 1 };
        const lostToken = index.insert(lost);
        index.insert({ x: Infinity, y: Infinity, size: 1 });

        expect(index.query(0, 3, 0, 3)).toEqual([items[60]]);

        // Into and out of nowhere, then removed while nowhere.
        expect(index.update(tokens[60], { x: NaN, y: NaN, size: 1 })).toBe(true);
        expect(index.query(0, 3, 0, 3)).toEqual([]);
        const back = { x: 0, y: 3, size: 1 };
        expect(index.update(tokens[60], back)).toBe(true);
        expect(index.query(0, 3, 0, 3)).toEqual([back]);
        expect(index.remove(lostToken)).toBe(true);
        expect(index.remove(lostToken)).toBe(false);
        expect(index.query(-1e9, -1e9, 1e9, 1e9)).toHaveLength(200);
    });
});
