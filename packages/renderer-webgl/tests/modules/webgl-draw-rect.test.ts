import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera, type Rect } from "@canvas-tile-engine/core";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import type { GLRenderer, LineInstance, ShapeInstance } from "../../src/modules/gl/GLRenderer";

// Fake GL renderer recording every ShapeInstance passed to drawShapes.
function makeRecordingGL() {
    const shapes: ShapeInstance[] = [];
    const lines: LineInstance[] = [];
    const gl = {
        drawShapes(items: ShapeInstance[]) {
            shapes.push(...items);
        },
        drawLines(items: LineInstance[]) {
            lines.push(...items);
        },
    } as unknown as GLRenderer;
    return { gl, shapes, lines };
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
    const layers = new Layer<WebGLDrawContext>();
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

describe("WebGLDraw rounded rectangles", () => {
    function record(radius: Rect["radius"], extra: Partial<Rect> = {}) {
        const { draw, render } = setup();
        const recording = makeRecordingGL();
        draw.drawRect({
            x: 0,
            y: 0,
            widthPx: 100,
            heightPx: 20,
            origin: { mode: "self", x: 0, y: 0 },
            radius,
            style: { fillStyle: "red", strokeStyle: "blue", lineWidthPx: 2 },
            ...extra,
        });
        render(recording.gl);
        return recording;
    }

    it.each([
        { radius: [2, 2, 0, 0], expected: [20, 20, 0, 0] },
        { radius: [0, 0, 2, 2], expected: [0, 0, 20, 20] },
        { radius: [2, 0, 0, 2], expected: [10, 0, 0, 10] },
        { radius: [0, 2, 2, 0], expected: [0, 10, 10, 0] },
        { radius: [4, 4, 0, 0], expected: [20, 20, 0, 0] },
        { radius: [4, 0, 1, 0], expected: [20, 0, 5, 0] },
        { radius: 1e6, expected: [10, 10, 10, 10] },
        { radius: 1e307, expected: [10, 10, 10, 10] },
        { radius: [0.2], expected: [2, 2, 2, 2] },
        { radius: [0.2, 0.4], expected: [2, 4, 2, 4] },
        { radius: [0.2, 0.4, 0.6], expected: [2, 4, 6, 4] },
        { radius: 0, expected: [0, 0, 0, 0] },
    ])("normalizes $radius against adjacent edge sums", ({ radius, expected }) => {
        expect(record(radius).shapes[0].radius).toEqual(expected);
    });

    it("uses the horizontal limit on a tall box", () => {
        expect(record([2, 0, 0, 2], { widthPx: 20, heightPx: 100 }).shapes[0].radius).toEqual([20, 0, 0, 20]);
    });

    it("strokes the same asymmetric contour as the fill", () => {
        const { shapes, lines } = record([2, 2, 0, 0]);
        expect(shapes[0].radius).toEqual([20, 20, 0, 0]);
        expect(lines.length).toBeGreaterThan(4);
        expect(lines[0]).toMatchObject({ x1: 25, y1: 5, x2: 85, y2: 5 });
        expect(lines.some((line) => line.x1 !== line.x2 && line.y1 !== line.y2)).toBe(true);
        // Every endpoint belongs to the straight base or a true circular arc,
        // including the part below the box's horizontal center line.
        for (const { x1: x, y1: y } of lines) {
            if (y === 25 || y === 5) {
                continue;
            }
            const centerX = x < 55 ? 25 : 85;
            expect(Math.hypot(x - centerX, y - 25)).toBeCloseTo(20, 8);
        }
        for (let i = 0; i < lines.length; i++) {
            const prev = lines[(i + lines.length - 1) % lines.length];
            expect(lines[i].x1).toBeCloseTo(prev.x2);
            expect(lines[i].y1).toBeCloseTo(prev.y2);
            expect(lines[i].startOffset).toEqual(prev.endOffset);
        }
    });

    it("produces different stroke geometry for radius 2 and radius 0", () => {
        expect(record(2).lines).not.toEqual(record(0).lines);
    });

    it("supports fill-only and stroke-only items", () => {
        const filled = record(1, { style: { fillStyle: "red" } });
        expect(filled.shapes).toHaveLength(1);
        expect(filled.lines).toHaveLength(0);
        const stroked = record(1, { style: { strokeStyle: "blue" } });
        expect(stroked.shapes).toHaveLength(0);
        expect(stroked.lines.length).toBeGreaterThan(4);
    });

    it("carries dash phase from the top edge into the rounded corner", () => {
        const { lines } = record([2, 2, 0, 0], {
            style: { strokeStyle: "blue", lineWidthPx: 2, lineDashPx: [65, 200] },
        });
        expect(lines[0]).toMatchObject({ x1: 25, y1: 5, x2: 85, y2: 5 });
        expect(lines[1].x1).toBeCloseTo(85);
        expect(lines[1].y1).toBeCloseTo(5);
        const length = lines.reduce((total, l) => total + Math.hypot(l.x2 - l.x1, l.y2 - l.y1), 0);
        expect(length).toBeCloseTo(65, 8);
        expect(lines[lines.length - 1].endOffset).toBeUndefined(); // flat dash cap
        expect(lines[0].startOffset).toBeUndefined();
    });

    it("rotates rounded dash endpoints and joined offsets around the box center", () => {
        const style = { strokeStyle: "blue", lineDash: [1.3, 0.7] };
        const plain = record([2, 2, 0, 0], { style }).lines;
        const rotated = record([2, 2, 0, 0], { style, rotate: 90 }).lines;
        expect(rotated).toHaveLength(plain.length);
        for (let i = 0; i < plain.length; i++) {
            expect(rotated[i].x1).toBeCloseTo(55 - (plain[i].y1 - 15));
            expect(rotated[i].y1).toBeCloseTo(15 + (plain[i].x1 - 55));
            expect(rotated[i].x2).toBeCloseTo(55 - (plain[i].y2 - 15));
            expect(rotated[i].y2).toBeCloseTo(15 + (plain[i].x2 - 55));
            if (plain[i].startOffset) {
                expect(rotated[i].startOffset!.x).toBeCloseTo(-plain[i].startOffset!.y);
                expect(rotated[i].startOffset!.y).toBeCloseTo(plain[i].startOffset!.x);
            }
        }
    });

    it("preserves subpixel stroke opacity on the rounded contour", () => {
        const { lines } = record(1, { style: { strokeStyle: "rgba(0,0,255,0.5)", lineWidthPx: 0.5 } });
        expect(lines.every((line) => line.width === 1 && line.color[3] === 0.25)).toBe(true);
    });

    it.each([0.02, 0.1, 0.2, 1])(
        "groups translucent wide strokes with radius %s for one color write per pixel",
        (radius) => {
            const { lines } = record(radius, { style: { strokeStyle: "#00000080", lineWidthPx: 24 } });
            expect(lines.length).toBeGreaterThan(4);
            expect(lines[0].strokeGroup).toBeDefined();
            expect(lines.every((line) => line.strokeGroup === lines[0].strokeGroup)).toBe(true);
            expect(lines[0].strokeGroup).not.toBe(record(radius).lines[0].strokeGroup);
        },
    );

    it.each([[], [1, 2, 3, 4, 5], [-1], -1])("rejects invalid Canvas radii %j", (radius) => {
        expect(() => record(radius)).toThrow(RangeError);
    });

    it.each([NaN, Infinity, [0, NaN], [0, Infinity]])("does not upload nonfinite radii %j", (radius) => {
        const { shapes, lines } = record(radius);
        expect(shapes).toHaveLength(0);
        expect(lines).toHaveLength(0);
    });

    it("validates dimensions first, then radii in input order", () => {
        expect(() => record([-1, Infinity])).toThrow(RangeError);
        expect(record([Infinity, -1]).shapes).toHaveLength(0);
        expect(record(-1, { widthPx: Infinity }).shapes).toHaveLength(0);
    });

    it("continues dash phase on the return edge of a collapsed rectangle", () => {
        const { lines } = record(1, {
            widthPx: 0,
            heightPx: 20,
            style: { strokeStyle: "#00000080", lineDashPx: [13, 7] },
        });
        expect(lines).toHaveLength(2);
        expect(lines[0]).toMatchObject({ x1: 5, y1: 5, x2: 5, y2: 18 });
        expect(lines[1]).toMatchObject({ x1: 5, y1: 25, x2: 5, y2: 12 });
        expect(lines[0].strokeGroup).toBe(lines[1].strokeGroup);
    });

    it.each([
        { widthPx: 0, heightPx: 20, count: 1 },
        { widthPx: 100, heightPx: 0, count: 1 },
        { widthPx: 0, heightPx: 0, count: 0 },
    ])("handles collapsed dimensions $widthPx x $heightPx", ({ widthPx, heightPx, count }) => {
        const { shapes, lines } = record(100, { widthPx, heightPx });
        expect(shapes).toHaveLength(0);
        expect(lines).toHaveLength(count);
        expect(lines.flatMap(({ x1, y1, x2, y2 }) => [x1, y1, x2, y2]).every(Number.isFinite)).toBe(true);
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

// Pixel-sized rect contract shared by all renderers; the same fixture values
// are asserted in the canvas, skia, and server suites (as quad center + half
// sizes).
describe("WebGLDraw pixel-sized rects", () => {
    it("resolves each axis against the live scale", () => {
        const { draw, render } = setup();
        const { gl, shapes } = makeRecordingGL();

        draw.drawRect(
            [
                { x: 2, y: 2, size: 4, sizePx: 30, style: { fillStyle: "#f00" } },
                { x: 2, y: 2, size: 4, sizePx: 30, widthPx: 50, style: { fillStyle: "#0f0" } },
                { x: 2, y: 2, widthPx: 50, height: 4, style: { fillStyle: "#00f" } },
            ],
            1,
        );
        render(gl);

        expect(shapes.map(({ cx, cy, halfW, halfH }) => ({ cx, cy, halfW, halfH }))).toEqual([
            { cx: 25, cy: 25, halfW: 15, halfH: 15 },
            { cx: 25, cy: 25, halfW: 25, halfH: 15 },
            { cx: 25, cy: 25, halfW: 25, halfH: 20 },
        ]);
    });

    it("strips pixel sizes from static rects", () => {
        // WebGL redraws statics through the dynamic path, so it has to drop
        // the pixel fields itself to stay identical to the cached renderers
        // (whose hit boxes ignore them too).
        const { draw, render } = setup();
        const { gl, shapes } = makeRecordingGL();

        draw.drawStaticRect([{ x: 2, y: 2, size: 1, sizePx: 30, widthPx: 50, style: { fillStyle: "#f00" } }], "k", 1);
        render(gl);

        expect(shapes.map(({ halfW, halfH }) => ({ halfW, halfH }))).toEqual([{ halfW: 5, halfH: 5 }]);
    });
});
