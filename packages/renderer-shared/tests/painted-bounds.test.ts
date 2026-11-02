import { describe, expect, it, vi } from "vitest";
import { ItemCollection } from "@canvas-tile-engine/core";
import type { Bounds, Rect } from "@canvas-tile-engine/core";
import {
    boxPaintBounds,
    boxPixelPadding,
    intersectsBounds,
    linePaintBounds,
    PaintedCuller,
    pathPaintBounds,
    textPaintBounds,
    UNBOUNDED,
} from "../src/geometry/paintedBounds";

const viewport: Bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1 };

const dimensions: Array<Partial<Rect>> = [
    { width: 4, height: 2 },
    { size: 3 },
    { sizePx: 80 },
    { width: 4, heightPx: 70 },
    { widthPx: 60, height: 2 },
    { size: 8, sizePx: 40, width: 9, widthPx: 15 },
    { widthPx: 120, heightPx: 7 },
    { size: 3, heightPx: 130 },
    { width: 0.02, height: 0.05 },
];
const origins: Array<Rect["origin"]> = [
    undefined,
    { mode: "cell", x: 0, y: 1 },
    { mode: "cell", x: 1, y: 0 },
    { mode: "self", x: 0, y: 1 },
    { mode: "self", x: 1, y: 0 },
    { mode: "self", x: 0.25, y: 0.75 },
    { mode: "self", x: 0.5, y: 0.5 },
];
const rotations = [-135, -45, 0, 17, 45, 90, 180, 360];
const strokes: Array<Rect["style"]> = [
    undefined,
    { fillStyle: "red" },
    { strokeStyle: "red" },
    { strokeStyle: "red", lineWidth: 0.2 },
    { strokeStyle: "red", lineWidth: 20 },
    { strokeStyle: "red", lineWidthPx: 0.05 },
    { strokeStyle: "red", lineWidthPx: 17 },
    { strokeStyle: "red", lineWidth: 10, lineWidthPx: 3 },
];
const scales = [0.01, 0.1, 1, 10, 100];

function expectBounds(actual: Bounds, expected: Bounds) {
    for (const key of ["minX", "minY", "maxX", "maxY"] as const) {
        expect(actual[key], key).toBeCloseTo(expected[key], 10);
    }
}

