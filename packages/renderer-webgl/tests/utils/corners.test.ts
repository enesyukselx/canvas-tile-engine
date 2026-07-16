import { describe, expect, it } from "vitest";
import { roundedPolyline } from "../../src/utils/corners";

describe("roundedPolyline", () => {
    // Right angle: (0,0) → (10,0) → (10,10) with r=2.
    // Tangent points (8,0) and (10,2); arc center (8,2).
    const rightAngle = [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
    ];

    it("replaces the interior vertex with tangent points and arc samples", () => {
        const out = roundedPolyline(rightAngle, 2);

        expect(out[0]).toEqual({ x: 0, y: 0 });
        expect(out[out.length - 1]).toEqual({ x: 10, y: 10 });
        // The sharp vertex itself is gone
        expect(out.some((p) => p.x === 10 && p.y === 0)).toBe(false);

        const t1 = out[1];
        const t2 = out[out.length - 2];
        expect(t1.x).toBeCloseTo(8);
        expect(t1.y).toBeCloseTo(0);
        expect(t2.x).toBeCloseTo(10);
        expect(t2.y).toBeCloseTo(2);

        // Every point between the tangents sits on the arc
        for (const p of out.slice(1, -1)) {
            expect(Math.hypot(p.x - 8, p.y - 2)).toBeCloseTo(2);
        }
    });

    it("samples the arc on the outside of the corner", () => {
        const out = roundedPolyline(rightAngle, 2);
        // Midpoint of a quarter arc from (8,0) to (10,2) around (8,2) bulges
        // toward the corner vertex (10,0), not into the shape.
        const mid = out[Math.floor(out.length / 2)];
        expect(mid.x).toBeGreaterThan(8);
        expect(mid.y).toBeLessThan(2);
    });

    it("returns the input unchanged for zero radius or too few points", () => {
        expect(roundedPolyline(rightAngle, 0)).toBe(rightAngle);
        const segment = [
            { x: 0, y: 0 },
            { x: 10, y: 0 },
        ];
        expect(roundedPolyline(segment, 5)).toBe(segment);
    });

    it("keeps collinear interior vertices as straight joins", () => {
        const straight = [
            { x: 0, y: 0 },
            { x: 5, y: 0 },
            { x: 10, y: 0 },
        ];
        expect(roundedPolyline(straight, 2)).toEqual(straight);
    });
});
