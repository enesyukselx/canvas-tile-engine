import { describe, expect, it } from "vitest";
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { getViewportBounds, isVisible } from "../src/geometry/culling";

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
