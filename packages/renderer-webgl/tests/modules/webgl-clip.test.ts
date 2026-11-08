import { describe, expect, it } from "vitest";
import { type Bounds, CoordinateTransformer, type ICamera } from "@canvas-tile-engine/core";
import { canvas2dClipAdapter } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { webglClipAdapter } from "../../src/RendererWebGL";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import { GLRenderer } from "../../src/modules/gl/GLRenderer";

const SCISSOR_TEST = 0x0c11;
const SIZE = 100;
const SCALE = 10;

const SORTED: Bounds = { minX: 1, maxX: 3, minY: 1, maxY: 2 };
// At scale 10 with the camera at the origin, SORTED is CSS rect (15, 15, 20, 10)
const SORTED_CSS = [15, 15, 20, 10];
// The scissor box is measured from the bottom: 100 - (15 + 10) = 75
const SORTED_SCISSOR = [15, 75, 20, 10];

/**
 * The real WebGLDraw, Layer and GLRenderer behind the WebGL clip adapter,
 * down to the GPU submissions: each drawArrays records the scissor box in
 * effect, and the overlay context records the path clip it was given.
 */
function setup() {
    let scissorOn = false;
    let box: number[] = [];
    const submissions: Array<number[] | null> = [];
    const overrides: Record<string, unknown> = {
        SCISSOR_TEST,
        getExtension: () => null,
        enable(cap: number) {
            if (cap === SCISSOR_TEST) {
                scissorOn = true;
            }
        },
        disable(cap: number) {
            if (cap === SCISSOR_TEST) {
                scissorOn = false;
            }
        },
        scissor(...args: number[]) {
            box = args;
        },
        drawArrays() {
            submissions.push(scissorOn ? box : null);
        },
    };
    const functions: Record<string, unknown> = {};
    const context = new Proxy(functions, {
        get(target, prop: string) {
            if (prop in overrides) {
                return overrides[prop];
            }
            return (target[prop] ??= () => ({}));
        },
    }) as unknown as WebGLRenderingContext;
    const gl = new GLRenderer(context);
    gl.setSize(SIZE, SIZE, SIZE, SIZE);

    const overlayClips: number[][] = [];
    const ctx = {
        save() {},
        restore() {},
        beginPath() {},
        rect: (...args: number[]) => void overlayClips.push(args),
        clip() {},
    } as unknown as CanvasRenderingContext2D;

    const camera = { x: 0, y: 0, scale: SCALE } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<WebGLDrawContext>(webglClipAdapter);
    const draw = new WebGLDraw(layers, transformer, camera);
    const config = { size: { width: SIZE, height: SIZE }, scale: SCALE } as never;
    const render = () => layers.drawAll({ gl, ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render, submissions, overlayClips, transformer };
}

/** The rectangle the Canvas2D renderers (browser and server) cut on. */
function canvas2dClip(clip: Bounds, transformer: CoordinateTransformer) {
    const rects: number[][] = [];
    const ctx = { beginPath() {}, rect: (...args: number[]) => void rects.push(args), clip() {} };
    canvas2dClipAdapter()({ ctx, transformer } as never, clip);
    return rects;
}

// Corners in any order. The engine sorts before a clip reaches the renderer;
// these cover a direct IDrawAPI caller, which the adapter must clip like
// Canvas2D: before, a negative extent clamped the scissor to 0x0, so batched
// primitives vanished while the overlay (normalised by ctx.rect) still painted.
describe.each([
    ["sorted", SORTED],
    ["inverted on both axes", { minX: 3, maxX: 1, minY: 2, maxY: 1 }],
    ["inverted on x", { minX: 3, maxX: 1, minY: 1, maxY: 2 }],
    ["inverted on y", { minX: 1, maxX: 3, minY: 2, maxY: 1 }],
])("WebGL clip adapter with a clip %s", (_order, clip) => {
    it("submits GL primitives under the sorted scissor box", () => {
        const { draw, render, submissions } = setup();
        draw.drawRect([{ x: 2, y: 1.5, size: 1, style: { fillStyle: "#f00" } }], 1, { clip });

        render();

        expect(submissions.length).toBeGreaterThan(0);
        for (const scissor of submissions) {
            expect(scissor).toEqual(SORTED_SCISSOR);
        }
    });

    it("clips the 2D overlay on the rectangle Canvas2D cuts", () => {
        const { draw, render, overlayClips, transformer } = setup();
        draw.addDrawFunction(() => {}, 1, { clip });

        render();

        expect(overlayClips).toEqual([SORTED_CSS]);
        expect(overlayClips).toEqual(canvas2dClip(clip, transformer));
    });
});
