import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasDebug } from "../../src/modules/CanvasDebug";
import { Config } from "../../src/modules/Config";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";
import { ViewportState } from "../../src/modules/ViewportState";
import type { ICamera } from "../../src/modules/Camera";
import type { CanvasTileEngineConfig } from "../../src/types";

const createMockCtx = () => {
    const fillRect = vi.fn();
    const fillText = vi.fn();
    const save = vi.fn();
    const restore = vi.fn();

    const ctx = {
        fillStyle: "",
        font: "",
        save,
        restore,
        fillRect,
        fillText,
    } as unknown as CanvasRenderingContext2D;

    return { ctx, fillRect, fillText, save, restore };
};

const baseConfigInput = {
    scale: 2,
    size: { width: 100, height: 50 },
};

const makeCamera = (x: number, y: number, scale: number, center: { x: number; y: number }): ICamera => ({
    x,
    y,
    scale,
    pan: () => {},
    zoom: () => {},
    getCenter: () => center,
    setCenter: () => {},
    adjustForResize: () => {},
    zoomByFactor: () => {},
});

const makeConfig = (debug: CanvasTileEngineConfig["debug"]) =>
    new Config({
        ...baseConfigInput,
        debug,
    });

describe("CanvasDebug", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("manages FPS loop lifecycle and callback", () => {
        const { ctx } = createMockCtx();
        const camera = makeCamera(0, 0, 1, { x: 0, y: 0 });
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 50);
        const config = makeConfig({ enabled: true, hud: { enabled: true } });

        const rafCallbacks: FrameRequestCallback[] = [];
        const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb) => {
            rafCallbacks.push(cb);
            return 1;
        });
        vi.spyOn(performance, "now")
            .mockReturnValueOnce(0) // startFpsLoop
            .mockReturnValueOnce(16) // first fpsLoop tick
            .mockReturnValueOnce(32); // second tick when callback runs

        const onFps = vi.fn();
        const debug = new CanvasDebug(ctx, camera, transformer, config, viewport);
        debug.setFpsUpdateCallback(onFps);
        debug.startFpsLoop();

        expect(rafSpy).toHaveBeenCalledTimes(1);
        expect(onFps).toHaveBeenCalledTimes(1);

        // run scheduled frame once
        rafCallbacks[0]?.(0);
        expect(onFps).toHaveBeenCalledTimes(1); // FPS unchanged on second tick
        expect(rafSpy).toHaveBeenCalledTimes(2); // scheduled next frame

        debug.stopFpsLoop();
        rafCallbacks[1]?.(0); // should early-return, no new scheduling
        expect(rafSpy).toHaveBeenCalledTimes(2);

        debug.destroy();
        expect((debug as unknown as { onFpsUpdate: unknown }).onFpsUpdate).toBeNull();
    });

    it("does not reschedule when FPS loop already running", () => {
        const { ctx } = createMockCtx();
        const camera = makeCamera(0, 0, 1, { x: 0, y: 0 });
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 50);
        const config = makeConfig({ enabled: true, hud: { enabled: true } });

        const rafSpy = vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
        vi.spyOn(performance, "now").mockReturnValue(0);

        const debug = new CanvasDebug(ctx, camera, transformer, config, viewport);
        debug.startFpsLoop();
        debug.startFpsLoop(); // should early-return

        expect(rafSpy).toHaveBeenCalledTimes(1);
    });

    it("skips drawing when HUD is disabled", () => {
        const { ctx, fillRect } = createMockCtx();
        const camera = makeCamera(1, 1, 1, { x: 0, y: 0 });
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 50);
        const config = makeConfig({ enabled: true, hud: { enabled: false } });

        const debug = new CanvasDebug(ctx, camera, transformer, config, viewport);
        debug.draw();

        expect(fillRect).not.toHaveBeenCalled();
    });

    it("renders HUD entries for enabled flags", () => {
        const { ctx, fillRect, fillText } = createMockCtx();
        const camera = makeCamera(0.5, 1.25, 2, { x: 10, y: 20 });
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 50);
        const config = makeConfig({
            enabled: true,
            hud: {
                enabled: true,
                topLeftCoordinates: true,
                coordinates: true,
                scale: true,
                tilesInView: true,
                fps: true,
            },
        });

        const debug = new CanvasDebug(ctx, camera, transformer, config, viewport);
        Reflect.set(debug as object, "currentFps", 60);
        debug.draw();

        expect(fillRect).toHaveBeenCalledTimes(1);
        expect(fillText).toHaveBeenCalledTimes(5);

        const messages = fillText.mock.calls.map(([text]) => text as string);
        expect(messages).toEqual([
            "TopLeft: 0.50, 1.25",
            "Coords: 10.00, 20.00",
            "Scale: 2.00",
            "Tiles in view: 50 x 25",
            "FPS: 60",
        ]);

        expect((ctx as unknown as { fillStyle: string }).fillStyle).toBe("#00ff99");
        expect((ctx as unknown as { font: string }).font).toBe("12px monospace");
    });

    it("draws HUD container even if no data rows enabled", () => {
        const { ctx, fillRect, fillText, save, restore } = createMockCtx();
        const camera = makeCamera(0, 0, 1, { x: 0, y: 0 });
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 50);
        const config = makeConfig({
            enabled: true,
            hud: {
                enabled: true,
                topLeftCoordinates: false,
                coordinates: false,
                scale: false,
                tilesInView: false,
                fps: false,
            },
        });

        const debug = new CanvasDebug(ctx, camera, transformer, config, viewport);
        debug.draw();

        expect(save).toHaveBeenCalledTimes(1);
        expect(fillRect).toHaveBeenCalledTimes(1);
        expect(fillText).not.toHaveBeenCalled();
        expect(restore).toHaveBeenCalledTimes(1);
    });

    it("trims FPS samples when exceeding buffer size", () => {
        const { ctx } = createMockCtx();
        const camera = makeCamera(0, 0, 1, { x: 0, y: 0 });
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 50);
        const config = makeConfig({ enabled: true, hud: { enabled: true } });

        const debug = new CanvasDebug(ctx, camera, transformer, config, viewport);
        Reflect.set(debug as object, "fpsLoopRunning", true);
        Reflect.set(debug as object, "lastFrameTime", 0);
        Reflect.set(debug as object, "frameTimes", new Array(11).fill(10));

        vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation(() => 1);
        vi.spyOn(performance, "now").mockReturnValue(16);

        const fpsLoop = (debug as unknown as { fpsLoop: () => void }).fpsLoop.bind(debug);
        fpsLoop();

        const frameTimes = Reflect.get(debug as object, "frameTimes") as number[];
        expect(frameTimes.length).toBe(11);
    });

    it("returns early when hud config is missing", () => {
        const { ctx, fillRect, fillText, save, restore } = createMockCtx();
        const camera = makeCamera(0, 0, 1, { x: 0, y: 0 });
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 50);
        const config = { get: () => ({ debug: { hud: undefined } }) } as unknown as Config;

        const debug = new CanvasDebug(ctx, camera, transformer, config, viewport);
        debug.draw();

        expect(fillRect).not.toHaveBeenCalled();
        expect(fillText).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
        expect(restore).not.toHaveBeenCalled();
    });
});
