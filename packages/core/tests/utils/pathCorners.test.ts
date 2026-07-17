import { describe, expect, it } from "vitest";
import { cornerArc } from "../../src/utils/pathCorners";
import { resolveCornerRadiusPx } from "../../src/utils/strokeStyle";

describe("resolveCornerRadiusPx", () => {
    it("scales world cornerRadius by the current scale", () => {
        expect(resolveCornerRadiusPx({ cornerRadius: 0.2 }, 50)).toBe(10);
    });

    it("returns cornerRadiusPx as-is and prefers it over cornerRadius", () => {
        expect(resolveCornerRadiusPx({ cornerRadiusPx: 8 }, 50)).toBe(8);
        expect(resolveCornerRadiusPx({ cornerRadius: 0.2, cornerRadiusPx: 8 }, 50)).toBe(8);
    });

    it("returns 0 (disabled) when absent or negative", () => {
        expect(resolveCornerRadiusPx(undefined, 50)).toBe(0);
        expect(resolveCornerRadiusPx({}, 50)).toBe(0);
        expect(resolveCornerRadiusPx({ cornerRadiusPx: -3 }, 50)).toBe(0);
    });
});

describe("cornerArc", () => {
    // Right-angle corner: (0,0) → (10,0) → (10,10), radius 2.
    // θ = 90°, tangent offset = r / tan(45°) = 2.
    it("computes tangent points and center for a right angle", () => {
        const arc = cornerArc({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, 2)!;

        expect(arc.radius).toBeCloseTo(2);
        expect(arc.t1.x).toBeCloseTo(8);
        expect(arc.t1.y).toBeCloseTo(0);
        expect(arc.t2.x).toBeCloseTo(10);
        expect(arc.t2.y).toBeCloseTo(2);
        expect(arc.center.x).toBeCloseTo(8);
        expect(arc.center.y).toBeCloseTo(2);
        // Quarter-circle sweep
        expect(Math.abs(arc.sweep)).toBeCloseTo(Math.PI / 2);
    });

    it("clamps the radius so tangent points stay within half a segment", () => {
        // Segments of length 10 → tangent offset cap 5 → radius cap 5·tan(45°) = 5.
        const arc = cornerArc({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, 100)!;

        expect(arc.radius).toBeCloseTo(5);
        expect(arc.t1.x).toBeCloseTo(5);
        expect(arc.t2.y).toBeCloseTo(5);
    });

    it("keeps every arc point at radius distance from the center", () => {
        // Non-axis-aligned corner as a sanity check on the math.
        const arc = cornerArc({ x: 1, y: 2 }, { x: 7, y: 5 }, { x: 4, y: 11 }, 1.5)!;

        for (const p of [arc.t1, arc.t2]) {
            expect(Math.hypot(p.x - arc.center.x, p.y - arc.center.y)).toBeCloseTo(arc.radius);
        }
    });

    it("mirrors the sweep sign for opposite turn directions", () => {
        const right = cornerArc({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, 2)!;
        const left = cornerArc({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: -10 }, 2)!;

        expect(Math.sign(right.sweep)).toBe(-Math.sign(left.sweep));
    });

    it("returns null for degenerate corners", () => {
        // Collinear continuation — no corner to round
        expect(cornerArc({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }, 2)).toBeNull();
        // Fold-back onto the incoming segment
        expect(cornerArc({ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 0 }, 2)).toBeNull();
        // Zero-length segment
        expect(cornerArc({ x: 5, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 5 }, 2)).toBeNull();
        // Zero radius
        expect(cornerArc({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, 0)).toBeNull();
    });
});
