import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { WebGLDraw } from "../../src/modules/WebGLDraw";
import { Layer } from "../../src/modules/Layer";
import type { GLRenderer, ShapeInstance } from "../../src/modules/gl/GLRenderer";

// Fake GL renderer recording every ShapeInstance passed to drawShapes.
function makeRecordingGL() {
    const shapes: ShapeInstance[] = [];
    const gl = {
        drawShapes(items: ShapeInstance[]) {
            shapes.push(...items);
        },
        drawLines() {},
    } as unknown as GLRenderer;
    return { gl, shapes };
}

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer();
    const draw = new WebGLDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const ctx = { save() {}, restore() {} } as unknown as CanvasRenderingContext2D;
    const render = (gl: GLRenderer) =>
        layers.drawAll({ gl, ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

// Non-square rect contract shared by all renderers; mirrors the fixture
// values in the canvas, skia, and server suites (as quad center + half sizes).
describe("WebGLDraw non-square rects", () => {
    it("generates quads with per-axis half sizes and origin anchoring", () => {
        const { draw, render } = setup();
        const { gl, shapes } = makeRecordingGL();

        draw.drawRect(
            [
                // cell-center origin: screen box (5,15,40,20) -> center (25,25), half (20,10)
                { x: 2, y: 2, width: 4, height: 2, style: { fillStyle: "#f00" } },
                // square regression: size-only behavior is unchanged
                { x: 2, y: 2, size: 1, style: { fillStyle: "#0f0" } },
                // self origin {0,0}: screen box (15,15,20,10) -> center (25,20)
                { x: 1, y: 1, width: 2, height: 1, origin: { mode: "self", x: 0, y: 0 }, style: { fillStyle: "#00f" } },
            ],
            1,
        );
        render(gl);

        expect(shapes.map(({ cx, cy, halfW, halfH }) => ({ cx, cy, halfW, halfH }))).toEqual([
            { cx: 25, cy: 25, halfW: 20, halfH: 10 },
            { cx: 25, cy: 25, halfW: 5, halfH: 5 },
            { cx: 25, cy: 20, halfW: 10, halfH: 5 },
        ]);
    });

    it("culls with the max(width, height) extent", () => {
        const { draw, render } = setup();
        const { gl, shapes } = makeRecordingGL();

        draw.drawRect(
            [
                { x: 20, y: 0, width: 30, height: 1, style: { fillStyle: "#f00" } },
                { x: 20, y: 0, size: 1, style: { fillStyle: "#0f0" } }, // stays culled
            ],
            1,
        );
        render(gl);

        expect(shapes).toHaveLength(1);
        expect(shapes[0].halfW).toBe(150);
    });
});
