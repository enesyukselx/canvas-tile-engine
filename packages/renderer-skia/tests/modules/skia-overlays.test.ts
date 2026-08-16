import { describe, expect, it, vi } from "vitest";
import { Config, ViewportState, type CanvasTileEngineConfig, type ICamera } from "@canvas-tile-engine/core";
import type { SkCanvas } from "@shopify/react-native-skia";
import { SkiaDebug } from "../../src/modules/SkiaDebug";
import { SkiaCoordinateOverlayRenderer } from "../../src/modules/SkiaCoordinateOverlayRenderer";
import { makeRecordingCanvas } from "../mocks/react-native-skia";

interface Op {
    op: string;
    [key: string]: unknown;
}

function makeCanvas() {
    const { canvas, ops } = makeRecordingCanvas();
    return { canvas: canvas as unknown as SkCanvas, ops: ops as Op[] };
}

function setup(overrides: Partial<CanvasTileEngineConfig>, size = { width: 400, height: 300 }) {
    const camera = {
        x: 0,
        y: 0,
        scale: 10,
        getCenter: () => ({ x: 20, y: 15 }),
    } as unknown as ICamera;
    const config = new Config({ scale: 10, size, ...overrides });
    const viewport = new ViewportState(size.width, size.height);
    return { camera, config, viewport };
}

describe("SkiaDebug", () => {
    const hudConfig = {
        debug: { enabled: true, hud: { enabled: true, scale: true, fps: true } },
    } satisfies Partial<CanvasTileEngineConfig>;

    it("paints the panel and lines below the status bar", () => {
        const { camera, config, viewport } = setup(hudConfig);
        const { canvas, ops } = makeCanvas();

        new SkiaDebug(camera, config, viewport).draw(canvas);

        // Panel is right-aligned (400 - 160 - 8) and pushed down by the 50px
        // top offset the React Native canvas needs to clear the notch.
        expect(ops[0]).toMatchObject({
            op: "rect",
            rect: { x: 232, y: 50 + 4, width: 160, height: 2 * 16 + 8 },
        });
        expect(ops.slice(1)).toMatchObject([
            { op: "text", text: "Scale: 10.00", x: 237, y: 50 + 18 },
            { op: "text", text: "FPS: 0", x: 237, y: 50 + 18 + 16 },
        ]);
    });

    it("paints nothing when the HUD is disabled", () => {
        const { camera, config, viewport } = setup({ debug: { enabled: true, hud: { enabled: false, fps: true } } });
        const { canvas, ops } = makeCanvas();

        new SkiaDebug(camera, config, viewport).draw(canvas);

        expect(ops).toEqual([]);
    });

    it("drives the shared FPS sampler and stops it on destroy", () => {
        const frames: Array<() => void> = [];
        vi.stubGlobal("requestAnimationFrame", (cb: () => void) => frames.push(cb));

        const { camera, config, viewport } = setup(hudConfig);
        const debug = new SkiaDebug(camera, config, viewport);

        debug.startFpsLoop();
        expect(frames).toHaveLength(1);

        debug.destroy();
        frames.pop()!();
        expect(frames).toHaveLength(0);

        vi.unstubAllGlobals();
    });
});

describe("SkiaCoordinateOverlayRenderer", () => {
    const coordsConfig = {
        coordinates: { enabled: true, shownScaleRange: { min: 5, max: 20 } },
    } satisfies Partial<CanvasTileEngineConfig>;

    it("gates on the configured scale range", () => {
        const { camera, config, viewport } = setup(coordsConfig);
        const overlay = new SkiaCoordinateOverlayRenderer(camera, config, viewport);

        expect(overlay.shouldDraw(4)).toBe(false);
        expect(overlay.shouldDraw(10)).toBe(true);
        expect(overlay.shouldDraw(21)).toBe(false);
    });

    it("draws both gutters and one label per visible row and column", () => {
        const { camera, config, viewport } = setup(coordsConfig, { width: 100, height: 100 });
        const { canvas, ops } = makeCanvas();

        new SkiaCoordinateOverlayRenderer(camera, config, viewport).draw(canvas);

        expect(ops[0]).toMatchObject({ op: "rect", rect: { x: 0, y: 0, width: 20, height: 100 } });
        expect(ops[1]).toMatchObject({ op: "rect", rect: { x: 20, y: 80, width: 100, height: 20 } });

        // 100px at scale 10 is 10 cells per axis, labelled one past the edge.
        const labels = ops.slice(2);
        expect(labels).toHaveLength(24);
        expect(labels.every((op) => op.op === "text")).toBe(true);
    });

    it("centers each label on its coordinate", () => {
        const { camera, config, viewport } = setup(coordsConfig, { width: 100, height: 100 });
        const { canvas, ops } = makeCanvas();

        new SkiaCoordinateOverlayRenderer(camera, config, viewport).draw(canvas);

        // Row 0 sits at (10, 5); the mock font measures 6px per character and
        // reports ascent -8 / descent 2, so centering shifts it to (7, 8).
        expect(ops[2]).toMatchObject({ op: "text", text: "0", x: 7, y: 8, fontSize: 8 });
    });
});
