import { describe, expect, expectTypeOf, it } from "vitest";
import { itemsBounds, pathItemBounds } from "../../src/utils/itemBounds";
import { ItemCollection, type ReadonlyItemCollection } from "../../src/modules/ItemCollection";
import type { Circle, ImageItem, Line, PathItem, Rect, Text } from "../../src/types";

describe("itemsBounds", () => {
    it("returns null for an empty list", () => {
        expect(itemsBounds([])).toBeNull();
    });

    describe("anchored items", () => {
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

        // A negative or NaN extent paints nothing on every renderer, so it is
        // skipped like any other item that draws nothing.
        it.each([{ size: -4 }, { size: NaN }, { width: -2, height: 2 }, { width: 2, height: NaN }, { size: 0 }])(
            "skips an item with %j instead of returning an inverted box",
            (extent) => {
                expect(itemsBounds([{ x: 2, y: 2, ...extent }])).toBeNull();
                expect(
                    itemsBounds([
                        { x: 0, y: 0, size: 2 },
                        { x: 50, y: -50, ...extent },
                    ]),
                ).toEqual({
                    minX: -1,
                    maxX: 1,
                    minY: -1,
                    maxY: 1,
                });
            },
        );

        it("keeps an item with one valid zero side", () => {
            expect(itemsBounds([{ x: 0, y: 0, width: 4, height: 0 }])).toEqual({
                minX: -2,
                maxX: 2,
                minY: 0,
                maxY: 0,
            });
        });
    });

    describe("lines", () => {
        it("boxes the two endpoints regardless of direction", () => {
            const box = { minX: 1, maxX: 4, minY: 2, maxY: 6 };
            expect(itemsBounds([{ from: { x: 1, y: 2 }, to: { x: 4, y: 6 } }])).toEqual(box);
            expect(itemsBounds([{ from: { x: 4, y: 6 }, to: { x: 1, y: 2 } }])).toEqual(box);
        });

        it("keeps an axis-aligned line's box flat", () => {
            expect(itemsBounds([{ from: { x: 0, y: 3 }, to: { x: 8, y: 3 } }])).toEqual({
                minX: 0,
                maxX: 8,
                minY: 3,
                maxY: 3,
            });
        });
    });

    describe("paths", () => {
        it("boxes polyline vertices", () => {
            expect(
                itemsBounds([
                    {
                        points: [
                            { x: 2, y: 5 },
                            { x: -3, y: 1 },
                            { x: 4, y: -2 },
                        ],
                    },
                ]),
            ).toEqual({ minX: -3, maxX: 4, minY: -2, maxY: 5 });
        });

        it("uses the control-point hull for command paths", () => {
            expect(
                itemsBounds([
                    {
                        commands: [
                            { type: "moveTo", x: 0, y: 0 },
                            { type: "quadraticCurveTo", cpx: 5, cpy: 10, x: 10, y: 0 },
                        ],
                    },
                ]),
            ).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 10 });
        });

        it("skips paths that draw nothing", () => {
            expect(itemsBounds([{ points: [] }])).toBeNull();
            expect(itemsBounds([{ points: [{ x: 1, y: 1 }] }])).toBeNull();
            expect(itemsBounds([{ commands: [] }])).toBeNull();
        });

        it("does not let a skipped path shrink the box", () => {
            expect(itemsBounds([{ x: 5, y: 5, size: 2 }, { points: [{ x: 100, y: 100 }] }])).toEqual({
                minX: 4,
                maxX: 6,
                minY: 4,
                maxY: 6,
            });
        });
    });

    describe("mixed lists", () => {
        it("encloses every kind at once", () => {
            const rect: Rect = { x: 0, y: 0, size: 2 };
            const circle: Circle = { x: 6, y: 0, size: 2 };
            const text: Text = { x: 0, y: 6, text: "hi", size: 1 };
            const image: ImageItem<unknown> = { x: -4, y: 0, size: 2, img: undefined as unknown };
            const line: Line = { from: { x: 0, y: -8 }, to: { x: 3, y: -6 } };
            const path: PathItem = {
                points: [
                    { x: 9, y: 9 },
                    { x: 10, y: 10 },
                ],
            };

            expect(itemsBounds([rect, circle, text, image, line, path])).toEqual({
                minX: -5,
                maxX: 10,
                minY: -8,
                maxY: 10,
            });
        });

        it("accepts the hitTest item union without filtering", () => {
            const items: Array<Rect | Circle | ImageItem<unknown> | PathItem | Line> = [
                { x: 1, y: 1, size: 1 },
                { from: { x: 0, y: 0 }, to: { x: 2, y: 2 } },
            ];
            expect(itemsBounds(items)).toEqual({ minX: 0, maxX: 2, minY: 0, maxY: 2 });
        });

        it("skips objects that carry no geometry", () => {
            expect(itemsBounds([{} as PathItem, { x: 2, y: 2, size: 2 }])).toEqual({
                minX: 1,
                maxX: 3,
                minY: 1,
                maxY: 3,
            });
        });
    });

    // The same item sources the draw calls accept. These calls are also the
    // type-level test: the suite is type-checked, and each line used to be
    // TS2345 (and a collection threw "items is not iterable" at runtime).
    describe("item sources", () => {
        type Seat = { id: string };
        const seats: Rect<Seat>[] = [
            { x: 0, y: 0, size: 1, data: { id: "a" } },
            { x: 3, y: 2, size: 1, data: { id: "b" } },
        ];
        const seatBounds = { minX: -0.5, maxX: 3.5, minY: -0.5, maxY: 2.5 };

        it("accepts a readonly array", () => {
            const frozen: readonly Rect<Seat>[] = Object.freeze([...seats]);
            expect(itemsBounds(frozen)).toEqual(seatBounds);
        });

        it("accepts an ItemCollection and its read-only items view", () => {
            const collection = new ItemCollection(seats, { keyOf: (seat) => seat.data!.id });
            const view: ReadonlyItemCollection<Rect<Seat>> = collection;

            expect(itemsBounds(collection)).toEqual(seatBounds);
            expect(itemsBounds(view)).toEqual(seatBounds);
            expect(itemsBounds(collection.items)).toEqual(seatBounds);
        });

        it("reads a collection's live contents at call time", () => {
            const collection = new ItemCollection(seats, { keyOf: (seat) => seat.data!.id });

            collection.insert({ x: 10, y: 10, size: 2, data: { id: "c" } });
            expect(itemsBounds(collection)).toEqual({ minX: -0.5, maxX: 11, minY: -0.5, maxY: 11 });

            collection.batch(() => {
                for (const seat of [...collection.items]) {
                    collection.remove(seat.data!.id);
                }
            });
            expect(itemsBounds(collection)).toBeNull();
        });

        it("accepts a mixed-kind collection", () => {
            const mixed = new ItemCollection<Rect | Line>(
                [
                    { x: 0, y: 0, size: 2 },
                    { from: { x: 4, y: -3 }, to: { x: 6, y: 1 } },
                ],
                { keyOf: (item) => ("from" in item ? "line" : "rect") },
            );
            expect(itemsBounds(mixed)).toEqual({ minX: -1, maxX: 6, minY: -3, maxY: 1 });
        });

        it("types every draw-call list source as valid input, but not arbitrary iterables", () => {
            type Input = Parameters<typeof itemsBounds>[0];
            expectTypeOf<readonly Rect<Seat>[]>().toMatchTypeOf<Input>();
            expectTypeOf<ItemCollection<Rect<Seat>>>().toMatchTypeOf<Input>();
            expectTypeOf<ReadonlyItemCollection<Circle | Line | PathItem>>().toMatchTypeOf<Input>();
            // Like the draw calls, a Set or other iterable is not an item source.
            expectTypeOf<Set<Rect<Seat>>>().not.toMatchTypeOf<Input>();
        });
    });
});

describe("pathItemBounds", () => {
    it("prefers commands over points when both are present", () => {
        expect(
            pathItemBounds({
                commands: [
                    { type: "moveTo", x: 0, y: 0 },
                    { type: "lineTo", x: 1, y: 1 },
                ],
                points: [
                    { x: 100, y: 100 },
                    { x: 200, y: 200 },
                ],
            }),
        ).toEqual({ minX: 0, maxX: 1, minY: 0, maxY: 1 });
    });

    it("returns null for geometry that cannot be drawn", () => {
        expect(pathItemBounds({ points: [] })).toBeNull();
        expect(pathItemBounds({ points: [{ x: 1, y: 1 }] })).toBeNull();
        expect(pathItemBounds({})).toBeNull();
        expect(pathItemBounds({ commands: [] })).toBeNull();
    });

    it("boxes an arc by its full center-plus-radius extent", () => {
        expect(
            pathItemBounds({
                commands: [{ type: "arc", x: 5, y: 5, radius: 3, startAngle: 0, endAngle: 90 }],
            }),
        ).toEqual({ minX: 2, maxX: 8, minY: 2, maxY: 8 });
    });
});
