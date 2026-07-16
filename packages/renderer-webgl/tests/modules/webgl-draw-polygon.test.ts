import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { WebGLDraw } from "../../src/modules/WebGLDraw";
import { Layer } from "../../src/modules/Layer";
import type { GLRenderer, LineInstance } from "../../src/modules/gl/GLRenderer";

// Fake GL renderer recording triangle uploads and stroke lines.
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

describe("WebGLDraw polygons", () => {
    const triangle = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 3 },
    ];

    it("fills a triangle with exactly one triangulated triangle", () => {
        const { draw, render } = setup();
        const { gl, triangles } = makeRecordingGL();

        draw.drawPolygon({ points: triangle, style: { fillStyle: "#ff0000" } }, 1);
        render(gl);

        expect(triangles).toHaveLength(1);
        expect(triangles[0].vertexCount).toBe(3); // one triangle
        // Vertices are screen-space (world (0,0) → (5,5) at scale 10);
        // earcut's winding order is an implementation detail, so compare sets.
        const verts: string[] = [];
        for (let i = 0; i < triangles[0].data.length; i += 6) {
            verts.push(`${triangles[0].data[i]},${triangles[0].data[i + 1]}`);
        }
        expect(verts.sort()).toEqual(["25,35", "45,5", "5,5"]);
    });

    it("triangulates a concave ring into interior-only triangles", () => {
        const { draw, render } = setup();
        const { gl, triangles } = makeRecordingGL();

        // L-shape: 6 vertices → 4 triangles (n-2)
        const lShape = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 2 },
            { x: 2, y: 2 },
            { x: 2, y: 4 },
            { x: 0, y: 4 },
        ];
        draw.drawPolygon({ points: lShape, style: { fillStyle: "#00ff00" } }, 1);
        render(gl);

        expect(triangles[0].vertexCount).toBe(12); // 4 triangles × 3 vertices
    });

    it("strokes the closed ring including the closing edge", () => {
        const { draw, render } = setup();
        const { gl, lines, triangles } = makeRecordingGL();

        draw.drawPolygon({ points: triangle, style: { strokeStyle: "#0000ff", lineWidthPx: 2 } }, 1);
        render(gl);

        expect(lines).toHaveLength(3); // three edges, ring closed
        expect(triangles[0].vertexCount).toBe(0); // no fill requested
        for (const l of lines) expect(l.width).toBe(2);
    });

    it("culls off-viewport polygons", () => {
        const { draw, render } = setup(); // 10 world units visible (+1 buffer)
        const { gl, lines, triangles } = makeRecordingGL();

        draw.drawPolygon(
            {
                points: triangle.map((p) => ({ x: p.x + 100, y: p.y })),
                style: { fillStyle: "#f00", strokeStyle: "#00f" },
            },
            1,
        );
        render(gl);

        expect(triangles[0].vertexCount).toBe(0);
        expect(lines).toHaveLength(0);
    });
});
