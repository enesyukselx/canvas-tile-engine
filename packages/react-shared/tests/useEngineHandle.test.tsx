import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import type { CanvasTileEngine as CanvasTileEngineCore, Rect } from "@canvas-tile-engine/core";
import { useEngineHandle, type EngineHandleBase } from "../src";

type Engine = CanvasTileEngineCore<unknown, unknown>;
type Handle = EngineHandleBase<unknown, unknown, unknown>;

/** Minimal engine stand-in: just enough surface for the handle to forward to. */
function createFakeEngine() {
    const handle = { id: Symbol("handle"), layer: 1 };
    return {
        render: vi.fn(),
        drawRect: vi.fn(() => handle),
        getCenter: vi.fn(() => ({ x: 7, y: 8 })),
        getConfig: vi.fn(() => ({ scale: 3 })),
        images: { load: vi.fn(() => Promise.resolve("loaded-image")) },
    };
}

const asEngine = (fake: object) => fake as unknown as Engine;

const TILE: Rect = { x: 0, y: 0, size: 1, style: { fillStyle: "#000" } };

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("useEngineHandle", () => {
    it("no-ops with defaults before the engine mounts and warns on dropped draws", async () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { result } = renderHook(() => useEngineHandle<unknown, unknown, unknown>());
        const handle = result.current;

        expect(handle.isReady).toBe(false);
        expect(handle.instance).toBeNull();
        expect(handle.images).toBeUndefined();
        expect(handle.getCenter()).toEqual({ x: 0, y: 0 });
        expect(handle.getScale()).toBe(1);

        // The unified pre-mount behavior: a default snapshot, never undefined.
        const config = handle.getConfig();
        expect(config.scale).toBe(1);
        expect(config.size.width).toBe(0);
        expect(config.eventHandlers.drag).toBe(true);

        const dropped = handle.drawRect(TILE);
        expect(dropped.layer).toBe(-1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain("drawRect() was called before the engine mounted");

        await expect(handle.loadImage("a.png")).rejects.toThrow("Engine not ready");
    });

    it("forwards to the engine once attached", async () => {
        const fake = createFakeEngine();
        const { result } = renderHook(() => useEngineHandle<unknown, unknown, unknown>());

        act(() => result.current._setInstance(asEngine(fake)));

        expect(result.current.isReady).toBe(true);
        expect(result.current.instance).toBe(asEngine(fake));
        expect(result.current.images).toBe(fake.images);

        result.current.render();
        expect(fake.render).toHaveBeenCalledTimes(1);

        result.current.drawRect(TILE, 2);
        expect(fake.drawRect).toHaveBeenCalledWith(TILE, 2, undefined);

        expect(result.current.getCenter()).toEqual({ x: 7, y: 8 });
        expect(result.current.getConfig()).toEqual({ scale: 3 });

        await expect(result.current.loadImage("a.png", 2)).resolves.toBe("loaded-image");
        expect(fake.images.load).toHaveBeenCalledWith("a.png", 2);
    });

    it("returns to the not-ready state when the engine detaches", () => {
        const fake = createFakeEngine();
        const { result } = renderHook(() => useEngineHandle<unknown, unknown, unknown>());

        act(() => result.current._setInstance(asEngine(fake)));
        act(() => result.current._setInstance(null));

        expect(result.current.isReady).toBe(false);
        expect(result.current.instance).toBeNull();
        expect(result.current.getScale()).toBe(1);
    });

    it("keeps a single handle identity across re-renders", () => {
        const { result, rerender } = renderHook(() => useEngineHandle<unknown, unknown, unknown>());
        const first = result.current;
        rerender();
        expect(result.current).toBe(first);
    });

    it("re-runs consumer effects when the engine is swapped within one flush (remount counter)", () => {
        const seen: unknown[] = [];
        let captured: Handle | null = null;

        function Probe() {
            const engine = useEngineHandle<unknown, unknown, unknown>();
            captured = engine;
            useEffect(() => {
                seen.push(engine.instance);
            }, [engine, engine.instance]);
            return null;
        }

        render(<Probe />);
        expect(seen).toEqual([null]);

        const engineA = asEngine(createFakeEngine());
        const engineB = asEngine(createFakeEngine());

        act(() => captured!._setInstance(engineA));
        expect(seen).toEqual([null, engineA]);

        // A key-driven remount detaches the old engine and attaches the new
        // one inside a single flush. A boolean ready-state would collapse back
        // to its previous value and React would skip the re-render — the
        // effect below would never see engineB.
        act(() => {
            captured!._setInstance(null);
            captured!._setInstance(engineB);
        });
        expect(seen[seen.length - 1]).toBe(engineB);
    });

    it("merges buildExtras onto the handle and keeps getters live", () => {
        const { result } = renderHook(() =>
            useEngineHandle<unknown, unknown, unknown, { peek: () => Engine | null }>((instanceRef) => ({
                peek: () => instanceRef.current,
            })),
        );

        expect(result.current.peek()).toBeNull();

        const fake = asEngine(createFakeEngine());
        act(() => result.current._setInstance(fake));

        // The extras see the live instance through the ref they were given.
        expect(result.current.peek()).toBe(fake);
        // isReady/instance must still be live getters after the extras merge —
        // building the handle with a spread instead of Object.assign would
        // freeze them at their initial values and break this.
        expect(result.current.isReady).toBe(true);
        expect(result.current.instance).toBe(fake);
    });
});
