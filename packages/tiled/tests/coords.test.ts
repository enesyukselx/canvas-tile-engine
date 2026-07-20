import { describe, expect, it } from "vitest";
import { pxToWorld, rotateAround } from "../src/coords";

describe("pxToWorld", () => {
    // The load-bearing convention: integers are cell centers, so pixel 0
    // (left edge of cell 0) is item-space -0.5 and the center of cell 0
    // (pixel tileSize/2) is item-space 0.
    it("maps cell edges to half-integers and centers to integers", () => {
        expect(pxToWorld(0, 16)).toBe(-0.5);
        expect(pxToWorld(8, 16)).toBe(0);
        expect(pxToWorld(16, 16)).toBe(0.5);
        expect(pxToWorld(40, 16)).toBe(2);
    });
});

describe("rotateAround", () => {
    it("rotates clockwise in y-down screen coordinates", () => {
        const p = rotateAround({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
        expect(p.x).toBeCloseTo(0);
        expect(p.y).toBeCloseTo(1); // +x rotates to +y (downward) = clockwise on screen
    });

    it("is a no-op at 0 degrees", () => {
        expect(rotateAround({ x: 3, y: 4 }, { x: 1, y: 1 }, 0)).toEqual({ x: 3, y: 4 });
    });
});
