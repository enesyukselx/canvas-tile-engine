import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { Config, ICamera, ViewportState } from "@canvas-tile-engine/core";
import { ResponsiveWatcher } from "../../src/modules/ResponsiveWatcher";

/**
 * Minimal camera with real scale/limit clamping semantics (mirrors core Camera,
 * which is covered by core tests) so watcher behavior can be observed.
 */
function createFakeCamera(scale: number, minScale: number, maxScale: number) {
    const state = { x: 0, y: 0, scale, minScale, maxScale };
    const camera = {
        get x() {
            return state.x;
        },
        get y() {
            return state.y;
        },
        get scale() {
            return state.scale;
        },
        pan: () => {},
        zoom: () => {},
        zoomByFactor: () => {},
        setScale: (next: number) => {
            state.scale = Math.min(state.maxScale, Math.max(state.minScale, next));
        },
        setScaleLimits: (min: number, max: number) => {
            state.minScale = min;
            state.maxScale = max;
            state.scale = Math.min(max, Math.max(min, state.scale));
        },
        getCenter: (w: number, h: number) => ({
            x: state.x + w / (2 * state.scale) - 0.5,
            y: state.y + h / (2 * state.scale) - 0.5,
        }),
        setCenter: (center: { x: number; y: number }, w: number, h: number) => {
            state.x = center.x - w / (2 * state.scale) + 0.5;
            state.y = center.y - h / (2 * state.scale) + 0.5;
        },
        adjustForResize: () => {},
        getVisibleBounds: () => ({ minX: 0, maxX: 0, minY: 0, maxY: 0 }),
    } as unknown as ICamera;
    return { camera, state };
}

class FakeResizeObserver {
    static instance?: FakeResizeObserver;

    constructor(private cb: ResizeObserverCallback) {
        FakeResizeObserver.instance = this;
    }

    observe() {}
    unobserve() {}
    disconnect() {}

    trigger(width: number, height: number) {
        const entry = { contentRect: { width, height } } as ResizeObserverEntry;
        this.cb([entry], this as unknown as ResizeObserver);
    }
}

function createWrapper(width: number, height: number): HTMLDivElement {
    return {
        style: {},
        getBoundingClientRect: () => ({ width, height }),
    } as unknown as HTMLDivElement;
}

function createCanvas(): HTMLCanvasElement {
    return { width: 0, height: 0, style: {} } as unknown as HTMLCanvasElement;
}

function createWatcher(options: {
    responsive: "preserve-scale" | "preserve-viewport";
    wrapperWidth: number;
    wrapperHeight: number;
    minScale: number;
    maxScale: number;
    bounds?: { minX: number; maxX: number; minY: number; maxY: number };
}) {
    const config = new Config({
        scale: 10,
        minScale: options.minScale,
        maxScale: options.maxScale,
        size: { width: 1000, height: 800 },
        responsive: options.responsive,
        bounds: options.bounds,
    });
    const { camera, state } = createFakeCamera(10, options.minScale, options.maxScale);
    const viewport = new ViewportState(1000, 800);
    const wrapper = createWrapper(options.wrapperWidth, options.wrapperHeight);
    const watcher = new ResponsiveWatcher(wrapper, createCanvas(), camera, viewport, config, () => {});
    return { watcher, state, viewport, wrapper };
}

