import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import { GLRenderer, type LineInstance, type ShapeInstance } from "../../src/modules/gl/GLRenderer";
import type { RGBA } from "../../src/utils/color";

// Fake GL renderer that records shapes and every ramp registered against it.
function makeRecordingGL() {
    const shapes: ShapeInstance[] = [];
    const ramps: Array<{ key: string; stops: Array<{ offset: number; color: RGBA }> }> = [];
    const paths: Array<{ color: RGBA; gradient: unknown }> = [];
    const gl = {
        drawShapes(items: ShapeInstance[]) {
            shapes.push(...items);
        },
        drawLines(_items: LineInstance[]) {},
        rampRow(key: string, stops: Array<{ offset: number; color: RGBA }>) {
            const existing = ramps.findIndex((r) => r.key === key);
            if (existing >= 0) {
                return existing;
            }
            ramps.push({ key, stops });
            return ramps.length - 1;
        },
        fillPath(_rings: unknown, color: RGBA, _evenOdd: boolean, gradient: unknown) {
            paths.push({ color, gradient });
        },
    } as unknown as GLRenderer;
    return { gl, shapes, ramps, paths };
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

const topToBottom = {
    type: "linear" as const,
    from: { x: 0, y: 0 },
    to: { x: 0, y: 1 },
    stops: [
        { offset: 0, color: "#f00" },
        { offset: 1, color: "#00f" },
    ],
};

// Gradient fill contract shared by all renderers; the canvas, skia and server
// suites assert the same geometry through their own recorders. WebGL differs in
// one way that matters here: a shape's axis is expressed in the instance's own
// local (unrotated, center-origin) frame, because that is where the shader
// reads it.
describe("WebGLDraw gradient fills", () => {
    it("puts a box-unit axis in the shape's local frame", () => {
        const { draw, render } = setup(); // scale 10, camera at (0,0)
        const { gl, shapes, ramps } = makeRecordingGL();

        // size 2 at (2,2) -> center (25,25), half 10, so local box is -10..10
        draw.drawRect([{ x: 2, y: 2, size: 2, style: { fillStyle: topToBottom } }], 1);
        render(gl);

        expect(shapes[0].gradient).toEqual({ axis: { x0: -10, y0: -10, x1: -10, y1: 10 }, row: 0 });
        expect(ramps).toHaveLength(1);
        expect(ramps[0].stops.map((s) => s.offset)).toEqual([0, 1]);
    });

    it("keeps the first stop as the flat color", () => {
        // The stencil pass of a path fill ignores the ramp, so the flat color
        // has to stay meaningful rather than fall back to black
        const { draw, render } = setup();
        const { gl, shapes } = makeRecordingGL();

        draw.drawRect([{ x: 2, y: 2, style: { fillStyle: topToBottom } }], 1);
        render(gl);

        expect(shapes[0].color).toEqual([1, 0, 0, 1]);
    });

    it("shares one ramp row between items using the same gradient", () => {
        const { draw, render } = setup();
        const { gl, shapes, ramps } = makeRecordingGL();

        // Structurally identical specs, distinct objects — as a styleOf
        // callback would produce them
        draw.drawRect(
            [
                { x: 2, y: 2, style: { fillStyle: { ...topToBottom } } },
                { x: 4, y: 2, style: { fillStyle: { ...topToBottom } } },
            ],
            1,
        );
        render(gl);

        expect(ramps).toHaveLength(1);
        expect(shapes.map((s) => s.gradient?.row)).toEqual([0, 0]);
    });

    it("translates a world-unit axis into the local frame", () => {
        const { draw, render } = setup();
        const { gl, shapes } = makeRecordingGL();

        const world = { ...topToBottom, units: "world" as const, from: { x: 0, y: 0 }, to: { x: 0, y: 4 } };
        // Screen axis (5,5)->(5,45); the item's center is (25,25)
        draw.drawRect([{ x: 2, y: 2, style: { fillStyle: world } }], 1);
        render(gl);

        expect(shapes[0].gradient?.axis).toEqual({ x0: -20, y0: -20, x1: -20, y1: 20 });
    });

    it("centers a circle's axis on the circle", () => {
        const { draw, render } = setup();
        const { gl, shapes } = makeRecordingGL();

        draw.drawCircle([{ x: 2, y: 2, size: 2, style: { fillStyle: topToBottom } }], 1);
        render(gl);

        expect(shapes[0].gradient?.axis).toEqual({ x0: -10, y0: -10, x1: -10, y1: 10 });
    });

    it("hands a path fill a screen-space axis over its bounding box", () => {
        const { draw, render } = setup();
        const { gl, paths } = makeRecordingGL();

        draw.drawPath(
            [
                {
                    points: [
                        { x: 1, y: 1 },
                        { x: 3, y: 1 },
                        { x: 3, y: 2 },
                    ],
                    closed: true,
                    style: { fillStyle: topToBottom },
                },
            ],
            1,
        );
        render(gl);

        // The cover quad is unrotated screen space: bounds (1,1)-(3,2) -> (15,15)-(35,25)
        expect(paths[0].gradient).toEqual({ axis: { x0: 15, y0: 15, x1: 15, y1: 25 }, row: 0 });
    });

    it("leaves a solid fill without a gradient", () => {
        const { draw, render } = setup();
        const { gl, shapes, ramps } = makeRecordingGL();

        draw.drawRect([{ x: 2, y: 2, style: { fillStyle: "#0f0" } }], 1);
        render(gl);

        expect(shapes[0].gradient).toBeUndefined();
        expect(ramps).toHaveLength(0);
    });
});

/**
 * Permissive WebGL stub: unknown members resolve to functions returning a fresh
 * object, which satisfies shader compile/link (both only checked for
 * truthiness). Vertex uploads and ramp texture uploads are captured.
 */
function makeFakeGL() {
    const uploads: Float32Array[] = [];
    const textures: Array<{ width: number; height: number; pixels: Uint8Array }> = [];

    const overrides: Record<string, unknown> = {
        createTexture: () => ({}),
        bufferData: (_target: unknown, data: Float32Array) => {
            uploads.push(new Float32Array(data));
        },
        texImage2D: (...args: unknown[]) => {
            // 9-arg form: target, level, internalFormat, w, h, border, format, type, pixels
            if (args.length === 9) {
                textures.push({
                    width: args[3] as number,
                    height: args[4] as number,
                    pixels: new Uint8Array(args[8] as Uint8Array),
                });
            }
        },
    };

    const target: Record<string, unknown> = {};
    const gl = new Proxy(target, {
        get(_t, prop: string) {
            if (prop in overrides) {
                return overrides[prop];
            }
            if (!(prop in target)) {
                target[prop] = () => ({});
            }
            return target[prop];
        },
    }) as unknown as WebGLRenderingContext;

    return { gl, uploads, textures };
}

const FLOATS_PER_SHAPE_VERTEX = 16;

describe("GLRenderer gradient ramps", () => {
    it("rasterizes a ramp row and interpolates between stops", () => {
        const { gl, textures } = makeFakeGL();
        const renderer = new GLRenderer(gl);

        const row = renderer.rampRow("red-blue", [
            { offset: 0, color: [1, 0, 0, 1] },
            { offset: 1, color: [0, 0, 1, 1] },
        ]);
        renderer.drawShapes([
            {
                cx: 10,
                cy: 10,
                halfW: 5,
                halfH: 5,
                radius: [0, 0, 0, 0],
                rotation: 0,
                color: [1, 0, 0, 1],
                gradient: { axis: { x0: 0, y0: -5, x1: 0, y1: 5 }, row },
            },
        ]);

        const atlas = textures.at(-1)!;
        expect(atlas.width).toBe(256);
        expect(atlas.height).toBe(1);
        // First texel is the first stop, last is the last, middle is the blend
        expect([...atlas.pixels.slice(0, 4)]).toEqual([255, 0, 0, 255]);
        expect([...atlas.pixels.slice(255 * 4, 256 * 4)]).toEqual([0, 0, 255, 255]);
        const mid = [...atlas.pixels.slice(128 * 4, 129 * 4)];
        expect(mid[0]).toBeGreaterThan(100);
        expect(mid[0]).toBeLessThan(155);
        expect(mid[2]).toBeGreaterThan(100);
        expect(mid[3]).toBe(255);
    });

    it("gives each distinct ramp its own row and reuses a repeat", () => {
        const { gl } = makeFakeGL();
        const renderer = new GLRenderer(gl);

        const a = renderer.rampRow("a", [{ offset: 0, color: [1, 0, 0, 1] }]);
        const b = renderer.rampRow("b", [{ offset: 0, color: [0, 1, 0, 1] }]);

        expect([a, b]).toEqual([0, 1]);
        expect(renderer.rampRow("a", [{ offset: 0, color: [1, 0, 0, 1] }])).toBe(0);
    });

    it("writes the gradient parameter per vertex and a sentinel without one", () => {
        const { gl, uploads } = makeFakeGL();
        const renderer = new GLRenderer(gl);

        renderer.drawShapes([
            {
                cx: 10,
                cy: 10,
                halfW: 5,
                halfH: 5,
                radius: [0, 0, 0, 0],
                rotation: 0,
                color: [1, 0, 0, 1],
                // Local axis spanning the box vertically
                gradient: { axis: { x0: 0, y0: -5, x1: 0, y1: 5 }, row: 3 },
            },
        ]);

        const data = uploads.at(-1)!;
        const gradT = (vertex: number) => data[vertex * FLOATS_PER_SHAPE_VERTEX + 14];
        const gradRow = (vertex: number) => data[vertex * FLOATS_PER_SHAPE_VERTEX + 15];

        // Corner order is TL, TR, BR (first triangle); the 1px AA skirt puts
        // the top corners just past 0 and the bottom one just past 1.
        // The buffer is float32, so the comparison is at that precision.
        expect(gradT(0)).toBeCloseTo(-0.1, 6);
        expect(gradT(1)).toBeCloseTo(-0.1, 6);
        expect(gradT(2)).toBeCloseTo(1.1, 6);
        expect(gradRow(0)).toBe(3);
    });

    it("marks a solid shape with the no-gradient sentinel", () => {
        const { gl, uploads } = makeFakeGL();
        const renderer = new GLRenderer(gl);

        renderer.drawShapes([
            { cx: 10, cy: 10, halfW: 5, halfH: 5, radius: [0, 0, 0, 0], rotation: 0, color: [1, 0, 0, 1] },
        ]);

        const data = uploads.at(-1)!;
        expect(data[15]).toBe(-1);
        expect(data[14]).toBe(0);
    });
});
