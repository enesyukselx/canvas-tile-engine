import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import type { CanvasTileEngineConfig, IRenderer, RendererDependencies } from "@canvas-tile-engine/core";
import { ResponsiveWatcher } from "../src/dom/ResponsiveWatcher";

class FakeResizeObserver {
    static instance: FakeResizeObserver | undefined;

    constructor(private callback: ResizeObserverCallback) {
        FakeResizeObserver.instance = this;
    }

    observe() {}
    unobserve() {}
    disconnect() {}

    trigger(width: number, height: number) {
        this.callback([{ contentRect: { width, height } } as ResizeObserverEntry], this as unknown as ResizeObserver);
    }
}

const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 80 };
const engines: CanvasTileEngine[] = [];

/** Only rendering and DOM measurement are stubbed: the engine, camera, config and watcher are real. */
function mount(
    responsive: CanvasTileEngineConfig["responsive"],
    width = 1000,
    height = 800,
    bounded = false,
    scale = 10,
) {
    const wrapper = {
        style: {},
        getBoundingClientRect: () => ({ width, height }),
    } as HTMLDivElement;
    const canvas = { width: 0, height: 0, style: {} } as HTMLCanvasElement;
    let dependencies: RendererDependencies;
    let watcher: ResponsiveWatcher;
    const renderer: IRenderer = {
        init(deps) {
            dependencies = deps;
            watcher = new ResponsiveWatcher(wrapper, [canvas], deps.camera, deps.viewport, deps.config, () => {
                renderer.onCameraChange?.();
            });
            watcher.onResize = () => renderer.onResize?.();
            watcher.onScaleChange = (scale) => renderer.onZoom?.(scale);
        },
        setupEvents: () => watcher.start(),
        destroy: () => watcher.stop(),
        render: vi.fn(),
        resize: vi.fn(),
        resizeWithAnimation: vi.fn(),
        getDrawAPI: vi.fn(),
        getImageLoader: vi.fn(),
    };
    const engine = new CanvasTileEngine(
        wrapper,
        {
            scale,
            minScale: scale,
            maxScale: 40,
            size: { width: 1000, height: 800 },
            responsive,
            ...(bounded ? { bounds } : {}),
        },
        renderer,
    );
    engines.push(engine);
    return {
        engine,
        config: dependencies!.config,
        resize: (w: number, h: number) => FakeResizeObserver.instance!.trigger(w, h),
    };
}

/** Assert the public range is also the range actually enforced by the real camera. */
function expectLimits(engine: CanvasTileEngine, min: number, max: number) {
    const snapshot = engine.getConfig();
    const scale = engine.getScale();
    expect(snapshot.minScale).toBeCloseTo(min);
    expect(snapshot.maxScale).toBeCloseTo(max);
    expect(snapshot.scale).toBe(scale);
    engine.setScale(0.001);
    expect(engine.getScale()).toBeCloseTo(snapshot.minScale);
    engine.setScale(1e6);
    expect(engine.getScale()).toBeCloseTo(snapshot.maxScale);
    engine.setScale(scale);
}

