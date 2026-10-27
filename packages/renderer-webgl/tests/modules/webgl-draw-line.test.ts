import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import type { GLRenderer, LineInstance } from "../../src/modules/gl/GLRenderer";

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

function setup(scale = 10) {
    const camera = { x: 0, y: 0, scale } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<WebGLDrawContext>();
    const draw = new WebGLDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    const ctx = { save() {}, restore() {} } as unknown as CanvasRenderingContext2D;
    const render = (gl: GLRenderer) =>
        layers.drawAll({ gl, ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

describe("WebGLDraw grid intervals", () => {
    it.each([-1, -0.25, 0, -0, NaN, Infinity, -Infinity, "1", null, undefined])(
        "rejects invalid cellSize %s synchronously without registering a draw",
        (cellSize) => {
            const { draw, render } = setup();
            const { gl, lines } = makeLineRecordingGL();

            expect(() => draw.drawGridLines(cellSize as number, { lineWidth: 1, strokeStyle: "#000" })).toThrow(
                new RangeError("[CanvasTileEngine] cellSize must be a positive finite number"),
            );
            render(gl);
            expect(lines).toHaveLength(0);
        },
    );

    it.each([0.5, 2])("renders positive cellSize %s and returns a removable handle", (cellSize) => {
        const { draw, render } = setup();
        const { gl, lines } = makeLineRecordingGL();

        const handle = draw.drawGridLines(cellSize, { lineWidth: 1, strokeStyle: "#000" }, 3);
        expect(handle.layer).toBe(3);
        render(gl);
        const lineCount = 2 * (10 / cellSize + 1);
        expect(lines).toHaveLength(lineCount);

        draw.removeDrawHandle(handle);
        render(gl);
        expect(lines).toHaveLength(lineCount);
    });
});

// Grid density contract shared by all renderers (mirrored in the server and
// skia suites): lines never get closer than 2px, so the vertex count is
// bounded by the 100x100px viewport rather than by 1 / scale.
describe("WebGLDraw grid line density", () => {
    function renderGridLines(cellSize: number, scale: number) {
        const { draw, render } = setup(scale);
        const { gl, lines } = makeLineRecordingGL();
        draw.drawGridLines(cellSize, { lineWidth: 1, strokeStyle: "#000" });
        render(gl);
        return lines;
    }
    const verticalXs = (lines: LineInstance[]) => lines.filter((l) => l.x1 === l.x2).map((l) => l.x1);

    it("bounds the line count when zoomed far out", () => {
        // 100px at scale 0.1 spans 1000 cells: 1001 lines per axis, 0.1px apart.
        const lines = renderGridLines(1, 0.1);

        expect(lines.length).toBeLessThanOrEqual(2 * (100 / 2 + 2));
        const xs = verticalXs(lines);
        for (let i = 1; i < xs.length; i++) {
            expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(2);
        }
    });

    it.each([
        [0.5, 10],
        [1, 2], // exactly 2px apart: still every line
    ])("keeps every line and its position for cellSize %s at scale %s", (cellSize, scale) => {
        const spacing = cellSize * scale;
        const perAxis = 100 / spacing + 1;
        const lines = renderGridLines(cellSize, scale);

        expect(lines).toHaveLength(2 * perAxis);
        expect(verticalXs(lines)).toEqual(Array.from({ length: perAxis }, (_, i) => i * spacing));
    });
});

// Per-item line style contract shared by all renderers: item.style overlays
// the call-level style field by field; each LineInstance already carries its
// own color/width, so overrides map straight onto the batch geometry.
describe("WebGLDraw per-item line style", () => {
    it("applies an item's own width and color, leaving the rest on the batch style", () => {
        const { draw, render } = setup();
        const { gl, lines } = makeLineRecordingGL();

        draw.drawLine(
            [
                { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
                { from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, style: { strokeStyle: "#f00", lineWidthPx: 6 } },
                { from: { x: 0, y: 2 }, to: { x: 1, y: 2 } },
            ],
            { strokeStyle: "#00f", lineWidthPx: 2 },
            1,
        );
        render(gl);

        // Hex resolves without a 2D canvas (ColorParser's inline fast path), so
        // colors are assertable in node.
        expect(lines.map((l) => l.width)).toEqual([2, 6, 2]);
        expect(lines.map((l) => l.color)).toEqual([
            [0, 0, 1, 1],
            [1, 0, 0, 1],
            [0, 0, 1, 1],
        ]);
    });

    it("scales item world lineWidth by the camera scale", () => {
        const { draw, render } = setup(); // scale 10
        const { gl, lines } = makeLineRecordingGL();

        draw.drawLine(
            [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, style: { lineWidth: 0.5 } }],
            { strokeStyle: "#00f", lineWidthPx: 2 },
            1,
        );
        render(gl);

        expect(lines).toHaveLength(1);
        expect(lines[0].width).toBe(5); // 0.5 world * scale 10
    });

    it("ignores a width smuggled into a styleOf decoration", () => {
        const { draw, render } = setup();
        const { gl, lines } = makeLineRecordingGL();

        // Non-literal returns bypass TS excess-property checks; the width
        // must resolve from the registration-time layers hit testing reads.
        const smuggled = { strokeStyle: "#0f0", lineWidthPx: 12 };
        draw.drawLine(
            [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, style: { lineWidthPx: 4 } }],
            { strokeStyle: "#00f", lineWidthPx: 2 },
            1,
            { styleOf: () => smuggled },
        );
        render(gl);

        expect(lines).toHaveLength(1);
        expect(lines[0].width).toBe(4); // item width, not the smuggled 12
    });

    it("tessellates an item's own dash pattern", () => {
        const { draw, render } = setup();
        const { gl, lines } = makeLineRecordingGL();

        // 10px segment with a 5px on / 5px off item dash -> one on-segment;
        // the plain neighbor stays a single solid instance.
        draw.drawLine(
            [
                { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, style: { lineDashPx: [5, 5] } },
                { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
            ],
            { strokeStyle: "#00f" },
            1,
        );
        render(gl);

        expect(lines).toHaveLength(2);
        expect(Math.hypot(lines[0].x2 - lines[0].x1, lines[0].y2 - lines[0].y1)).toBeCloseTo(5);
        expect(Math.hypot(lines[1].x2 - lines[1].x1, lines[1].y2 - lines[1].y1)).toBeCloseTo(10);
    });
});
