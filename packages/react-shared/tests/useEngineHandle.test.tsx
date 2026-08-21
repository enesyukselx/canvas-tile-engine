import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { Config } from "@canvas-tile-engine/core";
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
        expect(config.eventHandlers.drag).toBe(false);

        const dropped = handle.drawRect(TILE);
        expect(dropped.layer).toBe(-1);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain("drawRect() was called before the engine mounted");

        await expect(handle.loadImage("a.png")).rejects.toThrow("Engine not ready");
    });

    it("reports the engine's own defaults before mount, deeply frozen", () => {
        const { result } = renderHook(() => useEngineHandle<unknown, unknown, unknown>());
        const snapshot = result.current.getConfig();

        // Every field but the placeholder size has to match what the engine
        // itself resolves for an unconfigured engine: a pre-mount reader must
        // not see a value that flips the moment the engine attaches. The size
        // is the only difference — 0x0, matching the pre-mount getSize(),
        // where the engine requires a positive one.
        const engineDefaults = new Config({ scale: 1, size: { width: 800, height: 600 } }).get();
        expect({ ...snapshot, size: engineDefaults.size }).toEqual(engineDefaults);
        expect(snapshot.eventHandlers.zoom).toBe(false);
        expect(snapshot.minScale).toBe(0.5);
        expect(snapshot.maxScale).toBe(2);
        expect(snapshot.debug.eventHandlers?.drag).toBe(true);

        // Shared by every pre-mount call, so it is frozen like the snapshots
        // Config.get() returns: one consumer mutating it cannot corrupt the
        // next reader.
        expect(Object.isFrozen(snapshot)).toBe(true);
        expect(Object.isFrozen(snapshot.eventHandlers)).toBe(true);
        expect(() => {
            (snapshot as { minScale: number }).minScale = 99;
        }).toThrow();
        expect(result.current.getConfig().minScale).toBe(0.5);
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

    // Mechanical forwarding matrix: every handle method must call the engine
    // method OF THE SAME NAME with the same arguments. Each row builds an
    // engine exposing only that one method, so forwarding to the wrong method
    // (the classic copy-paste slip in this boilerplate) throws instead of
    // silently hitting a sibling mock.
    const noop = () => {};
    const FORWARDED: Array<[string, unknown[]]> = [
        ["render", []],
        ["getCenter", []],
        ["getVisibleBounds", []],
        ["setCenter", [{ x: 1, y: 2 }]],
        ["goCenter", [3, 4, 250, noop]],
        ["getSize", []],
        ["getScale", []],
        ["setScale", [2]],
        ["goScale", [1.5, 100, noop]],
        ["zoomIn", [1.2]],
        ["zoomOut", [1.3]],
        ["setScaleLimits", [0.5, 8]],
        ["setReducedMotion", ["auto"]],
        ["getReducedMotion", []],
        ["getConfig", []],
        ["setBounds", [{ minX: 0, maxX: 9, minY: 0, maxY: 9 }]],
        ["fitBounds", [{ minX: 0, maxX: 4, minY: 0, maxY: 4 }, {}]],
        ["setEventHandlers", [{ click: true }]],
        ["addDrawFunction", [noop, 3]],
        ["drawRect", [[TILE], 2, {}]],
        ["drawStaticRect", [[TILE], "cache", 2, {}]],
        ["drawCircle", [[{ x: 1, y: 1 }], 2, {}]],
        ["drawStaticCircle", [[{ x: 1, y: 1 }], "cache", 2, {}]],
        ["drawLine", [[{ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }], { lineWidth: 1 }, 2, {}]],
        ["drawText", [[{ x: 0, y: 0, text: "t" }], 2, {}]],
        ["drawPath", [[{ points: [{ x: 0, y: 0 }] }], 2, {}]],
        ["drawImage", [[{ x: 0, y: 0, img: "img" }], 2, {}]],
        ["drawStaticImage", [[{ x: 0, y: 0, img: "img" }], "cache", 2, {}]],
        ["drawGridLines", [1, 2, "red", 3]],
        ["clearLayer", [2]],
        ["clearAll", []],
        ["clearStaticCache", ["cache"]],
        ["removeDrawHandle", [{ id: Symbol("h"), layer: 1 }]],
        ["hitTest", [{ x: 1, y: 1 }, {}]],
        ["hitTestFirst", [{ x: 1, y: 1 }, {}]],
        ["hitTestRect", [{ minX: 0, maxX: 1, minY: 0, maxY: 1 }, {}]],
    ];

    it.each(FORWARDED)("forwards %s to the engine method of the same name", (method, args) => {
        const engineMethod = vi.fn(() => ({ id: Symbol("result"), layer: 1 }));
        const { result } = renderHook(() => useEngineHandle<unknown, unknown, unknown>());

        act(() => result.current._setInstance(asEngine({ [method]: engineMethod })));

        const handleMethod = result.current[method as keyof Handle] as (...call: unknown[]) => unknown;
        handleMethod(...args);

        expect(engineMethod).toHaveBeenCalledTimes(1);
        expect(engineMethod).toHaveBeenCalledWith(...args);
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