describe("responsive getConfig live limits", () => {
    beforeEach(() => vi.stubGlobal("ResizeObserver", FakeResizeObserver));
    afterEach(() => {
        for (const engine of engines.splice(0)) {
            engine.destroy();
        }
        FakeResizeObserver.instance = undefined;
        vi.unstubAllGlobals();
    });

    it("reports both live limits after repeated preserve-viewport resizes without changing the authored baseline", () => {
        const { engine, config, resize } = mount("preserve-viewport");
        const authored = config.get();
        const initial = engine.getConfig();
        const onResize = vi.fn(() =>
            expectLimits(engine, engine.getSize().width / 100, Math.max(40, engine.getSize().width / 100)),
        );
        engine.onResize = onResize;

        for (const width of [600, 300, 4800, 600, 1000, 4800, 1000]) {
            resize(width, width * 0.8);
            expectLimits(engine, width / 100, Math.max(40, width / 100));
            expect(config.get()).toBe(authored);
        }
        expect(onResize).toHaveBeenCalledTimes(7);
        expect(initial).toMatchObject({ scale: 10, minScale: 10, maxScale: 40, size: { width: 1000, height: 800 } });
    });

    it("reports the adapted limits immediately after mounting into a narrower wrapper", () => {
        const { engine } = mount("preserve-viewport", 600, 0);
        expectLimits(engine, 6, 40);
        expect(engine.getConfig().size).toEqual({ width: 600, height: 480 });
    });

    it("keeps limits usable through a hidden mount and subsequent observer recovery", () => {
        const { engine, resize } = mount("preserve-viewport", 0, 0);
        expectLimits(engine, 10, 40);
        resize(600, 0);
        expectLimits(engine, 6, 40);
        resize(0, 0);
        expectLimits(engine, 6, 40);
    });

    it("uses runtime limits as the new authored baseline on subsequent preserve-viewport resizes", () => {
        const { engine, config, resize } = mount("preserve-viewport", 600, 480);
        const before = engine.getConfig();
        engine.setScaleLimits(2, 20);
        expectLimits(engine, 2, 20);
        const authored = config.get();
        expect(authored).toMatchObject({ scale: 10, minScale: 2, maxScale: 20, size: { width: 1000, height: 800 } });

        for (const width of [300, 4800, 1000, 600, 1000]) {
            resize(width, width * 0.8);
            expectLimits(engine, (width / 100) * 0.2, Math.max(20, width / 100));
            expect(config.get()).toBe(authored);
        }
        expect(before).toMatchObject({ scale: 6, minScale: 6, maxScale: 40 });
    });

    it("keeps the live range ordered when a runtime minimum exceeds the original base scale", () => {
        const { engine, resize } = mount("preserve-viewport");
        engine.setScaleLimits(20, 30);
        expectLimits(engine, 20, 30);
        resize(4800, 3840);
        expectLimits(engine, 96, 96);
        resize(1000, 800);
        expectLimits(engine, 20, 30);
    });

    it("does not overflow an intermediate scale ratio for large finite runtime limits", () => {
        const { engine, resize } = mount("preserve-viewport", 1000, 800, false, 0.1);
        engine.setScaleLimits(1e308, 1e308);
        resize(600, 480);
        expect(engine.getConfig()).toMatchObject({ minScale: 6e307, maxScale: 1e308 });
        engine.setScale(Number.MIN_VALUE);
        expect(engine.getScale()).toBe(6e307);
        engine.setScale(Number.MAX_VALUE);
        expect(engine.getScale()).toBe(1e308);
    });

    it.each(["preserve-scale", "fill"] as const)(
        "reports bounded %s limits without accumulating resize ratios",
        (mode) => {
            const { engine, config, resize } = mount(mode, 1000, 800, true);
            const authored = config.get();
            for (const [width, height, minimum] of [
                [600, 800, 6],
                [300, 800, 3],
                [1000, 800, 10],
                [600, 800, 6],
            ]) {
                resize(width, height);
                expectLimits(engine, minimum, 40);
                expect(config.get()).toBe(authored);
            }
        },
    );

    it("includes the height-driven fill minimum at mount and after repeated resizes", () => {
        const { engine, resize } = mount("fill", 1000, 400, true);
        expectLimits(engine, 5, 40);
        for (const [height, minimum] of [
            [200, 2.5],
            [800, 10],
            [400, 5],
        ]) {
            resize(1000, height);
            expectLimits(engine, minimum, 40);
        }
    });

    it.each(["preserve-scale", "fill"] as const)(
        "keeps unbounded %s limits and reflects runtime replacements",
        (mode) => {
            const { engine, resize } = mount(mode, 600, 800);
            expectLimits(engine, 10, 40);
            engine.setScaleLimits(2, 20);
            expectLimits(engine, 2, 20);
            resize(300, 800);
            expectLimits(engine, 2, 20);
            resize(1000, 800);
            expectLimits(engine, 2, 20);
        },
    );

    it.each(["preserve-scale", "fill"] as const)(
        "reflects %s limits derived from runtime bounds and limit updates",
        (mode) => {
            const { engine, config, resize } = mount(mode);
            engine.setBounds(bounds);
            engine.setScaleLimits(4, 20);
            expectLimits(engine, 4, 20);
            resize(600, 800);
            expectLimits(engine, 2.4, 20);
            const horizontal = { ...bounds, minY: -Infinity, maxY: Infinity };
            engine.setBounds(horizontal);
            resize(300, 800);
            expectLimits(engine, 1.2, 20);
            resize(1000, 800);
            expectLimits(engine, 4, 20);
            expect(config.get()).toMatchObject({ minScale: 4, maxScale: 20, bounds: horizontal });
        },
    );

    it("leaves live limits intact after an invalid runtime update", () => {
        const { engine, config } = mount("preserve-viewport", 600, 480);
        const authored = config.get();
        expect(() => engine.setScaleLimits(40, 2)).toThrow();
        expect(config.get()).toBe(authored);
        expectLimits(engine, 6, 40);
    });

    it("keeps non-responsive snapshots consistent after runtime updates", () => {
        const { engine } = mount(false);
        expectLimits(engine, 10, 40);
        engine.setScaleLimits(2, 20);
        expectLimits(engine, 2, 20);
    });
});
