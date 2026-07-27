import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import type { Canvas, Image, SKRSContext2D } from "@napi-rs/canvas";
import {
    CanvasDraw,
    Layer,
    type DrawContext,
    type OffscreenCanvasFactory,
} from "@canvas-tile-engine/renderer-shared/canvas2d";

// Minimal fake 2D context that records globalAlpha at every drawImage() call.
function makeImageRecordingCtx() {
    const blits: Array<{ alpha: number }> = [];
    const ctx = {
        globalAlpha: 1,
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        drawImage() {
            blits.push({ alpha: ctx.globalAlpha });
        },
    };
    return { ctx: ctx as unknown as SKRSContext2D, blits };
}

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<DrawContext<SKRSContext2D>>();
    const createOffscreen: OffscreenCanvasFactory<SKRSContext2D, Canvas> = () => {
        throw new Error("not used in these tests");
    };
    const draw = new CanvasDraw<SKRSContext2D, Image, Canvas>(layers, transformer, camera, createOffscreen);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const render = (ctx: SKRSContext2D) =>
        layers.drawAll({ ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

const fakeImage = { width: 10, height: 10 } as Image;

// Image opacity contract shared by all renderers: alpha = opacity ?? 1.
// Mirrors the fixture values in the canvas, webgl, and skia suites.
describe("CanvasDraw image opacity", () => {
    it("applies item opacity while drawing and restores globalAlpha", () => {
        const { draw, render } = setup();
        const { ctx, blits } = makeImageRecordingCtx();

        draw.drawImage([
            { x: 1, y: 1, img: fakeImage, opacity: 0.5 },
            { x: 3, y: 3, img: fakeImage },
            { x: 5, y: 5, img: fakeImage, sprite: { x: 0, y: 0, w: 5, h: 5 }, opacity: 0.25 },
        ]);
        render(ctx);

        expect(blits.map((b) => b.alpha)).toEqual([0.5, 1, 0.25]);
        expect(ctx.globalAlpha).toBe(1);
    });
});