describe("ResponsiveWatcher scale limits", () => {
    beforeEach(() => {
        vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        FakeResizeObserver.instance = undefined;
    });

    describe("preserve-viewport", () => {
        it("rescales limits with the base scale in a narrow container", () => {
            // 100x80 visible tiles; minScale equals the base scale (gridToSize-style board)
            const { watcher, state } = createWatcher({
                responsive: "preserve-viewport",
                wrapperWidth: 600,
                wrapperHeight: 480,
                minScale: 10,
                maxScale: 40,
            });
            watcher.start();

            // Base scale follows the container instead of being clamped to minScale
            expect(state.scale).toBe(6);
            // Limits keep their configured zoom-factor meaning (1x..4x of base)
            expect(state.minScale).toBe(6);
            expect(state.maxScale).toBe(24);
        });

        it("rescales limits upward in a wide container", () => {
            const { watcher, state } = createWatcher({
                responsive: "preserve-viewport",
                wrapperWidth: 1200,
                wrapperHeight: 960,
                minScale: 10,
                maxScale: 40,
            });
            watcher.start();

            expect(state.scale).toBe(12);
            expect(state.minScale).toBe(12);
            expect(state.maxScale).toBe(48);
        });

        it("keeps the base scale reachable after resize events", () => {
            const { watcher, state } = createWatcher({
                responsive: "preserve-viewport",
                wrapperWidth: 1000,
                wrapperHeight: 800,
                minScale: 10,
                maxScale: 40,
            });
            watcher.start();
            expect(state.scale).toBe(10);

            FakeResizeObserver.instance!.trigger(600, 480);

            expect(state.scale).toBe(6);
            expect(state.minScale).toBe(6);
            expect(state.maxScale).toBe(24);
        });

        it("does not force CSS min/max width on the wrapper", () => {
            const { watcher, wrapper } = createWatcher({
                responsive: "preserve-viewport",
                wrapperWidth: 600,
                wrapperHeight: 480,
                minScale: 10,
                maxScale: 40,
            });
            watcher.start();

            expect(wrapper.style.minWidth).toBeUndefined();
            expect(wrapper.style.maxWidth).toBeUndefined();
            expect(wrapper.style.width).toBe("100%");
        });
    });

    describe("preserve-scale", () => {
        it("keeps configured limits when bounds are unbounded", () => {
            const { watcher, state } = createWatcher({
                responsive: "preserve-scale",
                wrapperWidth: 600,
                wrapperHeight: 800,
                minScale: 10,
                maxScale: 40,
            });
            watcher.start();

            expect(state.scale).toBe(10);
            expect(state.minScale).toBe(10);
            expect(state.maxScale).toBe(40);
        });

        it("lowers the min limit with the fit scale of bounded content", () => {
            // Bounds span 100 world units; they fit the configured 1000px width
            // at scale 10 (= minScale), so at 600px the fit scale becomes 6
            const { watcher, state } = createWatcher({
                responsive: "preserve-scale",
                wrapperWidth: 600,
                wrapperHeight: 800,
                minScale: 10,
                maxScale: 40,
                bounds: { minX: 0, maxX: 100, minY: 0, maxY: 80 },
            });
            watcher.start();

            expect(state.scale).toBe(10);
            expect(state.minScale).toBe(6);
            expect(state.maxScale).toBe(40);
        });

        it("never raises the min limit above the current scale", () => {
            const { watcher, state } = createWatcher({
                responsive: "preserve-scale",
                wrapperWidth: 1200,
                wrapperHeight: 800,
                minScale: 10,
                maxScale: 40,
                bounds: { minX: 0, maxX: 100, minY: -Infinity, maxY: Infinity },
            });
            watcher.start();

            // Fit scale grew to 12 but the camera sits at 10; the limit must
            // never strand the current scale outside the allowed range
            expect(state.scale).toBe(10);
            expect(state.minScale).toBe(10);
        });

        it("adapts the min limit again on resize events", () => {
            const { watcher, state } = createWatcher({
                responsive: "preserve-scale",
                wrapperWidth: 1000,
                wrapperHeight: 800,
                minScale: 10,
                maxScale: 40,
                bounds: { minX: 0, maxX: 100, minY: 0, maxY: 80 },
            });
            watcher.start();
            expect(state.minScale).toBe(10);

            FakeResizeObserver.instance!.trigger(500, 800);

            expect(state.minScale).toBe(5);
            expect(state.scale).toBe(10);
        });
    });
});