describe("painted geometry", () => {
    it("counts touching bounds as visible", () => {
        expect(intersectsBounds(viewport, { minX: 1, minY: 1, maxX: 2, maxY: 2 })).toBe(true);
        expect(intersectsBounds(viewport, { minX: 1.01, minY: 1, maxX: 2, maxY: 2 })).toBe(false);
        expect(intersectsBounds(viewport, UNBOUNDED)).toBe(true);
    });

    it("includes the half-cell offset and both origin modes", () => {
        const item: Rect = { x: 10, y: 20, width: 4, height: 2 };
        expect(boxPaintBounds(item, 10)).toEqual({ minX: 8.5, minY: 19.5, maxX: 12.5, maxY: 21.5 });
        expect(boxPaintBounds({ ...item, origin: { mode: "self", x: 0, y: 1 } }, 10)).toEqual({
            minX: 10.5,
            minY: 18.5,
            maxX: 14.5,
            maxY: 20.5,
        });
        expect(boxPaintBounds({ ...item, origin: { mode: "cell", x: 0, y: 1 } }, 10)).toEqual({
            minX: 8,
            minY: 20,
            maxX: 12,
            maxY: 22,
        });
    });

    it("rotates the stroked box so mitered rect corners stay inside its bounds", () => {
        expectBounds(
            boxPaintBounds({ x: 10, y: 20, width: 4, height: 2, rotate: 90 }, 10, {
                strokeStyle: "red",
                lineWidth: 1,
            }),
            { minX: 9, minY: 18, maxX: 12, maxY: 23 },
        );
        const diagonal = boxPaintBounds({ x: 0, y: 0, size: 2, rotate: 45 }, 10, {
            strokeStyle: "red",
            lineWidthPx: 20,
        });
        expectBounds(diagonal, {
            minX: 0.5 - 2 * Math.SQRT2,
            minY: 0.5 - 2 * Math.SQRT2,
            maxX: 0.5 + 2 * Math.SQRT2,
            maxY: 0.5 + 2 * Math.SQRT2,
        });
    });

    it("resolves pixel dimensions at the current zoom and ignores disabled rotation", () => {
        const item: Rect = { x: 10, y: 20, size: 100, widthPx: 40, heightPx: 20, rotate: 90 };
        expect(boxPaintBounds(item, 10, undefined, false)).toEqual({ minX: 8.5, minY: 19.5, maxX: 12.5, maxY: 21.5 });
        expect(boxPaintBounds(item, 5, undefined, false)).toEqual({ minX: 6.5, minY: 18.5, maxX: 14.5, maxY: 22.5 });
    });

    it("includes the painted one-pixel footprint of subpixel strokes", () => {
        expectBounds(boxPaintBounds({ x: 0, y: 0, size: 1 }, 10, { strokeStyle: "red", lineWidthPx: 0.1 }), {
            minX: -0.05,
            minY: -0.05,
            maxX: 1.05,
            maxY: 1.05,
        });
    });

    it("uses the per-item line width over the call style, including world-versus-pixel overrides", () => {
        const line = { from: { x: -5, y: 2 }, to: { x: -5, y: 7 }, style: { lineWidth: 10 } };
        expect(linePaintBounds(line, 10, { lineWidthPx: 1 })).toEqual({
            minX: -9.5,
            minY: -2.5,
            maxX: 0.5,
            maxY: 12.5,
        });
        expect(linePaintBounds({ ...line, style: { lineWidthPx: 20 } }, 10, { lineWidth: 10 })).toEqual({
            minX: -5.5,
            minY: 1.5,
            maxX: -3.5,
            maxY: 8.5,
        });
    });

    it("pads paths for the default miter limit, rather than only their centerlines", () => {
        expect(pathPaintBounds(viewport, { lineWidthPx: 6 }, 10)).toEqual({
            minX: -2.5,
            minY: -2.5,
            maxX: 4.5,
            maxY: 4.5,
        });
    });

    it("transforms asymmetric text bearings around the anchor, including rotation", () => {
        const local = { minX: -30, minY: -10, maxX: 5, maxY: 20 };
        expectBounds(textPaintBounds({ x: 2, y: 3, text: "label" }, 10, local), {
            minX: -0.5,
            minY: 2.5,
            maxX: 3,
            maxY: 5.5,
        });
        expectBounds(textPaintBounds({ x: 2, y: 3, text: "label", rotate: 90 }, 10, local), {
            minX: 0.5,
            minY: 0.5,
            maxX: 3.5,
            maxY: 4,
        });
    });

    it("preserves unbounded text metrics instead of producing NaNs during rotation", () => {
        expect(textPaintBounds({ x: 200, y: 300, text: "unknown", rotate: 45 }, 10, UNBOUNDED)).toBe(UNBOUNDED);
    });

    it.each(scales)("world-only bounds plus pixel padding contain every mixed-size box at scale %s", (scale) => {
        const failures: unknown[] = [];
        let checked = 0;
        for (const size of dimensions) {
            for (const origin of origins) {
                for (const rotation of rotations) {
                    for (const style of strokes) {
                        for (const rotate of [false, true]) {
                            const item: Rect = { x: -7.3, y: 2.1, ...size, origin, rotate: rotation };
                            const world = boxPaintBounds(item, Infinity, style, rotate);
                            const padding = boxPixelPadding(item, style) / scale;
                            const actual = boxPaintBounds(item, scale, style, rotate);
                            const tolerance = 1e-8;
                            const contained =
                                actual.minX >= world.minX - padding - tolerance &&
                                actual.minY >= world.minY - padding - tolerance &&
                                actual.maxX <= world.maxX + padding + tolerance &&
                                actual.maxY <= world.maxY + padding + tolerance;
                            if (!contained) {
                                failures.push({ item, style, rotate, scale, actual, world, padding });
                            }
                            checked++;
                        }
                    }
                }
            }
        }
        expect(checked).toBe(8064);
        expect(
            failures.slice(0, 5),
            `${failures.length} of ${checked} painted bounds escaped their pixel padding`,
        ).toEqual([]);
    });
});

