import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import type { SkCanvas, SkImage } from "@shopify/react-native-skia";
import { RendererSkia } from "../src/RendererSkia";
import type { SkiaMount } from "../src/types";
import { makeRecordingCanvas, pictureRecorders, type MockOp } from "./mocks/react-native-skia";

const SIZE = { width: 100, height: 100 };
const LAYER_FILL = "#ff0000";

/**
 * Mount the renderer through the real engine. The fake host paints every
 * presented frame onto a fresh op-recording canvas, as the React Native
 * binding does with `createPicture`.
 */
function setup(overrides: Partial<CanvasTileEngineConfig> = {}) {
    const frames: MockOp[][] = [];
    const mount: SkiaMount = {
        getSize: () => SIZE,
        getDpr: () => 1,
        present(paint) {
            const { canvas, ops } = makeRecordingCanvas();
            paint(canvas as unknown as SkCanvas);
            frames.push(ops);
        },
    };
    const engine = new CanvasTileEngine<SkiaMount, SkImage>(
        mount,
        { scale: 10, size: SIZE, backgroundColor: "#000000", ...overrides },
        new RendererSkia(),
    );
    engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: LAYER_FILL } }, 1);
    return { engine, frames };
}

const layerRect = expect.objectContaining({ op: "rect", color: { parsed: LAYER_FILL } });
const isLayerRect = (op: MockOp) =>
    op.op === "rect" && (op.color as { parsed?: string } | undefined)?.parsed === LAYER_FILL;

beforeEach(() => {
    pictureRecorders.length = 0;
});

describe("RendererSkia frame presentation", () => {
    it("paints the scene straight onto the presented canvas when the FPS loop is off", () => {
        const { engine, frames } = setup();

        engine.render();

        expect(pictureRecorders).toHaveLength(0);
        expect(frames).toHaveLength(1);
        expect(frames[0].some((op) => op.op === "picture")).toBe(false);
        expect(frames[0][0]).toMatchObject({ op: "rect", color: { parsed: "#000000" } });
        expect(frames[0]).toContainEqual(layerRect);
    });

    it("still paints the HUD above the directly painted scene", () => {
        const { engine, frames } = setup({ debug: { enabled: true, hud: { enabled: true, scale: true } } });

        engine.render();

        expect(pictureRecorders).toHaveLength(0);
        const ops = frames[0];
        const layer = ops.findIndex(isLayerRect);
        const hud = ops.findIndex((op) => op.op === "text" && op.text === "Scale: 10.00");
        expect(layer).toBeGreaterThan(0);
        expect(hud).toBeGreaterThan(layer);
    });

    describe("with the FPS loop running", () => {
        const frameQueue = new Map<number, () => void>();
        let now = 0;

        beforeEach(() => {
            frameQueue.clear();
            now = 0;
            let nextHandle = 1;
            vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
                const handle = nextHandle++;
                frameQueue.set(handle, cb);
                return handle;
            });
            vi.stubGlobal("cancelAnimationFrame", (handle: number) => frameQueue.delete(handle));
            vi.spyOn(performance, "now").mockImplementation(() => now);
        });

        afterEach(() => {
            vi.unstubAllGlobals();
            vi.restoreAllMocks();
        });

        /** Run the queued sampler frame `ms` after the previous one. */
        function fpsTick(ms = 16) {
            now += ms;
            const [[handle, cb]] = frameQueue;
            frameQueue.delete(handle);
            cb();
        }

        it("records the scene once per render and replays it on FPS ticks", () => {
            const { engine, frames } = setup({ debug: { enabled: true, hud: { fps: true } } });

            engine.render();

            expect(pictureRecorders).toHaveLength(1);
            expect(frames).toHaveLength(1);
            const scene = frames[0].find((op) => op.op === "picture")?.picture as { ops: MockOp[] } | undefined;
            expect(scene?.ops).toContainEqual(layerRect);

            fpsTick();

            expect(frames).toHaveLength(2);
            expect(pictureRecorders).toHaveLength(1);
            expect(frames[1].find((op) => op.op === "picture")?.picture).toBe(scene);

            // A new render invalidates the cache and records afresh.
            engine.render();
            expect(pictureRecorders).toHaveLength(2);
        });

        it("draws a fresh HUD on top of the replayed scene", () => {
            const { engine, frames } = setup({ debug: { enabled: true, hud: { enabled: true, fps: true } } });

            engine.render();
            fpsTick();

            const ops = frames[1];
            expect(ops[0].op).toBe("picture");
            expect(ops.slice(1)).toMatchObject([
                { op: "rect" },
                // 1000 / 16ms, rounded.
                { op: "text", text: "FPS: 63" },
            ]);
        });

        it("stops the FPS loop on destroy", () => {
            const { engine } = setup({ debug: { enabled: true, hud: { fps: true } } });
            expect(frameQueue.size).toBe(1);

            engine.destroy();

            expect(frameQueue.size).toBe(0);
        });
    });
});
