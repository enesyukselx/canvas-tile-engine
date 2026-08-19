import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { CanvasTileEngineConfig, Rect as RectType } from "@canvas-tile-engine/core";
import { CanvasTileEngine } from "../../src/components/CanvasTileEngine";
import { useCanvasTileEngine, type EngineHandle } from "../../src/hooks/useCanvasTileEngine";
import { useEngineContext } from "../../src/context";
import { createFakeRenderer } from "../helpers/fakeRenderer";
import {
    emitLayout,
    emitReduceMotionChanged,
    reduceMotionListenerCount,
    resetReactNativeMock,
    setReduceMotionEnabled,
    viewProps,
} from "../mocks/react-native";
import { canvasProps, createdPictures, presentedPictures, resetSkiaMock } from "../mocks/react-native-skia";
import { resetGestureMock } from "../mocks/react-native-gesture-handler";

// `size` is a placeholder on this platform: the component measures its View
// and overrides it on the first layout.
const CONFIG: CanvasTileEngineConfig = { scale: 10, size: { width: 0, height: 0 } };
const TILES: RectType[] = [{ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }];

/** Collects scheduled frames so tests control exactly when they fire. */
function stubRaf() {
    const frames: Array<(time: number) => void> = [];
    const raf = vi.fn((cb: (time: number) => void) => {
        frames.push(cb);
        return frames.length;
    });
    const caf = vi.fn();
    vi.stubGlobal("requestAnimationFrame", raf);
    vi.stubGlobal("cancelAnimationFrame", caf);
    return { frames, raf, caf, fire: () => act(() => frames.splice(0).forEach((cb) => cb(0))) };
}

