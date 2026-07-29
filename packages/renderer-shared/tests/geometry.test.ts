import { describe, expect, it } from "vitest";
import type { CanvasTileEngineConfig, PathItem } from "@canvas-tile-engine/core";
import { getViewportBounds, isVisible } from "../src/geometry/culling";
import { pathItemBounds } from "../src/geometry/pathBounds";

// 100x100 px at scale 10 = 10x10 world units, plus the 1-unit tile buffer.
const config = { size: { width: 100, height: 100 }, scale: 10 } as Required<CanvasTileEngineConfig>;

describe("getViewportBounds", () => {
    it("covers the viewport in world units plus the tile buffer", () => {
        expect(getViewportBounds({ x: 0, y: 0 }, config)).toEqual({ minX: -1, minY: -1, maxX: 11, maxY: 11 });
    });

    it("follows the camera", () => {
        expect(getViewportBounds({ x: 20, y: -5 }, config)).toEqual({ minX: 19, minY: -6, maxX: 31, maxY: 6 });
    });

    it("grows as the camera zooms out", () => {
        const zoomedOut = { size: { width: 100, height: 100 }, scale: 5 } as Required<CanvasTileEngineConfig>;
        expect(getViewportBounds({ x: 0, y: 0 }, zoomedOut)).toEqual({ minX: -1, minY: -1, maxX: 21, maxY: 21 });
    });
});

describe("isVisible", () => {
    it("accepts an item inside the viewport", () => {
        expect(isVisible(5, 5, 0.5, { x: 0, y: 0 }, config)).toBe(true);
    });

    it("rejects an item beyond the buffer", () => {
        expect(isVisible(20, 5, 0.5, { x: 0, y: 0 }, config)).toBe(false);
    });

    it("accepts an item whose extent pokes into the buffer", () => {
        // Anchor 14 units out is unreachable on its own; a 4-unit half-extent
        // reaches back to 10, inside maxX = 11.
        expect(isVisible(14, 5, 0.5, { x: 0, y: 0 }, config)).toBe(false);
        expect(isVisible(14, 5, 4, { x: 0, y: 0 }, config)).toBe(true);
    });

    it("treats the buffer edge as visible", () => {
        expect(isVisible(11, 5, 0, { x: 0, y: 0 }, config)).toBe(true);
        expect(isVisible(11.5, 5, 0, { x: 0, y: 0 }, config)).toBe(false);
    });

    it("culls on both axes independently", () => {
        expect(isVisible(5, 20, 0.5, { x: 0, y: 0 }, config)).toBe(false);
        expect(isVisible(-5, 5, 0.5, { x: 0, y: 0 }, config)).toBe(false);
    });
});

describe("pathItemBounds", () => {
    it("boxes polyline vertices", () => {
        const item: PathItem = {
            points: [
                { x: 2, y: 5 },
                { x: -3, y: 1 },
                { x: 4, y: -2 },
            ],
        };
        expect(pathItemBounds(item)).toEqual({ minX: -3, maxX: 4, minY: -2, maxY: 5 });
    });

    it("returns null for geometry that cannot be drawn", () => {
        expect(pathItemBounds({ points: [] })).toBeNull();
        expect(pathItemBounds({ points: [{ x: 1, y: 1 }] })).toBeNull();
        expect(pathItemBounds({} as PathItem)).toBeNull();
        expect(pathItemBounds({ commands: [] })).toBeNull();
    });

    it("uses the control-point hull for command paths", () => {
        const item: PathItem = {
            commands: [
                { type: "moveTo", x: 0, y: 0 },
                { type: "quadraticCurveTo", cpx: 5, cpy: 10, x: 10, y: 0 },
            ],
        };
        // The curve never leaves its hull, so the control point sets maxY.
        expect(pathItemBounds(item)).toEqual({ minX: 0, maxX: 10, minY: 0, maxY: 10 });
    });

    it("prefers commands over points when both are present", () => {
        const item: PathItem = {
            commands: [
                { type: "moveTo", x: 0, y: 0 },
                { type: "lineTo", x: 1, y: 1 },
            ],
            points: [
                { x: 100, y: 100 },
                { x: 200, y: 200 },
            ],
        };
        expect(pathItemBounds(item)).toEqual({ minX: 0, maxX: 1, minY: 0, maxY: 1 });
    });
});
