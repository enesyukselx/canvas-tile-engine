import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { WebGLDraw } from "../../src/modules/WebGLDraw";
import { Layer } from "../../src/modules/Layer";
import type { GLRenderer, ImageInstance } from "../../src/modules/gl/GLRenderer";

// Fake GL renderer that records every ImageInstance passed to drawImages.
function makeRecordingGL() {
    const drawn: ImageInstance[] = [];
    const gl = {
        getTexture: () => ({}) as WebGLTexture,
        drawImages(items: ImageInstance[]) {
            drawn.push(...items);
        },
    } as unknown as GLRenderer;
    return { gl, drawn };
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

const fakeImage = { width: 10, height: 10 } as HTMLImageElement;

// Image opacity contract shared by all renderers: alpha = opacity ?? 1.
// Mirrors the fixture values in the canvas, skia, and server suites.
describe("WebGLDraw image opacity", () => {
    it("passes item opacity as the instance alpha", () => {
        const { draw, render } = setup();
        const { gl, drawn } = makeRecordingGL();

        draw.drawImage([
            { x: 1, y: 1, img: fakeImage, opacity: 0.5 },
            { x: 3, y: 3, img: fakeImage },
            { x: 5, y: 5, img: fakeImage, sprite: { x: 0, y: 0, w: 5, h: 5 }, opacity: 0.25 },
        ]);
        render(gl);

        expect(drawn.map((i) => i.alpha)).toEqual([0.5, 1, 0.25]);
    });
});
