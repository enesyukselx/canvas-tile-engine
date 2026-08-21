import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import type { Canvas, Image, SKRSContext2D } from "@napi-rs/canvas";
import { CanvasDraw, type OffscreenCanvasFactory } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { Layer, type DrawContext } from "@canvas-tile-engine/renderer-shared/scene";

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
    const layers = new Layer<DrawContext<SKRSContext2D>>();
    const createOffscreen: OffscreenCanvasFactory<SKRSContext2D, Canvas> = () => {
        throw new Error("not used in these tests");
    };
    const draw = new CanvasDraw<SKRSContext2D, Image, Canvas>(layers, transformer, camera, createOffscreen);
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

// Fake 2D context recording stroke style/width at every stroke() call.
function makeLineStyleRecordingCtx() {
    const strokes: Array<{ strokeStyle: string; lineWidth: number }> = [];
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        strokeStyle: "#000",
        save() {},
        restore() {},
        beginPath() {},
        moveTo() {},
        lineTo() {},
        setLineDash() {},
        stroke() {
            strokes.push({ strokeStyle: ctx.strokeStyle, lineWidth: ctx.lineWidth });
        },
    };
    return { ctx: ctx as unknown as SKRSContext2D, strokes };
}

// Per-item line style contract shared by all renderers (mirrors the canvas
// suite): item.style overlays the call-level style field by field.
describe("CanvasDraw per-item line style", () => {
    it("strokes styled items solo with merged style and restores the batch style", () => {
        const { draw, render } = setupAtScale(10);
        const { ctx, strokes } = makeLineStyleRecordingCtx();

        draw.drawLine(
            [
                { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
                { from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, style: { strokeStyle: "#f00", lineWidthPx: 6 } },
                { from: { x: 0, y: 2 }, to: { x: 1, y: 2 } },
            ],
            { strokeStyle: "#00f", lineWidthPx: 2 },
            1,
        );
        render(ctx);

        expect(strokes.map((s) => [s.strokeStyle, s.lineWidth])).toEqual([
            ["#00f", 2],
            ["#f00", 6],
            ["#00f", 2],
        ]);
    });
});

// Font weight contract shared by all renderers: an unset weight is omitted
// entirely rather than emitted as "normal". The same fixture values are
// asserted in the canvas, webgl, and skia suites.
describe("CanvasDraw text font weight", () => {
    it("puts the weight in the font shorthand", () => {
        const { draw, render } = setupAtScale(10);
        const { ctx, texts } = makeTextRecordingCtx();

        draw.drawText([
            { x: 1, y: 1, text: "plain" },
            { x: 2, y: 1, text: "bold", style: { fontWeight: "bold" } },
            { x: 3, y: 1, text: "numeric", fontPx: 14, style: { fontWeight: 700, fontFamily: "monospace" } },
        ]);
        render(ctx);

        expect(texts).toEqual([
            { text: "plain", font: "10px sans-serif" },
            { text: "bold", font: "bold 10px sans-serif" },
            { text: "numeric", font: "700 14px monospace" },
        ]);
    });
});

// Measurement contract shared by all renderers: advance width plus ink
// ascent/descent, both positive, in screen pixels. The server measures on the
// same napi surface it draws on, so registered fonts apply.
describe("CanvasDraw measureText", () => {
    it("reports advance width and positive ink extents", () => {
        const scratch = {
            font: "",
            measureText: (text: string) => ({
                width: text.length * 7,
                actualBoundingBoxAscent: 9,
                actualBoundingBoxDescent: 3,
            }),
        };
        const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
        const transformer = new CoordinateTransformer(camera);
        const draw = new CanvasDraw<SKRSContext2D, Image, Canvas>(
            new Layer<DrawContext<SKRSContext2D>>(),
            transformer,
            camera,
            () => ({ canvas: {} as Canvas, ctx: scratch as unknown as SKRSContext2D }),
        );

        expect(draw.measureText("abcd", { fontPx: 12 })).toEqual({ width: 28, ascent: 9, descent: 3 });
    });
});
