import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { Rect as RectType } from "@canvas-tile-engine/core";
import { CanvasTileEngine, useCanvasTileEngine, useEngineContext, type EngineHandle } from "../../src";
import { createFakeRenderer } from "../helpers/fakeRenderer";

const CONFIG = { scale: 10, size: { width: 100, height: 100 } };
const TILES: RectType[] = [{ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }];

/** Collects scheduled frames so tests control exactly when they fire. */
function stubRaf() {
    const frames: FrameRequestCallback[] = [];
    const raf = vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    const caf = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
    return { frames, raf, caf, fire: () => act(() => frames.splice(0).forEach((cb) => cb(0))) };
}

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("CanvasTileEngine mount component", () => {
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

        const instance = captured!.instance;
        expect(instance).not.toBeNull();

        // A new inline callback identity must not recreate the engine.
        rerender(<Harness onClick={second} />);
        expect(captured!.instance).toBe(instance);

        // The engine raises the event; the wrapper must dispatch to the
        // LATEST prop, passing the arguments through untouched.
        const coords = { raw: { x: 1, y: 2 }, snapped: { x: 1, y: 2 } };
        const mouse = { raw: { x: 10, y: 20 }, snapped: { x: 10, y: 20 } };
        const client = { raw: { x: 100, y: 200 }, snapped: { x: 100, y: 200 } };
        (instance!.onClick as unknown as (...args: unknown[]) => void)(coords, mouse, client);

        expect(second).toHaveBeenCalledWith(coords, mouse, client);
        expect(first).not.toHaveBeenCalled();
    });

    it("debounces requestRender: many children in one frame trigger one engine render", () => {
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

        // Mount renders once directly; the three children each requested a
        // repaint but only one frame may be scheduled.
        expect(fake.render).toHaveBeenCalledTimes(1);
        expect(raf).toHaveBeenCalledTimes(1);

        fire();
        expect(fake.render).toHaveBeenCalledTimes(2);
    });

    it("destroys the engine, detaches the handle, and cancels the pending frame on unmount", () => {
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
        expect(captured!.isReady).toBe(true);
        expect(frames).toHaveLength(1); // a repaint is pending, never fired

        unmount();

        expect(fake.destroy).toHaveBeenCalledTimes(1);
        expect(caf).toHaveBeenCalledTimes(1);
        expect(captured!.isReady).toBe(false);
        expect(captured!.instance).toBeNull();
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
        expect(seenEngine).toBe(captured);
    });

    it("forwards the web-only resize() through to the renderer", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;

        function Harness() {
            const engine = useCanvasTileEngine();
            captured = engine;
            return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} />;
        }

        render(<Harness />);
        const done = vi.fn();
        act(() => captured!.resize(200, 150, 0, done));

        // Core routes resize through the renderer's animated path.
        expect(fake.resizeWithAnimation).toHaveBeenCalledWith(200, 150, 0, done);
        expect(done).toHaveBeenCalledTimes(1);
    });
});
