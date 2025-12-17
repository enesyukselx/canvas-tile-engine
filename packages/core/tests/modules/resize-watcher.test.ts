import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResizeWatcher } from "../../src/modules/EventManager/ResizeWatcher";
import { ViewportState } from "../../src/modules/ViewportState";
import type { Config } from "../../src/modules/Config";
import type { Camera } from "../../src/modules/Camera";

class MockResizeObserver {
    private cb: ResizeObserverCallback;
    observe = vi.fn();
    unobserve = vi.fn();
    disconnect = vi.fn();

    constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
    }

    trigger(entry: ResizeObserverEntry) {
        this.cb([entry], this as unknown as ResizeObserver);
    }
}

const makeConfig = (overrides: Partial<ReturnType<Config["get"]>["size"]> = {}) =>
    ({
        get: () => ({
            size: {
                width: 120,
                height: 80,
                minWidth: 50,
                minHeight: 60,
                maxWidth: 100,
                maxHeight: 90,
                ...overrides,
            },
        }),
    } as unknown as Config);

const makeCamera = () => {
    const adjustForResize = vi.fn();
    return { camera: { adjustForResize } as unknown as Camera, adjustForResize };
};

const makeCanvas = () => document.createElement("canvas");
const makeWrapper = () => document.createElement("div");

describe("ResizeWatcher", () => {
    const originalResizeObserver = globalThis.ResizeObserver;
    const originalDpr = globalThis.window?.devicePixelRatio;

    beforeEach(() => {
        globalThis.ResizeObserver = MockResizeObserver;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        globalThis.ResizeObserver = originalResizeObserver;
        if (originalDpr !== undefined) {
            Object.defineProperty(window, "devicePixelRatio", { value: originalDpr, configurable: true });
        }
    });

    it("applies initial clamp and styles on start", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const viewport = new ViewportState(150, 70);
        const config = makeConfig();
        const { camera } = makeCamera();
        const watcher = new ResizeWatcher(wrapper, canvas, viewport, camera, config, vi.fn());

        watcher.start();

        expect(wrapper.style.width).toBe("100px"); // clamped to maxWidth
        expect(wrapper.style.height).toBe("70px"); // from viewport height
        expect(wrapper.style.minWidth).toBe("50px");
        expect(wrapper.style.maxWidth).toBe("100px");
        expect(wrapper.style.minHeight).toBe("60px");
        expect(wrapper.style.maxHeight).toBe("90px");
        expect(wrapper.style.resize).toBe("both");
    });

    it("leaves min/max styles empty when limits are undefined", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const viewport = new ViewportState(90, 70);
        const config = makeConfig({ minWidth: undefined, minHeight: undefined, maxWidth: undefined, maxHeight: undefined });
        const { camera } = makeCamera();
        const watcher = new ResizeWatcher(wrapper, canvas, viewport, camera, config, vi.fn());

        watcher.start();

        expect(wrapper.style.maxWidth).toBe("");
        expect(wrapper.style.minWidth).toBe("");
        expect(wrapper.style.maxHeight).toBe("");
        expect(wrapper.style.minHeight).toBe("");
    });

    it("handles resize entries, clamps, updates canvas/viewport, triggers callbacks", () => {
        Object.defineProperty(window, "devicePixelRatio", { value: 2, configurable: true });
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const viewport = new ViewportState(100, 80);
        const config = makeConfig();
        const { camera, adjustForResize } = makeCamera();
        const onCameraChange = vi.fn();
        const watcher = new ResizeWatcher(wrapper, canvas, viewport, camera, config, onCameraChange);
        const onResize = vi.fn();
        watcher.onResize = onResize;

        watcher.start();
        const ro = (watcher as unknown as { resizeObserver: MockResizeObserver }).resizeObserver;
        ro.trigger({
            target: wrapper,
            contentRect: { width: 150, height: 50 } as DOMRectReadOnly,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
        } as unknown as ResizeObserverEntry);

        expect(adjustForResize).toHaveBeenCalledWith(0, -20); // (100->100, 80->60)
        expect(viewport.getSize()).toEqual({ width: 100, height: 60 });
        expect(canvas.width).toBe(200); // dpr 2
        expect(canvas.height).toBe(120);
        expect(canvas.style.width).toBe("100px");
        expect(canvas.style.height).toBe("60px");
        expect(wrapper.style.width).toBe("100px");
        expect(wrapper.style.height).toBe("60px");
        expect(onResize).toHaveBeenCalled();
        expect(onCameraChange).toHaveBeenCalled();
    });

    it("triggers resize without onResize callback", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const viewport = new ViewportState(100, 80);
        const config = makeConfig();
        const { camera, adjustForResize } = makeCamera();
        const onCameraChange = vi.fn();
        const watcher = new ResizeWatcher(wrapper, canvas, viewport, camera, config, onCameraChange);

        watcher.start();
        const ro = (watcher as unknown as { resizeObserver: MockResizeObserver }).resizeObserver;
        ro.trigger({
            target: wrapper,
            contentRect: { width: 120, height: 100 } as DOMRectReadOnly,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
        } as unknown as ResizeObserverEntry);

        expect(adjustForResize).toHaveBeenCalled();
        expect(onCameraChange).toHaveBeenCalled();
    });

    it("skips when resize results in same clamped size", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const viewport = new ViewportState(100, 80);
        const config = makeConfig();
        const { camera, adjustForResize } = makeCamera();
        const onCameraChange = vi.fn();
        const watcher = new ResizeWatcher(wrapper, canvas, viewport, camera, config, onCameraChange);
        watcher.onResize = vi.fn();

        watcher.start();
        const ro = (watcher as unknown as { resizeObserver: MockResizeObserver }).resizeObserver;
        ro.trigger({
            target: wrapper,
            contentRect: { width: 100, height: 80 } as DOMRectReadOnly,
            borderBoxSize: [],
            contentBoxSize: [],
            devicePixelContentBoxSize: [],
        } as unknown as ResizeObserverEntry);

        expect(adjustForResize).not.toHaveBeenCalled();
        expect(onCameraChange).not.toHaveBeenCalled();
        expect(watcher.onResize).not.toHaveBeenCalled();
    });

    it("stop detaches observer safely even if not started", () => {
        const wrapper = makeWrapper();
        const canvas = makeCanvas();
        const viewport = new ViewportState(100, 80);
        const config = makeConfig();
        const { camera } = makeCamera();
        const watcher = new ResizeWatcher(wrapper, canvas, viewport, camera, config, vi.fn());

        // stop before start: no throw
        watcher.stop();

        watcher.start();
        const ro = (watcher as unknown as { resizeObserver: MockResizeObserver }).resizeObserver;
        watcher.stop();
        expect(ro.unobserve).toHaveBeenCalledWith(wrapper);
        expect(ro.disconnect).toHaveBeenCalled();
    });
});
