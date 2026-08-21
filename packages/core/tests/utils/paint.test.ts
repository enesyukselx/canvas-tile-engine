import { describe, expect, it } from "vitest";
import type { LinearGradient } from "../../src/types";
import { gradientAxisPx, gradientT, isGradient, normalizeStops, paintKey } from "../../src/utils/paint";

const identity = (x: number, y: number) => ({ x, y });

const vertical: LinearGradient = {
    type: "linear",
    from: { x: 0, y: 0 },
    to: { x: 0, y: 1 },
    stops: [
        { offset: 0, color: "#000" },
        { offset: 1, color: "#fff" },
    ],
};

describe("isGradient", () => {
    it("separates gradients from color strings", () => {
        expect(isGradient(vertical)).toBe(true);
        expect(isGradient("#ff0000")).toBe(false);
        expect(isGradient(undefined)).toBe(false);
    });
});

describe("normalizeStops", () => {
    it("sorts ascending and clamps offsets into range", () => {
        // Canvas2D throws on an out-of-range offset and Skia wants ascending
        // positions, so neither property is optional
        expect(
            normalizeStops([
                { offset: 1.4, color: "c" },
                { offset: -0.2, color: "a" },
                { offset: 0.5, color: "b" },
            ]),
        ).toEqual([
            { offset: 0, color: "a" },
            { offset: 0.5, color: "b" },
            { offset: 1, color: "c" },
        ]);
    });

    it("keeps stops that share an offset in authored order", () => {
        // Two stops at the same offset are how a hard color break is written
        expect(
            normalizeStops([
                { offset: 0.5, color: "left" },
                { offset: 0.5, color: "right" },
            ]),
        ).toEqual([
            { offset: 0.5, color: "left" },
            { offset: 0.5, color: "right" },
        ]);
    });
});

describe("gradientAxisPx", () => {
    const box = { x: 100, y: 200, width: 40, height: 20 };

    it("reads box units as fractions of the drawn box", () => {
        expect(gradientAxisPx(vertical, box, identity)).toEqual({ x0: 100, y0: 200, x1: 100, y1: 220 });
    });

    it("is size- and position-independent in box units", () => {
        // The same object describes "top to bottom" for any item
        const other = { x: 0, y: 0, width: 4, height: 400 };
        expect(gradientAxisPx(vertical, other, identity)).toEqual({ x0: 0, y0: 0, x1: 0, y1: 400 });
    });

    it("handles a diagonal axis", () => {
        const diagonal: LinearGradient = { ...vertical, from: { x: 0, y: 0 }, to: { x: 1, y: 1 } };
        expect(gradientAxisPx(diagonal, box, identity)).toEqual({ x0: 100, y0: 200, x1: 140, y1: 220 });
    });

    it("projects world units through the camera instead of the box", () => {
        const world: LinearGradient = { ...vertical, units: "world", from: { x: 2, y: 3 }, to: { x: 4, y: 3 } };
        const toScreen = (x: number, y: number) => ({ x: x * 10, y: y * 10 });

        expect(gradientAxisPx(world, box, toScreen)).toEqual({ x0: 20, y0: 30, x1: 40, y1: 30 });
    });
});

describe("gradientT", () => {
    const axis = { x0: 0, y0: 0, x1: 100, y1: 0 };

    it("projects a point onto the axis", () => {
        expect(gradientT(axis, 0, 0)).toBe(0);
        expect(gradientT(axis, 50, 0)).toBe(0.5);
        expect(gradientT(axis, 100, 0)).toBe(1);
    });

    it("ignores the perpendicular component", () => {
        expect(gradientT(axis, 25, 999)).toBe(0.25);
    });

    it("extends past the ends, leaving clamping to the backend", () => {
        expect(gradientT(axis, -50, 0)).toBe(-0.5);
        expect(gradientT(axis, 150, 0)).toBe(1.5);
    });

    it("returns 0 for a zero-length axis, matching Canvas2D and Skia", () => {
        expect(gradientT({ x0: 5, y0: 5, x1: 5, y1: 5 }, 99, 99)).toBe(0);
    });

    it("is affine along a diagonal axis", () => {
        // Per-vertex interpolation of t is only exact because it is affine
        const diagonal = { x0: 0, y0: 0, x1: 10, y1: 10 };
        expect(gradientT(diagonal, 5, 5)).toBe(0.5);
        expect(gradientT(diagonal, 2, 2) + gradientT(diagonal, 8, 8)).toBeCloseTo(1, 10);
    });
});

describe("paintKey", () => {
    it("returns the color string unchanged for a solid fill", () => {
        expect(paintKey("#ff0000")).toBe("#ff0000");
    });

    it("gives structurally identical gradients the same key", () => {
        // Inline specs from a styleOf callback are new objects every frame;
        // the cache has to see through that
        expect(paintKey({ ...vertical })).toBe(paintKey(vertical));
    });

    it("separates gradients that differ in any field", () => {
        const key = paintKey(vertical);
        expect(paintKey({ ...vertical, units: "world" })).not.toBe(key);
        expect(paintKey({ ...vertical, to: { x: 1, y: 0 } })).not.toBe(key);
        expect(paintKey({ ...vertical, stops: [{ offset: 0, color: "#000" }] })).not.toBe(key);
    });

    it("treats the default units as box", () => {
        expect(paintKey({ ...vertical, units: "box" })).toBe(paintKey(vertical));
    });
});
