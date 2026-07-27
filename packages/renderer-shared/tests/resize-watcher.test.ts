import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Config, ICamera, ViewportState } from "@canvas-tile-engine/core";
import { ResizeWatcher } from "../src/dom/ResizeWatcher";

class FakeResizeObserver {
    static instance?: FakeResizeObserver;

    constructor(private cb: ResizeObserverCallback) {
        FakeResizeObserver.instance = this;
    }

    observe() {}
    unobserve() {}
    disconnect = vi.fn();

    trigger(width: number, height: number) {
        const entry = { contentRect: { width, height } } as ResizeObserverEntry;
        this.cb([entry], this as unknown as ResizeObserver);
    }
}

function createFakeCanvas() {
    return { width: 0, height: 0, style: {} as Record<string, string> } as unknown as HTMLCanvasElement;
}

function createWatcher(options?: {
    canvasCount?: number;
    size?: {
        width: number;
        height: number;
        minWidth?: number;
        maxWidth?: number;
        minHeight?: number;
        maxHeight?: number;
    };
}) {
    const size = options?.size ?? { width: 1000, height: 800 };
    const config = new Config({ scale: 10, minScale: 1, maxScale: 40, size });
    const viewport = new ViewportState(size.width, size.height);
    const wrapper = { style: {} as Record<string, string> } as unknown as HTMLDivElement;
    const canvases = Array.from({ length: options?.canvasCount ?? 1 }, createFakeCanvas);
    const adjustForResize = vi.fn();
    const camera = { adjustForResize } as unknown as ICamera;
    const onCameraChange = vi.fn();
    const watcher = new ResizeWatcher(wrapper, canvases, viewport, camera, config, onCameraChange);
    return { watcher, wrapper, canvases, viewport, adjustForResize, onCameraChange };
}

describe("ResizeWatcher", () => {
    beforeEach(() => {
        vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        FakeResizeObserver.instance = undefined;
    });

    it("makes the wrapper user-resizable within the configured limits", () => {
        const { watcher, wrapper } = createWatcher({
            size: { width: 1000, height: 800, minWidth: 300, maxWidth: 1600, minHeight: 200, maxHeight: 1200 },
        });

        watcher.start();

        expect(wrapper.style.resize).toBe("both");
        expect(wrapper.style.width).toBe("1000px");
        expect(wrapper.style.height).toBe("800px");
        expect(wrapper.style.minWidth).toBe("300px");
        expect(wrapper.style.maxWidth).toBe("1600px");
        expect(wrapper.style.minHeight).toBe("200px");
        expect(wrapper.style.maxHeight).toBe("1200px");
    });

    it("clamps the initial size into the configured range", () => {
        const { watcher, wrapper } = createWatcher({
            size: { width: 1000, height: 800, maxWidth: 900, minHeight: 850 },
        });

        watcher.start();

        expect(wrapper.style.width).toBe("900px");
        expect(wrapper.style.height).toBe("850px");
    });

    it("propagates observed resizes to camera, viewport, every canvas, and callbacks", () => {
        const { watcher, wrapper, canvases, viewport, adjustForResize, onCameraChange } = createWatcher({
            canvasCount: 2,
        });
        const onResize = vi.fn();
        watcher.onResize = onResize;
        watcher.start();

        FakeResizeObserver.instance!.trigger(1200, 900);

        expect(adjustForResize).toHaveBeenCalledWith(200, 100);
        expect(viewport.getSize()).toEqual({ width: 1200, height: 900 });
        for (const canvas of canvases) {
            expect(canvas.width).toBe(1200);
            expect(canvas.height).toBe(900);
            expect(canvas.style.width).toBe("1200px");
            expect(canvas.style.height).toBe("900px");
        }
        expect(wrapper.style.width).toBe("1200px");
        expect(wrapper.style.height).toBe("900px");
        expect(onResize).toHaveBeenCalledTimes(1);
        expect(onCameraChange).toHaveBeenCalledTimes(1);
    });

    it("ignores resizes that clamp back to the current size", () => {
        const { watcher, adjustForResize, onCameraChange } = createWatcher({
            size: { width: 1000, height: 800, maxWidth: 1000, maxHeight: 800 },
        });
        watcher.start();

        FakeResizeObserver.instance!.trigger(1400, 900);

        expect(adjustForResize).not.toHaveBeenCalled();
        expect(onCameraChange).not.toHaveBeenCalled();
    });

    it("stop disconnects the observer", () => {
        const { watcher } = createWatcher();
        watcher.start();

        watcher.stop();

        expect(FakeResizeObserver.instance!.disconnect).toHaveBeenCalled();
    });

    describe("device pixel ratio changes", () => {
        function createFakeWindow(devicePixelRatio: number) {
            const listeners = new Map<string, () => void>();
            return {
                devicePixelRatio,
                addEventListener: (event: string, handler: () => void) => listeners.set(event, handler),
                removeEventListener: vi.fn((event: string) => listeners.delete(event)),
                fire: (event: string) => listeners.get(event)?.(),
            };
        }

        it("rescales canvas resolution when the DPR changes, keeping logical size", () => {
            const fakeWindow = createFakeWindow(1);
            vi.stubGlobal("window", fakeWindow);
            const { watcher, canvases, onCameraChange } = createWatcher();
            const onResize = vi.fn();
            watcher.onResize = onResize;
            watcher.start();

            fakeWindow.devicePixelRatio = 2;
            fakeWindow.fire("resize");

            expect(canvases[0]!.width).toBe(2000);
            expect(canvases[0]!.height).toBe(1600);
            expect(canvases[0]!.style.width).toBe("1000px");
            expect(canvases[0]!.style.height).toBe("800px");
            expect(onResize).toHaveBeenCalledTimes(1);
            expect(onCameraChange).toHaveBeenCalledTimes(1);
        });

        it("does nothing on window resizes that keep the DPR", () => {
            const fakeWindow = createFakeWindow(1);
            vi.stubGlobal("window", fakeWindow);
            const { watcher, onCameraChange } = createWatcher();
            watcher.start();

            fakeWindow.fire("resize");

            expect(onCameraChange).not.toHaveBeenCalled();
        });

        it("stop removes the window resize listener", () => {
            const fakeWindow = createFakeWindow(1);
            vi.stubGlobal("window", fakeWindow);
            const { watcher } = createWatcher();
            watcher.start();

            watcher.stop();

            expect(fakeWindow.removeEventListener).toHaveBeenCalledWith("resize", expect.any(Function));
        });
    });
});
