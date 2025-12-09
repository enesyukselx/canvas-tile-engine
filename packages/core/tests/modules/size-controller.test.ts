import { afterEach, describe, expect, it, vi } from "vitest";
import { SizeController } from "../../src/modules/SizeController";
import { Config } from "../../src/modules/Config";
import type { CanvasTileEngineConfig, Coords } from "../../src/types";
import type { ICamera } from "../../src/modules/Camera";
import type { IRenderer } from "../../src/modules/Renderer/Renderer";
import { ViewportState } from "../../src/modules/ViewportState";
import type { AnimationController } from "../../src/modules/AnimationController";

const baseConfig: CanvasTileEngineConfig = {
    renderer: "canvas",
    scale: 1,
    size: { width: 100, height: 80 },
};

const makeConfig = (overrides: Partial<CanvasTileEngineConfig> = {}): CanvasTileEngineConfig => ({
    ...baseConfig,
    ...overrides,
    size: { ...baseConfig.size, ...(overrides.size ?? {}) },
    eventHandlers: overrides.eventHandlers,
    bounds: overrides.bounds,
    coordinates: overrides.coordinates,
    cursor: overrides.cursor,
    debug: overrides.debug,
    backgroundColor: overrides.backgroundColor,
});

const createCamera = () => {
    const pan = vi.fn<(dx: number, dy: number) => void>();
    const zoom = vi.fn<(mouseX: number, mouseY: number, deltaY: number, rect: DOMRect) => void>();
    const getCenter = vi.fn<(w: number, h: number) => Coords>().mockReturnValue({ x: 0, y: 0 });
    const setCenter = vi.fn<(center: Coords, w: number, h: number) => void>();
    const adjustForResize = vi.fn<(dw: number, dh: number) => void>();
    const zoomByFactor = vi.fn<(factor: number, cx: number, cy: number) => void>();

    const camera: ICamera = {
        x: 0,
        y: 0,
        scale: 1,
        pan: (...args) => pan(...args),
        zoom: (...args) => zoom(...args),
        getCenter: (...args) => getCenter(...args),
        setCenter: (...args) => setCenter(...args),
        adjustForResize: (...args) => adjustForResize(...args),
        zoomByFactor: (...args) => zoomByFactor(...args),
    };

    return { camera, mocks: { pan, zoom, getCenter, setCenter, adjustForResize, zoomByFactor } };
};

const createRenderer = () => {
    const init = vi.fn<() => void>();
    const render = vi.fn<() => void>();
    const resize = vi.fn<(w: number, h: number) => void>();
    const destroy = vi.fn<() => void>();

    const renderer: IRenderer = {
        init: (...args) => init(...args),
        render: (...args) => render(...args),
        resize: (...args) => resize(...args),
        destroy: (...args) => destroy(...args),
    };

    return { renderer, mocks: { init, render, resize, destroy } };
};

describe("SizeController", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("skips animation when width or height is non-positive", () => {
        const config = new Config(makeConfig());
        const { camera } = createCamera();
        const { renderer, mocks: rendererMocks } = createRenderer();
        const viewport = new ViewportState(100, 80);
        const onSizeApplied = vi.fn();
        const animateResize = vi.fn();
        const controller = new SizeController(
            document.createElement("div"),
            document.createElement("canvas"),
            camera,
            renderer,
            viewport,
            config,
            onSizeApplied
        );

        controller.resizeWithAnimation(0, 50, 300, { animateResize } as unknown as AnimationController);
        controller.resizeWithAnimation(100, -10, 300, { animateResize } as unknown as AnimationController);

        expect(animateResize).not.toHaveBeenCalled();
        expect(onSizeApplied).not.toHaveBeenCalled();
        expect(rendererMocks.resize).not.toHaveBeenCalled();
    });

    it("clamps target size to config bounds before animating", () => {
        const config = new Config(
            makeConfig({
                size: { width: 200, height: 150, minWidth: 100, minHeight: 120, maxWidth: 250, maxHeight: 180 },
            })
        );
        const { camera } = createCamera();
        const { renderer } = createRenderer();
        const viewport = new ViewportState(100, 80);
        const onSizeApplied = vi.fn();
        const animateResize = vi.fn();
        const controller = new SizeController(
            document.createElement("div"),
            document.createElement("canvas"),
            camera,
            renderer,
            viewport,
            config,
            onSizeApplied
        );

        controller.resizeWithAnimation(50, 500, 200, { animateResize } as unknown as AnimationController);

        expect(animateResize).toHaveBeenCalledTimes(1);
        expect(animateResize).toHaveBeenCalledWith(100, 180, 200, expect.any(Function));
    });

    it("keeps provided sizes when config has no min/max limits", () => {
        const config = new Config(makeConfig());
        // Override config.get to simulate missing limits
        const originalSnapshot = config.get();
        vi.spyOn(config, "get").mockReturnValue({
            ...originalSnapshot,
            size: {
                ...originalSnapshot.size,
                minWidth: undefined as unknown as number,
                maxWidth: undefined as unknown as number,
                minHeight: undefined as unknown as number,
                maxHeight: undefined as unknown as number,
            },
        });

        const { camera } = createCamera();
        const { renderer } = createRenderer();
        const viewport = new ViewportState(100, 80);
        const onSizeApplied = vi.fn();
        const animateResize = vi.fn();
        const controller = new SizeController(
            document.createElement("div"),
            document.createElement("canvas"),
            camera,
            renderer,
            viewport,
            config,
            onSizeApplied
        );

        controller.resizeWithAnimation(120, 90, 150, { animateResize } as unknown as AnimationController);

        expect(animateResize).toHaveBeenCalledWith(120, 90, 150, expect.any(Function));
    });

    it("applies size with DPR scaling, rounding and callbacks", () => {
        const originalDprDescriptor = Object.getOwnPropertyDescriptor(window, "devicePixelRatio");
        Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });

        const config = new Config(makeConfig());
        const { camera, mocks: cameraMocks } = createCamera();
        const { renderer, mocks: rendererMocks } = createRenderer();
        const viewport = new ViewportState(120, 90);
        const onSizeApplied = vi.fn();
        const wrapper = document.createElement("div");
        const canvas = document.createElement("canvas");

        const controller = new SizeController(wrapper, canvas, camera, renderer, viewport, config, onSizeApplied);

        const center: Coords = { x: 10.2, y: 5.4 };
        const animateResize = vi.fn(
            (w: number, h: number, _duration: number, apply: (w: number, h: number, c: Coords) => void) => {
                apply(w + 0.6, h + 0.6, center);
            }
        );

        controller.resizeWithAnimation(150.6, 120.6, 0, { animateResize } as unknown as AnimationController);

        expect(viewport.getSize()).toEqual({ width: 151, height: 121 });
        expect(wrapper.style.width).toBe("151px");
        expect(wrapper.style.height).toBe("121px");
        expect(canvas.width).toBe(151 * 2);
        expect(canvas.height).toBe(121 * 2);
        expect(canvas.style.width).toBe("151px");
        expect(canvas.style.height).toBe("121px");
        expect(cameraMocks.setCenter).toHaveBeenCalledWith(center, 151, 121);
        expect(rendererMocks.resize).toHaveBeenCalledWith(151, 121);
        expect(onSizeApplied).toHaveBeenCalledTimes(1);

        if (originalDprDescriptor) {
            Object.defineProperty(window, "devicePixelRatio", originalDprDescriptor);
        } else {
            delete (window as unknown as Record<string, unknown>).devicePixelRatio;
        }
    });
});
