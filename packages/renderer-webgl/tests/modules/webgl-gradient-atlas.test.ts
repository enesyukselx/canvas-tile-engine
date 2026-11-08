import { describe, expect, it } from "vitest";
import {
    CoordinateTransformer,
    type Circle,
    type ICamera,
    type LinearGradient,
    type Rect,
} from "@canvas-tile-engine/core";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import { GLRenderer } from "../../src/modules/gl/GLRenderer";

const MAX_TEXTURE_SIZE = 0x0d33;
const RAMP_WIDTH = 256;
const FLOATS_PER_SHAPE_VERTEX = 16;

type RGB = [number, number, number];

/** One gradient-filled instance, as the GPU samples it at its draw call. */
interface SampledShape {
    /** `a_gradRow` of the instance's vertices. */
    row: number;
    /** `a_color`: the flat fill, which WebGLDraw sets to the first stop. */
    firstStop: RGB;
    /** First and last texel of `row` in the bound atlas; null when the row is outside it. */
    texels: [RGB, RGB] | null;
}

interface ShapeDraw {
    /** Height of the ramp texture bound at this draw. */
    height: number;
    /** `u_rampRows` at this draw: what the shader divides the row by. */
    rampRows: number;
    shapes: SampledShape[];
}

/**
 * WebGL stub that keeps the ramp texture the way the GPU would: texImage2D
 * replaces it, texSubImage2D patches rows, and a size mismatch throws like
 * the GL error it would be. At every shape draw it reads each instance's row
 * and flat color from the uploaded vertices and looks the row up in the
 * texture as bound at that moment, so a row reused before its shapes were
 * drawn shows up as the wrong texels. Shader compile/link are stubbed:
 * unknown members return a fresh object.
 */
function makeAtlasGL(maxTextureSize: number) {
    let vertices = new Float32Array();
    let atlas = { height: 0, pixels: new Uint8Array() };
    let rampRows = 0;
    const draws: ShapeDraw[] = [];
    const uploads: Array<{ kind: "full" | "rows"; rows: number }> = [];

    const texel = (row: number, i: number): RGB => {
        const o = (row * RAMP_WIDTH + i) * 4;
        return [atlas.pixels[o], atlas.pixels[o + 1], atlas.pixels[o + 2]];
    };

    const overrides: Record<string, unknown> = {
        MAX_TEXTURE_SIZE,
        getExtension: () => null,
        getParameter: (name: number) => (name === MAX_TEXTURE_SIZE ? maxTextureSize : null),
        getUniformLocation: (_program: unknown, name: string) => ({ name }),
        uniform1f: (location: { name: string }, value: number) => {
            if (location.name === "u_rampRows") {
                rampRows = value;
            }
        },
        createTexture: () => ({}),
        bufferData: (_target: unknown, data: Float32Array) => {
            vertices = new Float32Array(data);
        },
        // Only the ramp atlas uses the 9-argument form here (no images are drawn):
        // target, level, internalFormat, width, height, border, format, type, pixels
        texImage2D: (...args: unknown[]) => {
            const [width, height, pixels] = [args[3] as number, args[4] as number, args[8] as Uint8Array];
            if (width !== RAMP_WIDTH || height > maxTextureSize || pixels.length !== width * height * 4) {
                throw new Error(`bad ramp upload ${width}x${height} with ${pixels.length} bytes`);
            }
            atlas = { height, pixels: new Uint8Array(pixels) };
            uploads.push({ kind: "full", rows: height });
        },
        texSubImage2D: (...args: unknown[]) => {
            const [x, y, width, height] = args.slice(2, 6) as number[];
            const pixels = args[8] as Uint8Array;
            if (x !== 0 || width !== RAMP_WIDTH || y + height > atlas.height || pixels.length !== width * height * 4) {
                throw new Error(`bad ramp sub-upload at row ${y}, ${height} rows`);
            }
            atlas.pixels.set(pixels, y * RAMP_WIDTH * 4);
            uploads.push({ kind: "rows", rows: height });
        },
        drawArrays: (_mode: number, first: number, count: number) => {
            if (vertices.length !== count * FLOATS_PER_SHAPE_VERTEX) {
                return; // not a shape batch
            }
            const shapes: SampledShape[] = [];
            for (let vertex = first; vertex < first + count; vertex += 6) {
                const o = vertex * FLOATS_PER_SHAPE_VERTEX;
                const row = vertices[o + 15];
                if (row < 0) {
                    continue; // solid fill
                }
                const firstStop = [0, 1, 2].map((c) => Math.round(vertices[o + 10 + c] * 255)) as RGB;
                const inside = Number.isInteger(row) && row < atlas.height;
                shapes.push({ row, firstStop, texels: inside ? [texel(row, 0), texel(row, RAMP_WIDTH - 1)] : null });
            }
            draws.push({ height: atlas.height, rampRows, shapes });
        },
    };

    const target: Record<string, unknown> = {};
    const gl = new Proxy(target, {
        get(_t, prop: string) {
            if (prop in overrides) {
                return overrides[prop];
            }
            return (target[prop] ??= () => ({}));
        },
    }) as unknown as WebGLRenderingContext;

    return { gl, draws, uploads };
}

