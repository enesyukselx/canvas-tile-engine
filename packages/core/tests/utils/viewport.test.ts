import { describe, expect, it } from "vitest";
import { DEFAULT_VALUES } from "../../src/constants";
import { computePan, computeZoom, screenToWorld, snapCenterToGrid, worldToScreen } from "../../src/utils/viewport";

describe("snapCenterToGrid", () => {
    it("snaps to the nearest half-integer for even tile counts", () => {
        expect(snapCenterToGrid(9.2, 20)).toBe(9.5);
        expect(snapCenterToGrid(9.8, 20)).toBe(9.5);
        expect(snapCenterToGrid(10.4, 20)).toBe(10.5);
    });

    it("snaps integer ties down for even tile counts", () => {
        // N/2 for a 0-based even board lands on the true center (N-1)/2.
        expect(snapCenterToGrid(10, 20)).toBe(9.5);
        expect(snapCenterToGrid(0, 20)).toBe(-0.5);
    });

    it("keeps aligned half-integer values for even tile counts", () => {
        expect(snapCenterToGrid(9.5, 20)).toBe(9.5);
        expect(snapCenterToGrid(-0.5, 20)).toBe(-0.5);
    });

    it("snaps to the nearest integer for odd tile counts", () => {
        expect(snapCenterToGrid(9.4, 19)).toBe(9);
        expect(snapCenterToGrid(9.6, 19)).toBe(10);
        expect(snapCenterToGrid(9, 19)).toBe(9);
    });

    it("snaps half-integer ties down for odd tile counts", () => {
        expect(snapCenterToGrid(9.5, 19)).toBe(9);
    });

    it("returns the value unchanged for non-integer tile counts", () => {
        expect(snapCenterToGrid(10.3, 42.857)).toBe(10.3);
    });
});

describe("computePan", () => {
    it("pans inverse to mouse movement scaled by zoom", () => {
        const topLeft = { x: 0, y: 0 };
        const result = computePan(topLeft, 2, 10, -4);
        expect(result).toEqual({ x: -5, y: 2 });
    });
});

describe("computeZoom", () => {
    it("clamps wheel delta before computing scale", () => {
        const maxScale = 3;
        const minScale = 1;
        const oldScale = 2;
        const result = computeZoom({ x: 0, y: 0 }, oldScale, 1000, minScale, maxScale, { x: 0, y: 0 });
        const expectedScale = oldScale * Math.exp(-DEFAULT_VALUES.MAX_WHEEL_DELTA * DEFAULT_VALUES.ZOOM_SENSITIVITY);
        expect(result.scale).toBeCloseTo(expectedScale);
    });

    it("returns unchanged when hitting scale clamp", () => {
        const topLeft = { x: 5, y: 7 };
        const result = computeZoom(topLeft, 2, -50, 0.5, 2, { x: 100, y: 50 });
        expect(result).toEqual({ topLeft, scale: 2 });
    });

    it("shifts top-left relative to mouse focus when zooming", () => {
        const topLeft = { x: 0, y: 0 };
        const oldScale = 1;
        const minScale = 0.5;
        const maxScale = 2;
        const mouse = { x: 100, y: 50 };
        const result = computeZoom(topLeft, oldScale, -100, minScale, maxScale, mouse);
        const newScale = oldScale * Math.exp(-DEFAULT_VALUES.MIN_WHEEL_DELTA * DEFAULT_VALUES.ZOOM_SENSITIVITY);
        const expectedTopLeft = {
            x: topLeft.x + mouse.x * (1 / oldScale - 1 / newScale),
            y: topLeft.y + mouse.y * (1 / oldScale - 1 / newScale),
        };
        expect(result.scale).toBeCloseTo(newScale);
        expect(result.topLeft.x).toBeCloseTo(expectedTopLeft.x);
        expect(result.topLeft.y).toBeCloseTo(expectedTopLeft.y);
    });
});

describe("coordinate conversions", () => {
    it("converts world to screen with cell center offset", () => {
        const cam = { x: 1, y: 1, scale: 2 };
        const screen = worldToScreen({ x: 1, y: 2 }, cam);
        expect(screen).toEqual({ x: 1, y: 3 });
    });

    it("converts screen back to world coordinates", () => {
        const cam = { x: -5, y: 10, scale: 4 };
        const world = screenToWorld({ x: 8, y: -4 }, cam);
        expect(world).toEqual({ x: -3, y: 9 });
    });
});
