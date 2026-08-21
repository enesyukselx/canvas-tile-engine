import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import type { GLRenderer } from "../../src/modules/gl/GLRenderer";

// Minimal fake overlay 2D context that records the active font at every fillText() call.
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
    const layers = new Layer<WebGLDrawContext>();
    const draw = new WebGLDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    // Text renders on the 2D overlay; the GL renderer is untouched.
    const gl = {} as GLRenderer;
    const render = (ctx: CanvasRenderingContext2D) =>
        layers.drawAll({ gl, ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

// Font sizing contract shared by all renderers: px = fontPx ?? size * scale.
// Mirrors the fixture values in the canvas, skia, and server suites.
describe("WebGLDraw text font sizing", () => {
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

        draw.drawText([
            { x: 20, y: 1, text: "culled" },
            { x: 20, y: 1, text: "visible", fontPx: 140 },
        ]);
        render(ctx);

        expect(texts.map((t) => t.text)).toEqual(["visible"]);
    });
});

// Font weight contract shared by all renderers: an unset weight is omitted
// entirely rather than emitted as "normal", so existing callers keep the exact
// font they had. The same fixture values are asserted in the canvas, skia, and server suites.
describe("WebGLDraw text font weight", () => {
    it("puts the weight in the overlay font shorthand", () => {
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
// ascent/descent, both positive, in screen pixels. WebGL measures on the same
// 2D overlay it draws text on, so a measurement and the drawn string agree.
describe("WebGLDraw measureText", () => {
    function setupMeasuring() {
        const fonts: string[] = [];
        const overlay = {
            font: "",
            measureText(text: string) {
                fonts.push(overlay.font);
                return { width: text.length * 7, actualBoundingBoxAscent: 9, actualBoundingBoxDescent: 3 };
            },
        } as unknown as CanvasRenderingContext2D;

        const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
        const transformer = new CoordinateTransformer(camera);
        const draw = new WebGLDraw(new Layer<WebGLDrawContext>(), transformer, camera, overlay);
        return { draw, fonts };
    }

    it("reports advance width and positive ink extents", () => {
        const { draw } = setupMeasuring();

        expect(draw.measureText("abcd", { fontPx: 12 })).toEqual({ width: 28, ascent: 9, descent: 3 });
    });

    it("measures with the font it would draw with, weight included", () => {
        const { draw, fonts } = setupMeasuring();

        draw.measureText("a", { fontPx: 14, fontFamily: "monospace", fontWeight: 700 });

        expect(fonts).toEqual(["700 14px monospace"]);
    });
});
