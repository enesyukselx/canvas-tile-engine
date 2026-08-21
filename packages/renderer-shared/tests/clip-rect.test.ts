import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { clipRectPx } from "../src/scene/clip";

describe("clipRectPx", () => {
    it("projects both corners of a world rectangle", () => {
        const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
        const transformer = new CoordinateTransformer(camera);

        // Same space item positions use: integers are cell centers, so
        // worldToScreen(1, 1) is (15, 15) at scale 10
        expect(clipRectPx({ minX: 1, maxX: 3, minY: 1, maxY: 2 }, (x, y) => transformer.worldToScreen(x, y))).toEqual({
            x: 15,
            y: 15,
            width: 20,
            height: 10,
        });
    });

    it("follows the camera, so the clip pans with the scene", () => {
        const camera = { x: 2, y: 0, scale: 10 } as unknown as ICamera;
        const transformer = new CoordinateTransformer(camera);

        const rect = clipRectPx({ minX: 1, maxX: 3, minY: 1, maxY: 2 }, (x, y) => transformer.worldToScreen(x, y));

        expect(rect.x).toBe(-5);
        expect(rect.width).toBe(20);
    });
});
