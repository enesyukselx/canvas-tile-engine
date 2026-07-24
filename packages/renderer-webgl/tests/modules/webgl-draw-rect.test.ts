import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { WebGLDraw } from "../../src/modules/WebGLDraw";
import { Layer } from "../../src/modules/Layer";
import type { GLRenderer, LineInstance, ShapeInstance } from "../../src/modules/gl/GLRenderer";

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

// Fake GL renderer recording every LineInstance passed to drawLines.
function makeLineRecordingGL() {
    const lines: LineInstance[] = [];
    const gl = {
        drawShapes() {},
        drawLines(items: LineInstance[]) {
            lines.push(...items);
        },
    } as unknown as GLRenderer;
    return { gl, lines };
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

// Dashed borders are CPU-tessellated into on-interval sub-segments; the phase
// flows around the perimeter so the pattern is continuous across corners.
describe("WebGLDraw dashed rect/circle borders", () => {
    it("keeps solid rect strokes as four corner-covering edge lines", () => {
        const { draw, render } = setup();
        const { gl, lines } = makeLineRecordingGL();

        draw.drawRect([{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 2 } }], 1);
        render(gl);

        expect(lines).toHaveLength(4);
    });

    it("tessellates dashed rect borders around the perimeter", () => {
        const { draw, render } = setup(); // scale 10 -> screen box (10,10)-(20,20)
        const { gl, lines } = makeLineRecordingGL();

        // 5px on / 5px off on 10px edges: one on-segment per edge, and the
        // phase re-enters "on" exactly at each corner.
        draw.drawRect([{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineDashPx: [5, 5] } }], 1);
        render(gl);

        expect(lines.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 }))).toEqual([
            { x1: 10, y1: 10, x2: 15, y2: 10 }, // top: tl -> midpoint
            { x1: 20, y1: 10, x2: 20, y2: 15 }, // right: tr -> midpoint
            { x1: 20, y1: 20, x2: 15, y2: 20 }, // bottom: br -> midpoint
            { x1: 10, y1: 20, x2: 10, y2: 15 }, // left: bl -> midpoint
        ]);
    });

    it("scales world lineDash by the camera scale", () => {
        const { draw, render } = setup(); // scale 10
        const { gl, lines } = makeLineRecordingGL();

        // world [0.5, 0.5] -> px [5, 5]: same tessellation as the px test above
        draw.drawRect([{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineDash: [0.5, 0.5] } }], 1);
        render(gl);

        expect(lines).toHaveLength(4);
        expect(lines[0]).toMatchObject({ x1: 10, y1: 10, x2: 15, y2: 10 });
    });

    it("dashes circle borders through the chord polyline without miter extensions", () => {
        const { draw, render } = setup(); // circle at (15,15), r = 5
        const { gl, lines } = makeLineRecordingGL();

        // The on-interval covers the whole outline: every chord survives as-is,
        // so the first chord starts exactly on the circle (the solid path would
        // extend it by the miter length).
        draw.drawCircle([{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineDashPx: [1000, 1] } }], 1);
        render(gl);

        expect(lines).toHaveLength(48);
        expect(lines[0].x1).toBe(20);
        expect(lines[0].y1).toBe(15);
    });
});