describe("PaintedCuller", () => {
    it.each([0, 1, 500])("leaves %i items for precise linear culling without building an index", (count) => {
        const items = Array.from({ length: count }, (_, id) => ({ id }));
        const boundsOf = vi.fn(() => viewport);
        const culler = new PaintedCuller(items, boundsOf);
        expect(culler.query(viewport, 10)).toBe(items);
        expect(boundsOf).not.toHaveBeenCalled();
    });

    it("indexes 501 items, retaining original objects and caching same-scale painted bounds", () => {
        const items = Array.from({ length: 501 }, (_, id) => ({ id }));
        const boundsOf = vi.fn((item: { id: number }) => ({
            minX: item.id * 10,
            minY: 0,
            maxX: item.id * 10 + 1,
            maxY: 1,
        }));
        const culler = new PaintedCuller(items, boundsOf);
        expect(culler.query(viewport, 10)).toEqual([items[0]]);
        expect(boundsOf).toHaveBeenCalledTimes(501);
        expect(culler.query({ minX: 10, minY: 0, maxX: 11, maxY: 1 }, 10)).toEqual([items[1]]);
        expect(boundsOf).toHaveBeenCalledTimes(501);
    });

    it("rebuilds on zoom so pixel-sized bounds shrink and grow correctly", () => {
        const items: Rect[] = [
            { x: 2, y: 0, sizePx: 40 },
            ...Array.from({ length: 500 }, (_, n) => ({ x: 10000 + n, y: 0 })),
        ];
        const boundsOf = vi.fn((item: Rect, scale: number) => boxPaintBounds(item, scale));
        const culler = new PaintedCuller(items, boundsOf);
        expect(culler.query(viewport, 10)).toEqual([items[0]]);
        expect(culler.query(viewport, 20)).toEqual([]);
        expect(boundsOf).toHaveBeenCalledTimes(1002);
        expect(culler.query(viewport, 20)).toEqual([]);
        expect(boundsOf).toHaveBeenCalledTimes(1002);
        expect(culler.query(viewport, 10)).toEqual([items[0]]);
        expect(boundsOf).toHaveBeenCalledTimes(1503);
    });

    it("leaves live style bounds to the draw loop on every frame", () => {
        const items = Array.from({ length: 501 }, (_, id) => ({ id }));
        const boundsOf = vi.fn(() => viewport);
        const culler = new PaintedCuller(items, boundsOf, true);
        expect(culler.query(viewport, 10)).toBe(items);
        expect(culler.query(viewport, 20)).toBe(items);
        expect(boundsOf).not.toHaveBeenCalled();
    });

    it("falls back to a scan when any item has unknown painted bounds", () => {
        const items = Array.from({ length: 501 }, (_, id) => ({ id }));
        const boundsOf = vi.fn((item: { id: number }) =>
            item.id === 500 ? UNBOUNDED : { minX: 100, minY: 100, maxX: 101, maxY: 101 },
        );
        const culler = new PaintedCuller(items, boundsOf);
        expect(culler.query(viewport, 10)).toBe(items);
        expect(culler.query(viewport, 10)).toBe(items);
        expect(boundsOf).toHaveBeenCalledTimes(501);
    });

    it("retains a world-only shape index across zoom and never loses a directly intersecting painted box", () => {
        const items: Rect[] = Array.from({ length: 501 }, (_, n) => ({
            x: ((n * 17) % 101) - 50,
            y: ((n * 29) % 103) - 51,
            ...dimensions[n % dimensions.length],
            origin: origins[n % origins.length],
            rotate: rotations[n % rotations.length],
            style: strokes[n % strokes.length],
        }));
        const boundsOf = vi.fn((item: Rect, scale: number) => boxPaintBounds(item, scale, item.style));
        const padding = Math.max(...items.map((item) => boxPixelPadding(item, item.style)));
        const culler = new PaintedCuller(items, boundsOf, false, padding);
        for (const scale of scales) {
            const view = { minX: -2, minY: -5, maxX: -2 + 100 / scale, maxY: -5 + 100 / scale };
            const candidates = culler.query(view, scale);
            const precise = (item: Rect) => intersectsBounds(view, boxPaintBounds(item, scale, item.style));
            expect(new Set(candidates.filter(precise))).toEqual(new Set(items.filter(precise)));
            expect(boundsOf).toHaveBeenCalledTimes(501);
            if (scale === 100) {
                expect(candidates.length).toBeLessThan(items.length);
            }
        }
        expect(boundsOf.mock.calls.every(([, scale]) => scale === Infinity)).toBe(true);
    });
});