afterEach(() => {
    cleanup();
    resetReactNativeMock();
    resetSkiaMock();
    resetGestureMock();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("CanvasTileEngine mount component (React Native)", () => {
    it("creates no engine and mounts no children before the first layout", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;
        const childRendered = vi.fn();

        function Probe() {
            childRendered();
            return null;
        }

        function Harness() {
            const engine = useCanvasTileEngine();
            captured = engine;
            return (
                <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer}>
                    <Probe />
                </CanvasTileEngine>
            );
        }

        render(<Harness />);

        expect(captured!.isReady).toBe(false);
        expect(captured!.instance).toBeNull();
        expect(childRendered).not.toHaveBeenCalled();
        expect(fake.render).not.toHaveBeenCalled();
        // No Skia canvas is mounted until there is a measured size.
        expect(canvasProps).toHaveLength(0);

        // The documented pre-mount contract: a default config snapshot, never
        // undefined (same shape the web hook returns).
        const config = captured!.getConfig();
        expect(config.size).toEqual({
            width: 0,
            height: 0,
            minWidth: 100,
            minHeight: 100,
            maxWidth: Infinity,
            maxHeight: Infinity,
        });
        expect(config.scale).toBe(1);
        expect(config.eventHandlers.drag).toBe(true);
        expect(captured!.getScale()).toBe(1);
        expect(captured!.getCenter()).toEqual({ x: 0, y: 0 });
    });

    it("creates the engine sized to the measured layout, rounding fractional dp", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;

        function Harness() {
            const engine = useCanvasTileEngine();
            captured = engine;
            return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} />;
        }

        render(<Harness />);
        act(() => emitLayout(320.4, 240.6));

        expect(captured!.isReady).toBe(true);
        expect(captured!.getSize()).toEqual({ width: 320, height: 241 });
        // The config prop's scale survives the size override.
        expect(captured!.getConfig().scale).toBe(10);
        // The mount contract reports the same measured size and the platform DPR.
        expect(fake.getMountSize()).toEqual({ width: 320, height: 241 });
        expect(fake.getMountDpr()).toBe(3);
        expect(fake.render).toHaveBeenCalledTimes(1);
    });

    it("ignores a zero-size layout", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;

        function Harness() {
            const engine = useCanvasTileEngine();
            captured = engine;
            return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} />;
        }

        render(<Harness />);
        act(() => emitLayout(0, 0));

        expect(captured!.isReady).toBe(false);
        expect(fake.render).not.toHaveBeenCalled();
    });

    it("resizes the existing engine on a later layout instead of recreating it", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;

        function Harness() {
            const engine = useCanvasTileEngine();
            captured = engine;
            return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} />;
        }

        render(<Harness />);
        act(() => emitLayout(300, 200));
        const instance = captured!.instance;

        act(() => emitLayout(400, 200));

        expect(captured!.instance).toBe(instance);
        // Instant resize (0ms) — a rotation must not animate.
        expect(fake.resizeWithAnimation).toHaveBeenCalledWith(400, 200, 0, undefined);
        expect(captured!.getSize()).toEqual({ width: 400, height: 200 });

        // An identical layout pass is a no-op.
        act(() => emitLayout(400, 200));
        expect(fake.resizeWithAnimation).toHaveBeenCalledTimes(1);
    });

    it("presents frames as Skia pictures sized to the measured layout", () => {
        const fake = createFakeRenderer();

        function Harness() {
            const engine = useCanvasTileEngine();
            return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} />;
        }

        render(<Harness />);
        act(() => emitLayout(300, 200));

        // present() recorded the renderer's frame painter into a picture...
        expect(createdPictures).toHaveLength(1);
        expect(createdPictures[0].size).toEqual({ width: 300, height: 200 });
        expect(fake.paintFrame).toHaveBeenCalledTimes(1);
        // ...and that picture is what <Picture> renders inside <Canvas>.
        expect(presentedPictures[presentedPictures.length - 1]).toBe(createdPictures[0]);
        expect(canvasProps[canvasProps.length - 1].style).toEqual({ width: 300, height: 200 });
        // The canvas must never intercept touches; the wrapper owns gestures.
        expect(canvasProps[canvasProps.length - 1].pointerEvents).toBe("none");
    });

    it("mounts children only after its own engine exists and debounces their renders", () => {
        const fake = createFakeRenderer();
        const { raf, fire } = stubRaf();

        function Harness() {
            const engine = useCanvasTileEngine();
            return (
                <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer}>
                    <CanvasTileEngine.Rect items={TILES} layer={1} />
                    <CanvasTileEngine.Rect items={TILES} layer={2} />
                    <CanvasTileEngine.Rect items={TILES} layer={3} />
                </CanvasTileEngine>
            );
        }

        render(<Harness />);
        expect(fake.drawRectCalls).toHaveLength(0);

        act(() => emitLayout(300, 200));

        // All three children registered against the engine created above.
        expect(fake.drawRectCalls).toHaveLength(3);
        // Mount rendered once directly; the three children requested a repaint
        // but only one frame may be scheduled.
        expect(fake.render).toHaveBeenCalledTimes(1);
        expect(raf).toHaveBeenCalledTimes(1);

        fire();
        expect(fake.render).toHaveBeenCalledTimes(2);
    });

    it("keeps callbacks current without recreating the engine", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;

        function Harness({ onClick }: { onClick: () => void }) {
            const engine = useCanvasTileEngine();
            captured = engine;
            return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} onClick={onClick} />;
        }

        const first = vi.fn();
        const second = vi.fn();
        const { rerender } = render(<Harness onClick={first} />);
        act(() => emitLayout(300, 200));

        const instance = captured!.instance;
        expect(instance).not.toBeNull();

        rerender(<Harness onClick={second} />);
        expect(captured!.instance).toBe(instance);

        const coords = { raw: { x: 1, y: 2 }, snapped: { x: 1, y: 2 } };
        const mouse = { raw: { x: 10, y: 20 }, snapped: { x: 10, y: 20 } };
        const client = { raw: { x: 100, y: 200 }, snapped: { x: 100, y: 200 } };
        (instance!.onClick as unknown as (...args: unknown[]) => void)(coords, mouse, client);

        expect(second).toHaveBeenCalledWith(coords, mouse, client);
        expect(first).not.toHaveBeenCalled();
    });

    it("exposes the engine handle to children through useEngineContext", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;
        let seenEngine: EngineHandle | null = null;

        function Probe() {
            const { engine, requestRender } = useEngineContext();
            seenEngine = engine;
            expect(typeof requestRender).toBe("function");
            return null;
        }

        function Harness() {
            const engine = useCanvasTileEngine();
            captured = engine;
            return (
                <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer}>
                    <Probe />
                </CanvasTileEngine>
            );
        }

        render(<Harness />);
        act(() => emitLayout(300, 200));

        expect(seenEngine).toBe(captured);
    });

    it("destroys the engine, detaches the handle and cancels the pending frame on unmount", () => {
        const fake = createFakeRenderer();
        const { frames, caf } = stubRaf();
        let captured: EngineHandle | null = null;

        function Harness() {
            const engine = useCanvasTileEngine();
            captured = engine;
            return (
                <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer}>
                    <CanvasTileEngine.Rect items={TILES} layer={1} />
                </CanvasTileEngine>
            );
        }

        const { unmount } = render(<Harness />);
        act(() => emitLayout(300, 200));

        expect(captured!.isReady).toBe(true);
        expect(frames).toHaveLength(1); // a repaint is pending, never fired

        unmount();

        expect(fake.destroy).toHaveBeenCalledTimes(1);
        expect(caf).toHaveBeenCalledTimes(1);
        expect(captured!.isReady).toBe(false);
        expect(captured!.instance).toBeNull();
    });

    it("stretches the wrapper View and merges the caller's style", () => {
        const fake = createFakeRenderer();

        function Harness() {
            const engine = useCanvasTileEngine();
            return (
                <CanvasTileEngine
                    engine={engine}
                    config={CONFIG}
                    renderer={fake.renderer}
                    style={{ borderRadius: 12 }}
                />
            );
        }

        render(<Harness />);

        expect(viewProps[viewProps.length - 1].style).toEqual([{ flex: 1, overflow: "hidden" }, { borderRadius: 12 }]);
    });

    describe("reduced motion", () => {
        function mount() {
            const fake = createFakeRenderer();
            let captured: EngineHandle | null = null;

            function Harness() {
                const engine = useCanvasTileEngine();
                captured = engine;
                return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} />;
            }

            const utils = render(<Harness />);
            return {
                fake,
                get engine() {
                    return captured!;
                },
                ...utils,
            };
        }

        // The signal is async and the engine is created lazily on first
        // layout, so the value that resolved first has to be replayed into it.
        it("replays a signal that arrived before the engine existed", async () => {
            setReduceMotionEnabled(true);
            const { engine } = mount();
            await act(async () => {});

            act(() => emitLayout(300, 200));

            expect(engine.getReducedMotion()).toBe(true);
        });

        it("tracks a change after mount", async () => {
            const { engine } = mount();
            await act(async () => {});
            act(() => emitLayout(300, 200));

            expect(engine.getReducedMotion()).toBe(false);

            act(() => emitReduceMotionChanged(true));
            expect(engine.getReducedMotion()).toBe(true);

            act(() => emitReduceMotionChanged(false));
            expect(engine.getReducedMotion()).toBe(false);
        });

        it("lets an explicit app preference outrank the platform", async () => {
            setReduceMotionEnabled(true);
            const { engine } = mount();
            await act(async () => {});
            act(() => emitLayout(300, 200));

            act(() => engine.setReducedMotion(false));

            expect(engine.getReducedMotion()).toBe(false);
            act(() => emitReduceMotionChanged(true));
            expect(engine.getReducedMotion()).toBe(false);
        });

        it("unsubscribes on unmount", async () => {
            const { unmount } = mount();
            await act(async () => {});

            expect(reduceMotionListenerCount()).toBe(1);

            unmount();

            expect(reduceMotionListenerCount()).toBe(0);
        });
    });

    describe("accessibility surface", () => {
        it("names the measured View, never the Skia canvas", () => {
            const fake = createFakeRenderer();

            function Harness() {
                const engine = useCanvasTileEngine();
                return (
                    <CanvasTileEngine
                        engine={engine}
                        config={{
                            ...CONFIG,
                            accessibility: { label: "Venue map", description: "Drag to pan", role: "image" },
                        }}
                        renderer={fake.renderer}
                    />
                );
            }

            render(<Harness />);
            act(() => emitLayout(300, 200));

            const view = viewProps[viewProps.length - 1];
            expect(view.accessible).toBe(true);
            expect(view.accessibilityLabel).toBe("Venue map");
            expect(view.accessibilityHint).toBe("Drag to pan");
            expect(view.accessibilityRole).toBe("image");
            // Nothing accessible is passed to the Skia canvas — its props type
            // carries no such field, so tsc is what enforces that here.
        });

        it("stays unannounced when no label is configured", () => {
            const fake = createFakeRenderer();

            function Harness() {
                const engine = useCanvasTileEngine();
                return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} />;
            }

            render(<Harness />);

            const view = viewProps[viewProps.length - 1];
            expect(view.accessible).toBeUndefined();
            expect(view.accessibilityLabel).toBeUndefined();
        });

        it("drops a role React Native has no equivalent for", () => {
            const fake = createFakeRenderer();

            function Harness() {
                const engine = useCanvasTileEngine();
                return (
                    <CanvasTileEngine
                        engine={engine}
                        config={{ ...CONFIG, accessibility: { label: "Board", role: "region" } }}
                        renderer={fake.renderer}
                    />
                );
            }

            render(<Harness />);

            // "region" and "application" have no RN accessibilityRole; the
            // label still lands, which is what actually gets announced.
            expect(viewProps[viewProps.length - 1].accessibilityRole).toBeUndefined();
            expect(viewProps[viewProps.length - 1].accessibilityLabel).toBe("Board");
        });
    });
});
