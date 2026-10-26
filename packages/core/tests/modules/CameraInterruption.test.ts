import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasTileEngine } from "../../src/CanvasTileEngine";
import type { IRenderer } from "../../src/types";

type Mount = Record<string, never>;

describe("camera command interruption", () => {
    let engine: CanvasTileEngine<Mount>;
    let now: number;
    let pending: Map<number, FrameRequestCallback>;
    let cancelFrame: ReturnType<typeof vi.fn>;

    // Keep captured callbacks available to tests even after cancellation:
    // stale work must not write to the camera or schedule another frame.
    function advance(time: number) {
        now = time;
        for (const [id, callback] of [...pending]) {
            if (pending.delete(id)) {
                callback(now);
            }
        }
    }

    function capturePending() {
        return [...pending.values()];
    }

    function fireStale(callbacks: FrameRequestCallback[], time: number) {
        now = time;
        for (const callback of callbacks) {
            callback(now);
        }
    }

    function expectCenter(x: number, y: number) {
        expect(engine.getCenter().x).toBeCloseTo(x);
        expect(engine.getCenter().y).toBeCloseTo(y);
    }

    beforeEach(() => {
        now = 0;
        pending = new Map();
        let nextId = 0;
        vi.spyOn(performance, "now").mockImplementation(() => now);
        vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
            const id = ++nextId;
            pending.set(id, callback);
            return id;
        });
        cancelFrame = vi.fn((id: number) => pending.delete(id));
        vi.stubGlobal("cancelAnimationFrame", cancelFrame);

        // Only the renderer is stubbed; camera, viewport, animation controller,
        // and public engine commands all run their real implementations.
        const renderer = {
            init: vi.fn(),
            setupEvents: vi.fn(),
            render: vi.fn(),
            destroy: vi.fn(),
        } as unknown as IRenderer<Mount>;
        engine = new CanvasTileEngine<Mount>(
            {},
            {
                scale: 1,
                minScale: 0.1,
                maxScale: 16,
                size: { width: 800, height: 600 },
                accessibility: { reducedMotion: false },
            },
            renderer,
            { x: 0, y: 0 },
        );
    });

    afterEach(() => {
        engine.destroy();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    it("setCenter cancels a move, ignores stale frames, and allows a fresh move", () => {
        const oldComplete = vi.fn();
        engine.goCenter(100, 100, 1000, oldComplete);
        advance(100);
        const stale = capturePending();

        engine.setCenter({ x: 10, y: 10 });
        expectCenter(10, 10);
        expect(cancelFrame).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);

        fireStale(stale, 500);
        expectCenter(10, 10);
        fireStale(stale, 1000);
        expectCenter(10, 10);
        expect(oldComplete).not.toHaveBeenCalled();
        expect(pending.size).toBe(0);

        const complete = vi.fn();
        engine.goCenter(20, 20, 1000, complete);
        advance(1500);
        expectCenter(15, 15);
        advance(2000);
        expectCenter(20, 20);
        expect(complete).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);
    });

    it("setScale cancels a zoom, ignores stale frames, and allows a fresh zoom", () => {
        const oldComplete = vi.fn();
        engine.goScale(4, 1000, oldComplete);
        advance(100);
        const stale = capturePending();

        engine.setScale(3);
        expect(engine.getScale()).toBe(3);
        expect(cancelFrame).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);

        fireStale(stale, 500);
        expect(engine.getScale()).toBe(3);
        fireStale(stale, 1000);
        expect(engine.getScale()).toBe(3);
        expect(oldComplete).not.toHaveBeenCalled();
        expect(pending.size).toBe(0);

        const complete = vi.fn();
        engine.goScale(12, 1000, complete);
        advance(1500);
        expect(engine.getScale()).toBeCloseTo(6);
        advance(2000);
        expect(engine.getScale()).toBe(12);
        expect(complete).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);
    });

    it.each(["setScale", "zoomIn", "zoomOut", "goScale(0)", "unchanged scale", "clamped scale"])(
        "%s interrupts only zoom and lets a concurrent move finish",
        (command) => {
            const moveComplete = vi.fn();
            const zoomComplete = vi.fn();
            engine.goScale(4, 1000, zoomComplete);
            engine.goCenter(100, 100, 1000, moveComplete);
            advance(100);
            const [staleZoom] = capturePending();

            if (command === "setScale") {
                engine.setScale(3);
            }
            if (command === "zoomIn") {
                engine.zoomIn(2);
            }
            if (command === "zoomOut") {
                engine.zoomOut(2);
            }
            if (command === "goScale(0)") {
                engine.goScale(3, 0);
            }
            if (command === "unchanged scale") {
                engine.setScale(engine.getScale());
            }
            if (command === "clamped scale") {
                engine.setScale(100);
            }
            const scale = engine.getScale();
            expect(pending.size).toBe(1);
            fireStale([staleZoom!], 500);
            advance(1000);

            expect(engine.getScale()).toBe(scale);
            expectCenter(100, 100);
            expect(zoomComplete).not.toHaveBeenCalled();
            expect(moveComplete).toHaveBeenCalledOnce();
            expect(pending.size).toBe(0);
        },
    );

    it.each(["setCenter", "goCenter(0)", "unchanged center"])(
        "%s interrupts only movement and lets a concurrent zoom finish",
        (command) => {
            const moveComplete = vi.fn();
            const zoomComplete = vi.fn();
            engine.goCenter(100, 100, 1000, moveComplete);
            engine.goScale(4, 1000, zoomComplete);
            advance(100);
            const [staleMove] = capturePending();

            if (command === "setCenter") {
                engine.setCenter({ x: 10, y: 10 });
            }
            if (command === "goCenter(0)") {
                engine.goCenter(10, 10, 0);
            }
            if (command === "unchanged center") {
                engine.setCenter(engine.getCenter());
            }
            const center = engine.getCenter();
            expect(pending.size).toBe(1);
            fireStale([staleMove!], 500);
            advance(1000);

            expectCenter(center.x, center.y);
            expect(engine.getScale()).toBe(4);
            expect(moveComplete).not.toHaveBeenCalled();
            expect(zoomComplete).toHaveBeenCalledOnce();
            expect(pending.size).toBe(0);
        },
    );

    it.each(["zero duration", "negative duration", "reduced motion", "no RAF"])(
        "instant fitBounds cancels both channels with %s",
        (mode) => {
            const moveComplete = vi.fn();
            const zoomComplete = vi.fn();
            const fitComplete = vi.fn();
            engine.goCenter(100, 100, 1000, moveComplete);
            engine.goScale(4, 1000, zoomComplete);
            advance(100);
            const stale = capturePending();

            if (mode === "reduced motion") {
                engine.setReducedMotion(true);
            }
            if (mode === "no RAF") {
                vi.stubGlobal("requestAnimationFrame", undefined);
            }
            engine.fitBounds(
                { minX: 0, maxX: 100, minY: 0, maxY: 100 },
                {
                    durationMs: mode === "zero duration" ? 0 : mode === "negative duration" ? -1 : 500,
                    onComplete: fitComplete,
                },
            );
            expectCenter(50, 50);
            expect(engine.getScale()).toBe(6);
            fireStale(stale, 1000);
            expectCenter(50, 50);
            expect(engine.getScale()).toBe(6);
            expect(moveComplete).not.toHaveBeenCalled();
            expect(zoomComplete).not.toHaveBeenCalled();
            expect(fitComplete).toHaveBeenCalledOnce();
            expect(pending.size).toBe(0);
        },
    );

    it("keeps an uninterrupted animated fit moving and zooming on every frame", () => {
        const complete = vi.fn();
        engine.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 }, { durationMs: 1000, onComplete: complete });
        advance(500);
        expectCenter(25, 25);
        expect(engine.getScale()).toBeCloseTo(Math.sqrt(6));
        expect(pending.size).toBe(2);
        advance(1000);
        expectCenter(50, 50);
        expect(engine.getScale()).toBe(6);
        expect(complete).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);
    });

    it("invalid setters leave running move and zoom animations intact", () => {
        engine.goCenter(100, 100, 1000);
        engine.goScale(4, 1000);
        expect(() => engine.setCenter({ x: NaN, y: 10 })).toThrow();
        expect(() => engine.setScale(0)).toThrow();
        expect(cancelFrame).not.toHaveBeenCalled();
        advance(1000);
        expectCenter(100, 100);
        expect(engine.getScale()).toBe(4);
    });

    it.each([100, 1000])("setCenter from onCoordsChange prevents rescheduling/completion at %i ms", (time) => {
        const complete = vi.fn();
        engine.onCoordsChange = () => {
            engine.onCoordsChange = undefined;
            engine.setCenter({ x: 10, y: 10 });
        };
        engine.goCenter(100, 100, 1000, complete);
        advance(time);
        expectCenter(10, 10);
        expect(pending.size).toBe(0);
        expect(complete).not.toHaveBeenCalled();
    });

    it.each([100, 1000])("setScale from onZoom prevents rescheduling/completion at %i ms", (time) => {
        const complete = vi.fn();
        engine.onZoom = () => {
            engine.onZoom = undefined;
            engine.setScale(3);
        };
        engine.goScale(4, 1000, complete);
        advance(time);
        expect(engine.getScale()).toBe(3);
        expect(pending.size).toBe(0);
        expect(complete).not.toHaveBeenCalled();
    });

    it("a move started from onCoordsChange owns its frames and completion", () => {
        const oldComplete = vi.fn();
        const newComplete = vi.fn();
        engine.onCoordsChange = () => {
            engine.onCoordsChange = undefined;
            engine.goCenter(20, 20, 500, newComplete);
        };
        engine.goCenter(100, 100, 1000, oldComplete);
        advance(1000);
        expect(pending.size).toBe(1);
        advance(1500);
        expectCenter(20, 20);
        expect(oldComplete).not.toHaveBeenCalled();
        expect(newComplete).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);
    });

    it("a zoom started from onZoom owns its frames and completion", () => {
        const oldComplete = vi.fn();
        const newComplete = vi.fn();
        engine.onZoom = () => {
            engine.onZoom = undefined;
            engine.goScale(8, 500, newComplete);
        };
        engine.goScale(4, 1000, oldComplete);
        advance(1000);
        expect(pending.size).toBe(1);
        advance(1500);
        expect(engine.getScale()).toBe(8);
        expect(oldComplete).not.toHaveBeenCalled();
        expect(newComplete).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);
    });

    it("an interrupted instant move does not report completion", () => {
        const complete = vi.fn();
        engine.onCoordsChange = () => {
            engine.onCoordsChange = undefined;
            engine.setCenter({ x: 10, y: 10 });
        };
        engine.goCenter(100, 100, 0, complete);
        expectCenter(10, 10);
        expect(complete).not.toHaveBeenCalled();
        expect(pending.size).toBe(0);
    });

    it("an interrupted instant zoom does not report completion", () => {
        const complete = vi.fn();
        engine.onZoom = () => {
            engine.onZoom = undefined;
            engine.setScale(3);
        };
        engine.goScale(4, 0, complete);
        expect(engine.getScale()).toBe(3);
        expect(complete).not.toHaveBeenCalled();
        expect(pending.size).toBe(0);
    });

    it("destroy prevents stale move and zoom callbacks from reviving the engine", () => {
        const complete = vi.fn();
        engine.goCenter(100, 100, 1000, complete);
        engine.goScale(4, 1000, complete);
        advance(100);
        const stale = capturePending();
        const center = engine.getCenter();
        const scale = engine.getScale();
        engine.destroy();
        fireStale(stale, 500);
        fireStale(stale, 1000);
        expectCenter(center.x, center.y);
        expect(engine.getScale()).toBe(scale);
        expect(complete).not.toHaveBeenCalled();
        expect(pending.size).toBe(0);
    });
});