describe("PaintedCuller collection updates", () => {
    const makeItems = (count = 600) =>
        Array.from({ length: count }, (_, id) => ({ id, x: 1000 + id * 10, y: 0, size: 1 }));

    it("moves one indexed item without remeasuring the batch or changing paint order", () => {
        const items = makeItems();
        items[0].x = 0;
        const source = new ItemCollection(items, { keyOf: (item) => item.id });
        const boundsOf = vi.fn((item: Rect, scale: number) => boxPaintBounds(item, scale));
        const culler = new PaintedCuller(source.items, boundsOf);
        source.subscribe((changes) => culler.applyChanges(changes));
        expect(culler.query(viewport, 10)).toEqual([items[0]]);
        expect(boundsOf).toHaveBeenCalledTimes(600);

        const previous = source.get(599)!;
        const moved = source.update(599, { x: 0 });
        expect(culler.query(viewport, 10)).toEqual([items[0], moved]);
        expect(culler.query({ minX: previous.x, maxX: previous.x + 1, minY: 0, maxY: 1 }, 10)).toEqual([]);
        expect(boundsOf).toHaveBeenCalledTimes(601);
        expect(culler.query(viewport, 10)).toEqual([items[0], moved]);
        expect(boundsOf).toHaveBeenCalledTimes(601);
    });

    it("applies sequential indices when a batched source already contains its final items", () => {
        const source = new ItemCollection(makeItems(), { keyOf: (item) => item.id });
        const boundsOf = vi.fn((item: Rect, scale: number) => boxPaintBounds(item, scale));
        const culler = new PaintedCuller(source.items, boundsOf);
        source.subscribe((changes) => culler.applyChanges(changes));
        expect(culler.query(viewport, 10)).toEqual([]);

        source.batch(() => {
            source.remove(0);
            source.update(1, { x: 0 });
            source.insert({ id: 700, x: 1000, y: 0, size: 1 });
            source.update(700, { x: 0 });
            source.remove(2);
        });
        expect(culler.query(viewport, 10)).toEqual([source.get(1), source.get(700)]);
        expect(boundsOf).toHaveBeenCalledTimes(603);
    });

    it("expands pixel padding for an updated marker while retaining the world index", () => {
        const items: Rect[] = [
            { x: 20, y: 0, sizePx: 10 },
            ...Array.from({ length: 599 }, (_, i) => ({ x: 1000 + i, y: 1000 })),
        ];
        const boundsOf = vi.fn((item: Rect, scale: number) => boxPaintBounds(item, scale));
        const culler = new PaintedCuller(items, boundsOf, false, (item) => boxPixelPadding(item));
        expect(culler.query(viewport, 10)).toEqual([]);
        const previous = items[0];
        const item = { ...previous, sizePx: 500 };
        items[0] = item;
        culler.applyChanges([{ type: "update", key: 0, index: 0, previous, item }]);
        expect(culler.query(viewport, 10)).toEqual([item]);
        expect(culler.query(viewport, 100)).toEqual([]);
        expect(boundsOf).toHaveBeenCalledTimes(601);
    });

    it("recovers from unknown bounds without moving the recovered item to the front", () => {
        const items = makeItems().map((item) => ({ ...item, unknown: item.id === 0 }));
        items[1].x = 0;
        const source = new ItemCollection(items, { keyOf: (item) => item.id });
        const boundsOf = vi.fn((item: (typeof items)[number], scale: number) =>
            item.unknown ? UNBOUNDED : boxPaintBounds(item, scale),
        );
        const culler = new PaintedCuller(source.items, boundsOf);
        source.subscribe((changes) => culler.applyChanges(changes));
        expect(culler.query(viewport, 10)).toBe(source.items);
        const first = source.update(0, { unknown: false, x: 0 });
        expect(culler.query(viewport, 10)).toEqual([first, items[1]]);
        expect(boundsOf).toHaveBeenCalledTimes(601);

        source.update(0, { unknown: true });
        expect(culler.query(viewport, 10)).toBe(source.items);
        source.remove(0);
        expect(culler.query(viewport, 10)).toEqual([items[1]]);
        expect(boundsOf).toHaveBeenCalledTimes(602);
    });

    it("keeps a warmed tree valid across the linear/indexed threshold", () => {
        const source = new ItemCollection(makeItems(500), { keyOf: (item) => item.id });
        const boundsOf = vi.fn((item: Rect, scale: number) => boxPaintBounds(item, scale));
        const culler = new PaintedCuller(source.items, boundsOf);
        source.subscribe((changes) => culler.applyChanges(changes));
        expect(culler.query(viewport, 10)).toBe(source.items);
        expect(boundsOf).not.toHaveBeenCalled();
        source.insert({ id: 501, x: 0, y: 0, size: 1 });
        expect(culler.query(viewport, 10)).toEqual([source.get(501)]);
        expect(boundsOf).toHaveBeenCalledTimes(501);
        source.remove(501);
        expect(culler.query(viewport, 10)).toBe(source.items);
        source.insert({ id: 502, x: 0, y: 0, size: 1 });
        expect(culler.query(viewport, 10)).toEqual([source.get(502)]);
        expect(boundsOf).toHaveBeenCalledTimes(502);
    });

    it("preserves every occurrence in an ordinary array with repeated object references", () => {
        const item = { x: 0, y: 0, size: 1 };
        const items = [item, item, ...makeItems()];
        const culler = new PaintedCuller(items, (value, scale) => boxPaintBounds(value, scale));
        expect(culler.query(viewport, 10)).toEqual([item, item]);
    });
});
