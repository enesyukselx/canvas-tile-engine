import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { WebGLDraw } from "../../src/modules/WebGLDraw";
import { Layer } from "../../src/modules/Layer";
import type { GLRenderer, LineInstance } from "../../src/modules/gl/GLRenderer";

// Fake GL renderer recording triangle batches and line instances.
function makeRecordingGL() {
    const triangles: Array<{ data: Float32Array; vertexCount: number }> = [];
    const lines: LineInstance[] = [];
    const gl = {
        drawTriangles(data: Float32Array, vertexCount: number) {
            triangles.push({ data, vertexCount });
        },
        drawLines(items: LineInstance[]) {
            lines.push(...items);
        },
        drawShapes() {},
    } as unknown as GLRenderer;
    return { gl, triangles, lines };
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

const square = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
];

describe("WebGLDraw path items", () => {
    it("triangulates filled items (two triangles for a square) and skips the stroke when fill-only", () => {
        const { draw, render } = setup();
        const { gl, triangles, lines } = makeRecordingGL();

        draw.drawPath([{ points: square, style: { fillStyle: "#f00" } }], 1);
        render(gl);

        expect(triangles).toHaveLength(1);
        expect(triangles[0].vertexCount).toBe(6);
        expect(lines).toHaveLength(0);
    });

    it("strokes the closing segment only when closed", () => {
        const { draw, render } = setup();
        const open = makeRecordingGL();
        draw.drawPath([{ points: square, style: { strokeStyle: "#f00" } }], 1);
        render(open.gl);
        expect(open.lines).toHaveLength(3);

        const layers2 = setup();
        const closed = makeRecordingGL();
        layers2.draw.drawPath([{ points: square, closed: true, style: { strokeStyle: "#f00" } }], 1);
        layers2.render(closed.gl);
        expect(closed.lines).toHaveLength(4);
    });

    it("strokes a hairline by default when the item has no style", () => {
        const { draw, render } = setup();
        const { gl, lines, triangles } = makeRecordingGL();

        draw.drawPath([{ points: square.slice(0, 2) }], 1);
        render(gl);

        expect(triangles[0].vertexCount).toBe(0);
        expect(lines).toHaveLength(1);
    });

    it("densifies the outline when cornerRadius is set (arc flattening)", () => {
        const { draw, render } = setup();
        const { gl, lines } = makeRecordingGL();

        draw.drawPath([{ points: square, closed: true, style: { strokeStyle: "#f00", cornerRadius: 1 } }], 1);
        render(gl);

        // Four rounded corners flatten into many short segments
        expect(lines.length).toBeGreaterThan(8);
    });

    it("re-triangulates rounded filled outlines instead of using the registration-time indices", () => {
        const { draw, render } = setup();
        const { gl, triangles } = makeRecordingGL();

        draw.drawPath([{ points: square, closed: true, style: { fillStyle: "#f00", cornerRadius: 1 } }], 1);
        render(gl);

        // The rounded ring has more vertices than the square, so the fan
        // produces more than the square's two triangles.
        expect(triangles[0].vertexCount).toBeGreaterThan(6);
    });
});
