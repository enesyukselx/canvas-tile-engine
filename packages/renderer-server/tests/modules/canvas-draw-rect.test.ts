import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import type { SKRSContext2D } from "@napi-rs/canvas";
import { CanvasDraw, type OffscreenCanvasFactory } from "../../src/modules/CanvasDraw";
import { Layer } from "../../src/modules/Layer";

// Fake 2D context recording every rect(x, y, w, h) call.
function makeRectRecordingCtx() {
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        fillStyle: "#000",
        strokeStyle: "#000",
        save() {},
        restore() {},
        beginPath() {},
        translate() {},
        rotate() {},
        fill() {},
        stroke() {},
        rect(x: number, y: number, w: number, h: number) {
            rects.push({ x, y, w, h });
        },
    };
    return { ctx: ctx as unknown as SKRSContext2D, rects };
}

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer();
    const createOffscreen: OffscreenCanvasFactory = () => {
        throw new Error("not used in these tests");
    };
    const draw = new CanvasDraw(layers, transformer, camera, createOffscreen);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const render = (ctx: SKRSContext2D) =>
        layers.drawAll({ ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

// Non-square rect contract shared by all renderers; mirrors the fixture
// values in the canvas, webgl, and skia suites.
describe("CanvasDraw non-square rects", () => {
    it("draws width/height boxes with per-axis origin anchoring", () => {
        const { draw, render } = setup();
        const { ctx, rects } = makeRectRecordingCtx();

        draw.drawRect(
            [
                { x: 2, y: 2, width: 4, height: 2, style: { fillStyle: "#f00" } },
                { x: 2, y: 2, size: 1, style: { fillStyle: "#0f0" } },
                { x: 1, y: 1, width: 2, height: 1, origin: { mode: "self", x: 0, y: 0 }, style: { fillStyle: "#00f" } },
            ],
            1,
        );
        render(ctx);

        expect(rects).toEqual([
            { x: 5, y: 15, w: 40, h: 20 },
            { x: 20, y: 20, w: 10, h: 10 },
            { x: 15, y: 15, w: 20, h: 10 },
        ]);
    });

    it("culls with the max(width, height) extent", () => {
        const { draw, render } = setup();
        const { ctx, rects } = makeRectRecordingCtx();

        draw.drawRect(
            [
                { x: 20, y: 0, width: 30, height: 1, style: { fillStyle: "#f00" } },
                { x: 20, y: 0, size: 1, style: { fillStyle: "#0f0" } },
            ],
            1,
        );
        render(ctx);

        expect(rects).toHaveLength(1);
        expect(rects[0].w).toBe(300);
    });
});

// Fake 2D context recording setLineDash calls and strokes for dash tests.
function makeDashRecordingCtx() {
    const dashes: number[][] = [];
    let strokeCount = 0;
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        fillStyle: "#000",
        strokeStyle: "#000",
        save() {},
        restore() {},
        beginPath() {},
        rect() {},
        arc() {},
        fill() {},
        setLineDash(pattern: number[]) {
            dashes.push(pattern);
        },
        stroke() {
            strokeCount++;
        },
    };
    return { ctx: ctx as unknown as SKRSContext2D, dashes, strokes: () => strokeCount };
}

// Dash unit contract shared by all renderers: lineDash is world units
// (px = value * scale), lineDashPx is screen pixels and wins.
describe("CanvasDraw dashed rect/circle borders", () => {
    it("dashes rect borders and resets after the stroke", () => {
        const { draw, render } = setup(); // scale 10
        const { ctx, dashes } = makeDashRecordingCtx();

        draw.drawRect([{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineDash: [0.8, 0.4] } }], 1);
        render(ctx);

        expect(dashes).toEqual([[8, 4], []]);
    });

    it("dashes circle borders preferring lineDashPx and stays solid without a dash", () => {
        const { draw, render } = setup();
        const { ctx, dashes, strokes } = makeDashRecordingCtx();

        draw.drawCircle(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineDash: [0.8], lineDashPx: [6, 3] } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#00f" } },
            ],
            1,
        );
        render(ctx);

        expect(dashes).toEqual([[6, 3], []]);
        expect(strokes()).toBe(2);
    });
});
