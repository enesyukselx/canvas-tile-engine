import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { EventManager } from "../../src/modules/EventManager";
import { Camera } from "../../src/modules/Camera";
import { Config } from "../../src/modules/Config";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";
import { ViewportState } from "../../src/modules/ViewportState";
import type { ICamera } from "../../src/modules/Camera";
import type { CanvasTileEngineConfig } from "../../src/types";
import { ResizeWatcher } from "../../src/modules/EventManager/ResizeWatcher";
import { EventBinder } from "../../src/modules/EventManager/EventBinder";

class MockResizeObserver {
    private cb: ResizeObserverCallback;
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
    }
}

const baseConfig: CanvasTileEngineConfig = {
    renderer: "canvas",
    scale: 1,
    size: { width: 100, height: 80 },
};

const makeConfig = (overrides: Partial<CanvasTileEngineConfig> = {}) =>
    new Config({
        ...baseConfig,
        ...overrides,
        size: { ...baseConfig.size, ...(overrides.size ?? {}) },
        eventHandlers: overrides.eventHandlers,
        bounds: overrides.bounds,
        coordinates: overrides.coordinates,
        cursor: overrides.cursor,
        debug: overrides.debug,
        backgroundColor: overrides.backgroundColor,
    } as CanvasTileEngineConfig);

const makeCanvas = () => document.createElement("canvas");
const makeWrapper = () => document.createElement("div");

describe("EventManager", () => {
    const originalResizeObserver = globalThis.ResizeObserver;

    beforeEach(() => {
        globalThis.ResizeObserver = MockResizeObserver;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        globalThis.ResizeObserver = originalResizeObserver;
    });

    it("attaches once and starts resize watcher when enabled", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const camera = new Camera({ x: 0, y: 0 }, 1);
        const viewport = new ViewportState(100, 80);
        const config = makeConfig({ eventHandlers: { click: true, resize: true } });
        const transformer = new CoordinateTransformer(camera);
        const onCameraChange = vi.fn();
        const onResize = vi.fn();

        const attachSpy = vi.spyOn(EventBinder.prototype, "attach");
        const detachSpy = vi.spyOn(EventBinder.prototype, "detach");
        const resizeStart = vi.spyOn(ResizeWatcher.prototype, "start");
        const resizeStop = vi.spyOn(ResizeWatcher.prototype, "stop");

        const manager = new EventManager(wrapper, canvas, camera, viewport, config, transformer, onCameraChange);
        manager.onResize = onResize;

        manager.setupEvents();
        manager.setupEvents(); // second call is no-op

        expect(attachSpy).toHaveBeenCalledTimes(1);
        expect(resizeStart).toHaveBeenCalledTimes(1);

        // simulate resize watcher calling its onResize callback
        const watcher = (manager as unknown as { resizeWatcher?: ResizeWatcher }).resizeWatcher!;
        watcher.onResize?.();
        expect(onResize).toHaveBeenCalledTimes(1);

        manager.destroy();
        expect(detachSpy).toHaveBeenCalledTimes(1);
        expect(resizeStop).toHaveBeenCalledTimes(1);
    });

    it("skips resize watcher when camera is not a Camera instance or resize disabled", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const mockCamera: ICamera = {
            x: 0,
            y: 0,
            scale: 1,
            pan: vi.fn(),
            zoom: vi.fn(),
            getCenter: vi.fn(),
            setCenter: vi.fn(),
            adjustForResize: vi.fn(),
            zoomByFactor: vi.fn(),
        };
        const viewport = new ViewportState(100, 80);
        const config = makeConfig({ eventHandlers: { resize: false } });
        const transformer = new CoordinateTransformer(mockCamera);
        const onCameraChange = vi.fn();

        const resizeStart = vi.spyOn(ResizeWatcher.prototype, "start");

        const manager = new EventManager(wrapper, canvas, mockCamera, viewport, config, transformer, onCameraChange);
        manager.setupEvents();

        expect(resizeStart).not.toHaveBeenCalled();
    });

    it("proxies gesture callbacks via getters/setters", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const camera = new Camera({ x: 0, y: 0 }, 1);
        const viewport = new ViewportState(100, 80);
        const config = makeConfig();
        const transformer = new CoordinateTransformer(camera);
        const manager = new EventManager(wrapper, canvas, camera, viewport, config, transformer, vi.fn());

        const click = vi.fn();
        const hover = vi.fn();
        const md = vi.fn();
        const mu = vi.fn();
        const ml = vi.fn();

        manager.onClick = click;
        manager.onHover = hover;
        manager.onMouseDown = md;
        manager.onMouseUp = mu;
        manager.onMouseLeave = ml;

        expect(manager.onClick).toBe(click);
        expect(manager.onHover).toBe(hover);
        expect(manager.onMouseDown).toBe(md);
        expect(manager.onMouseUp).toBe(mu);
        expect(manager.onMouseLeave).toBe(ml);
    });

    it("destroy is a no-op when not attached", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const camera = new Camera({ x: 0, y: 0 }, 1);
        const viewport = new ViewportState(100, 80);
        const config = makeConfig();
        const transformer = new CoordinateTransformer(camera);
        const manager = new EventManager(wrapper, canvas, camera, viewport, config, transformer, vi.fn());

        const detachSpy = vi.spyOn(EventBinder.prototype, "detach");
        const stopSpy = vi.spyOn(ResizeWatcher.prototype, "stop");

        manager.destroy();

        expect(detachSpy).not.toHaveBeenCalled();
        expect(stopSpy).not.toHaveBeenCalled();
    });

    it("resizeWatcher onResize wrapper is safe when callback is undefined", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const camera = new Camera({ x: 0, y: 0 }, 1);
        const viewport = new ViewportState(100, 80);
        const config = makeConfig({ eventHandlers: { resize: true } });
        const transformer = new CoordinateTransformer(camera);
        const manager = new EventManager(wrapper, canvas, camera, viewport, config, transformer, vi.fn());

        manager.setupEvents();
        const watcher = (manager as unknown as { resizeWatcher?: ResizeWatcher }).resizeWatcher!;

        expect(() => watcher.onResize && watcher.onResize()).not.toThrow();
    });
});