function setup(maxTextureSize = 4096) {
    const fake = makeAtlasGL(maxTextureSize);
    const gl = new GLRenderer(fake.gl);
    gl.setSize(1000, 1000, 1000, 1000);
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<WebGLDrawContext>();
    const draw = new WebGLDraw(layers, transformer, camera);
    const config = { size: { width: 1000, height: 1000 }, scale: 10 } as never;
    const ctx = { save() {}, restore() {} } as unknown as CanvasRenderingContext2D;

    /** Paint every registration once, collecting what this pass drew and uploaded. */
    const paint = () => {
        const draws = fake.draws.length;
        const uploads = fake.uploads.length;
        layers.drawAll({ gl, ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
        return { draws: fake.draws.slice(draws), uploads: fake.uploads.slice(uploads) };
    };
    /** A frame the way RendererWebGL.render() runs one. */
    const frame = () => {
        gl.beginFrame();
        return paint();
    };
    return { draw, paint, frame };
}

const hex = (color: RGB) => `#${color.map((c) => c.toString(16).padStart(2, "0")).join("")}`;

/** Gradient `i`'s two stops: the first is unique per `i`, the last tells ramps apart further. */
const stopsOf = (i: number): [RGB, RGB] => [
    [i & 0xff, (i >> 8) & 0xff, 0x40],
    [0x80, 0xff - (i & 0xff), (i >> 8) & 0xff],
];

function gradient([first, last]: [RGB, RGB], from = { x: 0, y: 0 }, to = { x: 0, y: 1 }): LinearGradient {
    return {
        type: "linear",
        from,
        to,
        stops: [
            { offset: 0, color: hex(first) },
            { offset: 1, color: hex(last) },
        ],
    };
}

/** `count` fill-only rects on a 20-column grid, each with its own gradient (ids from `start`). */
function gradientRects(count: number, start = 0): Rect[] {
    return Array.from({ length: count }, (_, k) => ({
        x: k % 20,
        y: Math.floor(k / 20),
        style: { fillStyle: gradient(stopsOf(start + k)) },
    }));
}

/**
 * Every gradient shape must sample a row inside the bound texture, through a
 * u_rampRows that matches it, whose texels are the shape's own ramp.
 * `lastStop` maps a first stop to the last stop of the same gradient.
 */
function expectOwnRamps(draws: ShapeDraw[], lastStop: (first: RGB) => RGB) {
    for (const draw of draws) {
        expect(draw.rampRows).toBe(draw.height);
        for (const shape of draw.shapes) {
            expect(shape.row).toBeLessThan(draw.height);
            expect(shape.texels).toEqual([shape.firstStop, lastStop(shape.firstStop)]);
        }
    }
}

/** Last stop of the {@link stopsOf} gradient whose first stop is `first`. */
const lastStopOf = (first: RGB) => stopsOf(first[0] | (first[1] << 8))[1];

describe("WebGL gradient ramp atlas", () => {
    it("never reuses a row a queued shape still references (257 gradients, one fill-only batch)", () => {
        // A fresh renderer is at the start of its first frame. The atlas used
        // to restart at 256 rows mid-batch, so 256 of these sampled a row that
        // had since been overwritten or fell outside a one-row texture.
        const { draw, paint } = setup();
        draw.drawRect(gradientRects(257), 1);

        const { draws } = paint();

        expect(draws).toHaveLength(1);
        expect(draws[0].shapes).toHaveLength(257);
        expectOwnRamps(draws, lastStopOf);
        expect(new Set(draws[0].shapes.map((s) => s.row)).size).toBe(257);
    });

    it("shares a row between gradients that differ only by axis or color spelling", () => {
        const { draw, paint } = setup();
        const stops = [
            { offset: 0, color: "#f00" },
            { offset: 1, color: "#0000ff" },
        ];
        const respelled = [
            { offset: 0, color: "#ff0000" },
            { offset: 1, color: "rgb(0, 0, 255)" },
        ];
        draw.drawRect(
            [
                {
                    x: 0,
                    y: 0,
                    style: { fillStyle: { type: "linear", from: { x: 0, y: 0 }, to: { x: 0, y: 1 }, stops } },
                },
                {
                    x: 1,
                    y: 0,
                    style: { fillStyle: { type: "linear", from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, stops } },
                },
                {
                    x: 2,
                    y: 0,
                    style: {
                        fillStyle: { type: "linear", units: "world", from: { x: 0, y: 0 }, to: { x: 4, y: 4 }, stops },
                    },
                },
                {
                    x: 3,
                    y: 0,
                    style: {
                        fillStyle: { type: "linear", from: { x: 1, y: 1 }, to: { x: 0, y: 0 }, stops: respelled },
                    },
                },
            ],
            1,
        );

        const { draws, uploads } = paint();

        expect(draws[0].shapes.map((s) => s.row)).toEqual([0, 0, 0, 0]);
        expect(uploads).toEqual([{ kind: "full", rows: 1 }]);
        expect(draws[0].shapes[0].texels).toEqual([
            [255, 0, 0],
            [0, 0, 255],
        ]);
    });

    it("keeps a busy scene's rows across frames instead of re-uploading them", () => {
        const { draw, frame } = setup();
        draw.drawRect(gradientRects(300), 1);

        expectOwnRamps(frame().draws, lastStopOf);
        for (let i = 0; i < 3; i++) {
            const { draws, uploads } = frame();
            expectOwnRamps(draws, lastStopOf);
            expect(uploads).toEqual([]);
        }
    });

    it("drops rows only at a frame boundary, once the atlas outgrows what frames use", () => {
        const { draw, frame } = setup();
        const busy = draw.drawRect(gradientRects(300), 1);
        frame();

        // The next frame paints only ten of those gradients. Their rows are
        // still in the atlas from the frame before, so it uploads nothing.
        draw.removeDrawHandle(busy);
        draw.drawRect(gradientRects(10), 1);
        const quiet = frame();
        expectOwnRamps(quiet.draws, lastStopOf);
        expect(quiet.uploads).toEqual([]);

        // Now the atlas holds 300 rows for a scene that uses 10: it is rebuilt
        // at this frame's start, at the next power-of-two height.
        const rebuilt = frame();
        expectOwnRamps(rebuilt.draws, lastStopOf);
        expect(rebuilt.draws[0].shapes.map((s) => s.row)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
        expect(rebuilt.draws[0].height).toBe(16);
    });

    it("never mis-samples a batch while an animated gradient churns the atlas", () => {
        // A gradient with new stops every frame, painted after static ones in
        // the same fill-only batch: the old mid-batch reset hit every
        // (256 - static) frames and repainted the static shapes with it.
        const { draw, frame } = setup();
        const statics = gradientRects(20);
        const animated: Rect = { x: 0, y: 5, style: { fillStyle: "#000" } };
        let current = 0;
        const animatedStops = (n: number): [RGB, RGB] => [
            [n & 0xff, (n >> 8) & 0xff, 0xc0],
            [0x20, n & 0xff, 0xff],
        ];
        draw.drawRect([...statics, animated], 1, {
            styleOf: (item) => (item === animated ? { fillStyle: gradient(animatedStops(current)) } : undefined),
        });
        const lastStop = (first: RGB) => (first[2] === 0xc0 ? animatedStops(current)[1] : lastStopOf(first));

        let tallest = 0;
        for (current = 0; current < 600; current++) {
            const { draws } = frame();
            expect(draws).toHaveLength(1);
            expect(draws[0].shapes).toHaveLength(21);
            expectOwnRamps(draws, lastStop);
            tallest = Math.max(tallest, draws[0].height);
        }
        // Rows of past frames are dropped once over the soft cap, so the atlas stays bounded.
        expect(tallest).toBeLessThanOrEqual(512);
    });

    it.each(["rect", "circle"] as const)(
        "draws a %s batch's queued shapes before restarting an atlas at the texture size limit",
        (kind) => {
            // An 8-row limit stands in for MAX_TEXTURE_SIZE: 20 distinct
            // gradients cannot share one atlas, so the batch is split at each
            // restart and every part samples the rows it was built against.
            const { draw, paint } = setup(8);
            if (kind === "rect") {
                draw.drawRect(gradientRects(20), 1);
            } else {
                const circles: Circle[] = gradientRects(20).map(({ x, y, style }) => ({ x, y, style }));
                draw.drawCircle(circles, 1);
            }

            const { draws } = paint();

            expect(draws.map((d) => d.shapes.length)).toEqual([8, 8, 4]);
            expect(draws.map((d) => d.height)).toEqual([8, 8, 4]);
            expectOwnRamps(draws, lastStopOf);
        },
    );
});
