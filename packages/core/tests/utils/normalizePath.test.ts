import { describe, expect, it } from "vitest";
import { normalizePathItems } from "../../src/utils/normalizePath";
import type { PathItem } from "../../src/types";

const points = [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
];

describe("normalizePathItems", () => {
    it("passes single items and item arrays through untouched", () => {
        const item: PathItem = { points, closed: true, style: { fillStyle: "red" } };
        expect(normalizePathItems(item)).toEqual([item]);
        expect(normalizePathItems([item])[0]).toBe(item);
    });

    it("wraps a legacy single polyline with the call-level style", () => {
        const result = normalizePathItems(points, { strokeStyle: "blue", lineWidthPx: 2 });
        expect(result).toEqual([{ points, style: { strokeStyle: "blue", lineWidthPx: 2 } }]);
    });

    it("wraps each polyline of the legacy multi form", () => {
        const other = [
            { x: 2, y: 2 },
            { x: 3, y: 3 },
        ];
        const result = normalizePathItems([points, other], { strokeStyle: "blue" });
        expect(result).toHaveLength(2);
        expect(result[1]).toEqual({ points: other, style: { strokeStyle: "blue" } });
    });

    it("returns an empty list for an empty array", () => {
        expect(normalizePathItems([])).toEqual([]);
    });
});
