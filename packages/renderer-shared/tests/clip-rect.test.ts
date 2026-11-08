import { describe, expect, it } from "vitest";
import { type Bounds, CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { canvas2dClipAdapter } from "../src/canvas2d/clip";
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

    // A direct IDrawAPI caller bypasses the engine's normalisation, so the
    // projection sorts too: a negative extent is a 0x0 scissor on WebGL but a
    // normalised path on Canvas2D and Skia, and every adapter must cut alike.
    it.each([
        ["both axes", { minX: 3, maxX: 1, minY: 2, maxY: 1 }],
        ["x only", { minX: 3, maxX: 1, minY: 1, maxY: 2 }],
        ["y only", { minX: 1, maxX: 3, minY: 2, maxY: 1 }],
    ])("returns the sorted rectangle for corners inverted on %s", (_axes, clip) => {
        const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
        const transformer = new CoordinateTransformer(camera);

        expect(clipRectPx(clip, (x, y) => transformer.worldToScreen(x, y))).toEqual({
            x: 15,
            y: 15,
            width: 20,
            height: 10,
        });
    });
});

describe("canvas2dClipAdapter", () => {
    function clipWith(clip: Bounds) {
        const rects: number[][] = [];
        const ctx = {
            beginPath() {},
            rect: (...args: number[]) => void rects.push(args),
            clip() {},
        };
        const transformer = new CoordinateTransformer({ x: 0, y: 0, scale: 10 } as unknown as ICamera);
        canvas2dClipAdapter()({ ctx, transformer } as never, clip);
        return rects;
    }

    it("cuts an inverted clip on the same rectangle as the sorted one", () => {
        const sorted = clipWith({ minX: 1, maxX: 3, minY: 1, maxY: 2 });

        expect(sorted).toEqual([[15, 15, 20, 10]]);
        expect(clipWith({ minX: 3, maxX: 1, minY: 2, maxY: 1 })).toEqual(sorted);
    });
});
