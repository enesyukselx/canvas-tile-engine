import { describe, expect, it } from "vitest";
import { flattenPathCommands, pathCommandsBounds } from "../../src/utils/flattenPath";
import type { PathCommand } from "../../src/types";

describe("flattenPathCommands", () => {
    it("expands moveTo/lineTo chains into one open subpath", () => {
        const subs = flattenPathCommands(
            [
                { type: "moveTo", x: 0, y: 0 },
                { type: "lineTo", x: 4, y: 0 },
                { type: "lineTo", x: 4, y: 4 },
            ],
            1,
        );
        expect(subs).toHaveLength(1);
        expect(subs[0].closed).toBe(false);
        expect(subs[0].points).toEqual([
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
        ]);
    });

    it("starts a new subpath per moveTo and closes on closePath", () => {
        const subs = flattenPathCommands(
            [
                { type: "moveTo", x: 0, y: 0 },
                { type: "lineTo", x: 2, y: 0 },
                { type: "lineTo", x: 2, y: 2 },
                { type: "closePath" },
                { type: "moveTo", x: 5, y: 5 },
                { type: "lineTo", x: 6, y: 5 },
            ],
            1,
        );
        expect(subs).toHaveLength(2);
        expect(subs[0].closed).toBe(true);
        expect(subs[1].closed).toBe(false);
    });

    it("flattens a full-circle arc within tolerance, degrees in", () => {
        const subs = flattenPathCommands([{ type: "arc", x: 0, y: 0, radius: 2, startAngle: 0, endAngle: 360 }], 0.1);
        const pts = subs[0].points;
        expect(pts.length).toBeGreaterThan(60);
        for (const p of pts) {
            expect(Math.hypot(p.x, p.y)).toBeCloseTo(2, 1);
        }
        // Full sweep returns to the start
        expect(pts[pts.length - 1].x).toBeCloseTo(pts[0].x, 5);
    });

    it("respects ccw arc direction", () => {
        const cw = flattenPathCommands([{ type: "arc", x: 0, y: 0, radius: 1, startAngle: 0, endAngle: 90 }], 0.05);
        const ccw = flattenPathCommands(
            [{ type: "arc", x: 0, y: 0, radius: 1, startAngle: 0, endAngle: 90, ccw: true }],
            0.05,
        );
        // Clockwise (screen space, y-down): short way through +y; ccw: long way through -y
        expect(cw[0].points.length).toBeLessThan(ccw[0].points.length);
        expect(cw[0].points.some((p) => p.y < -0.5)).toBe(false);
        expect(ccw[0].points.some((p) => p.y < -0.5)).toBe(true);
    });

    it("draws a connecting line from the current point to an arc start", () => {
        const subs = flattenPathCommands(
            [
                { type: "moveTo", x: -5, y: 0 },
                { type: "arc", x: 0, y: 0, radius: 1, startAngle: 0, endAngle: 90 },
            ],
            0.1,
        );
        expect(subs).toHaveLength(1);
        expect(subs[0].points[0]).toEqual({ x: -5, y: 0 });
        expect(subs[0].points[1].x).toBeCloseTo(1);
    });

    it("hits bezier endpoints exactly and stays inside the control hull", () => {
        const subs = flattenPathCommands(
            [
                { type: "moveTo", x: 0, y: 0 },
                { type: "bezierCurveTo", cp1x: 0, cp1y: 2, cp2x: 4, cp2y: 2, x: 4, y: 0 },
            ],
            0.05,
        );
        const pts = subs[0].points;
        expect(pts[0]).toEqual({ x: 0, y: 0 });
        expect(pts[pts.length - 1].x).toBeCloseTo(4);
        expect(pts[pts.length - 1].y).toBeCloseTo(0);
        for (const p of pts) {
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(2);
        }
        // The quadratic-ish midpoint should bow towards the control points
        const mid = pts[Math.floor(pts.length / 2)];
        expect(mid.y).toBeGreaterThan(1);
    });

    it("drops degenerate single-point subpaths (a bare lineTo draws nothing)", () => {
        expect(flattenPathCommands([{ type: "lineTo", x: 3, y: 3 }], 1)).toHaveLength(0);
        expect(flattenPathCommands([{ type: "moveTo", x: 3, y: 3 }], 1)).toHaveLength(0);
    });
});

describe("pathCommandsBounds", () => {
    it("covers endpoints, control points, and full arc boxes", () => {
        const commands: PathCommand[] = [
            { type: "moveTo", x: 0, y: 0 },
            { type: "quadraticCurveTo", cpx: 10, cpy: -5, x: 4, y: 0 },
            { type: "arc", x: 0, y: 8, radius: 3, startAngle: 0, endAngle: 90 },
        ];
        expect(pathCommandsBounds(commands)).toEqual({ minX: -3, minY: -5, maxX: 10, maxY: 11 });
    });

    it("returns null for an empty list", () => {
        expect(pathCommandsBounds([])).toBeNull();
    });
});
