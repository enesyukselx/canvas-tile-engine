import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { CanvasDraw } from "../../src/modules/CanvasDraw";
import { Layer } from "../../src/modules/Layer";

// Minimal fake 2D context that records state at every stroke()/fill() call.
function makeRecordingCtx() {
    const strokes: Array<{ lineWidth: number; globalAlpha: number }> = [];
    const fills: Array<{ globalAlpha: number }> = [];
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
        moveTo() {},
        lineTo() {},
        translate() {},
        rotate() {},
        fill() {
            fills.push({ globalAlpha: ctx.globalAlpha });
        },
        stroke() {
            strokes.push({ lineWidth: ctx.lineWidth, globalAlpha: ctx.globalAlpha });
        },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, fills };
}

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer();
    const draw = new CanvasDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const render = (ctx: CanvasRenderingContext2D) =>
        layers.drawAll({ ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

describe("CanvasDraw lineWidth handling", () => {
    it("applies the sub-pixel lineWidth alpha to every item, not just the first", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeRecordingCtx();

        draw.drawRect(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.5 } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.5 } },
                { x: 5, y: 5, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.5 } },
            ],
            1,
        );
        render(ctx);

        expect(strokes).toHaveLength(3);
        for (const stroke of strokes) {
            expect(stroke.lineWidth).toBe(1);
            expect(stroke.globalAlpha).toBe(0.5);
        }
    });

    it("keeps fills opaque when a sub-pixel lineWidth is used for the stroke", () => {
        const { draw, render } = setup();
        const { ctx, fills } = makeRecordingCtx();

        draw.drawRect([{ x: 1, y: 1, size: 1, style: { fillStyle: "#0f0", strokeStyle: "#f00", lineWidth: 0.5 } }], 1);
        render(ctx);

        expect(fills).toHaveLength(1);
        expect(fills[0].globalAlpha).toBe(1);
    });

    it("defaults to lineWidth 1 instead of leaking the previous item's width", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeRecordingCtx();

        draw.drawRect(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidth: 8 } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#00f" } }, // no lineWidth
            ],
            1,
        );
        render(ctx);

        expect(strokes).toHaveLength(2);
        expect(strokes[0].lineWidth).toBe(8);
        expect(strokes[1].lineWidth).toBe(1);
    });

    it("handles circles the same way as rects", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeRecordingCtx();

        draw.drawCircle(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.5 } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.5 } },
            ],
            1,
        );
        render(ctx);

        expect(strokes).toHaveLength(2);
        for (const stroke of strokes) {
            expect(stroke.globalAlpha).toBe(0.5);
        }
    });
});

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
    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

function setupAtScale(scale: number) {
    const camera = { x: 0, y: 0, scale } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer();
    const draw = new CanvasDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    const render = (ctx: CanvasRenderingContext2D) =>
        layers.drawAll({ ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

// Font sizing contract shared by all renderers: px = fontPx ?? size * scale.
// The same fixture values are asserted in the webgl, skia, and server suites.
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
