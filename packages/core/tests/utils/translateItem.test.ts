import { describe, expect, it } from "vitest";
import { translateItem } from "../../src/utils/translateItem";
import type { PathItem } from "../../src/types";

describe("immutable item translation", () => {
    it("preserves anchored geometry settings and user data", () => {
        const item = { x: 1, y: 2, width: 3, rotate: 45, data: { id: "a" }, origin: { mode: "self" as const } };
        const moved = translateItem(item, { x: 5, y: -1 });
        expect(moved).toEqual({ ...item, x: 6, y: 1 });
        expect(moved.data).toBe(item.data);
        expect(item.x).toBe(1);
        expect(translateItem({ from: { x: 0, y: 1 }, to: { x: 2, y: 3 } }, { x: 4, y: 5 })).toEqual({
            from: { x: 4, y: 6 },
            to: { x: 6, y: 8 },
        });
    });

    it("moves every path control point and arc center without changing radii or angles", () => {
        const item: PathItem = {
            commands: [
                { type: "moveTo", x: 0, y: 1 },
                { type: "lineTo", x: 2, y: 3 },
                { type: "quadraticCurveTo", cpx: 4, cpy: 5, x: 6, y: 7 },
                { type: "bezierCurveTo", cp1x: 8, cp1y: 9, cp2x: 10, cp2y: 11, x: 12, y: 13 },
                { type: "arc", x: 14, y: 15, radius: 3, startAngle: 20, endAngle: 80 },
                { type: "closePath" },
            ],
            points: [
                { x: 0, y: 1 },
                { x: 2, y: 3 },
            ],
        };
        const before = JSON.stringify(item);
        const moved = translateItem(item, { x: 10, y: -1 });
        expect(moved.commands).toEqual([
            { type: "moveTo", x: 10, y: 0 },
            { type: "lineTo", x: 12, y: 2 },
            { type: "quadraticCurveTo", cpx: 14, cpy: 4, x: 16, y: 6 },
            { type: "bezierCurveTo", cp1x: 18, cp1y: 8, cp2x: 20, cp2y: 10, x: 22, y: 12 },
            { type: "arc", x: 24, y: 14, radius: 3, startAngle: 20, endAngle: 80 },
            { type: "closePath" },
        ]);
        expect(moved.points).toEqual([
            { x: 10, y: 0 },
            { x: 12, y: 2 },
        ]);
        expect(JSON.stringify(item)).toBe(before);
        expect(() => translateItem(item, { x: Infinity, y: 0 })).toThrow(RangeError);
    });
});
