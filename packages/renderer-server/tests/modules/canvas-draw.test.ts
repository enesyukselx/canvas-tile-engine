import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { CanvasDraw, type OffscreenCanvasFactory } from "../../src/modules/CanvasDraw";
import { Layer } from "../../src/modules/Layer";

// Minimal fake 2D context that records the active font at every fillText() call.
function makeTextRecordingCtx() {
    const texts: Array<{ text: string; font: string }> = [];
    const ctx = {
        font: "",
        fillStyle: "#000",
        textAlign: "center",
        textBaseline: "middle",
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        fillText(text: string) {
            texts.push({ text, font: ctx.font });
        },
    };
    return { ctx: ctx as unknown as SKRSContext2D, texts };
}

function setupAtScale(scale: number) {
    const camera = { x: 0, y: 0, scale } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer();
    const createOffscreen: OffscreenCanvasFactory = () => {
        throw new Error("not used in these tests");
    };
    const draw = new CanvasDraw(layers, transformer, camera, createOffscreen);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    const render = (ctx: SKRSContext2D) =>
        layers.drawAll({ ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

// Font sizing contract shared by all renderers: px = fontPx ?? size * scale.
// Mirrors the fixture values in the canvas, webgl, and skia suites.
describe("CanvasDraw text font sizing", () => {
    it("renders size in world units (px = size * scale)", () => {
        const { draw, render } = setupAtScale(10);
        const { ctx, texts } = makeTextRecordingCtx();

        draw.drawText([
            { x: 1, y: 1, text: "default" },
            { x: 2, y: 1, text: "sized", size: 2 },
        ]);
        render(ctx);

        expect(texts).toEqual([
            { text: "default", font: "10px sans-serif" },
            { text: "sized", font: "20px sans-serif" },
        ]);
    });

    it("uses fontPx as a zoom-independent pixel size that wins over size", () => {
        for (const scale of [10, 50]) {
            const { draw, render } = setupAtScale(scale);
            const { ctx, texts } = makeTextRecordingCtx();

            draw.drawText([
                { x: 1, y: 1, text: "fixed", fontPx: 14 },
                { x: 2, y: 1, text: "both", size: 2, fontPx: 14 },
            ]);
            render(ctx);

            expect(texts).toEqual([
                { text: "fixed", font: "14px sans-serif" },
                { text: "both", font: "14px sans-serif" },
            ]);
        }
    });

    it("culls with the fontPx world-space extent (fontPx / scale)", () => {
        const { draw, render } = setupAtScale(10);
        const { ctx, texts } = makeTextRecordingCtx();

        // Viewport spans 10 world units (+1 tile buffer). x=20 with size 1 is
        // out of reach, but a 140px label spans 14 world units and pokes in.
        draw.drawText([
            { x: 20, y: 1, text: "culled" },
            { x: 20, y: 1, text: "visible", fontPx: 140 },
        ]);
        render(ctx);

        expect(texts.map((t) => t.text)).toEqual(["visible"]);
    });
});
