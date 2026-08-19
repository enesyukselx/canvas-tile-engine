import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FpsSampler } from "../src/scene/FpsSampler";

// Drives the sampler's rAF loop by hand: `advance` moves the fake clock and
// runs whatever the last tick queued. Callbacks are keyed by handle so the
// cancelAnimationFrame stub can drop one the way a real host would.
let now = 0;
let nextHandle = 1;
let queued = new Map<number, () => void>();

function advance(ms: number) {
    now += ms;
    const pending = [...queued.values()];
    queued.clear();
    for (const cb of pending) {
        cb();
    }
}

beforeEach(() => {
    now = 0;
    nextHandle = 1;
    queued = new Map();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
        const handle = nextHandle++;
        queued.set(handle, cb);
        return handle;
    });
    vi.stubGlobal("cancelAnimationFrame", (handle: number) => {
        queued.delete(handle);
    });
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("FpsSampler", () => {
    it("reads 0 before it is started", () => {
        expect(new FpsSampler().fps).toBe(0);
    });

    it("reports the rolling average frame rate", () => {
        const sampler = new FpsSampler();
        sampler.start();

        // More than the 10-sample window, so only the steady 16ms frames count.
        for (let i = 0; i < 12; i++) {
            advance(16);
        }

        expect(sampler.fps).toBe(63); // round(1000 / 16)
    });

    it("averages over the sample window rather than the last frame", () => {
        const sampler = new FpsSampler();
        sampler.start();

        for (let i = 0; i < 12; i++) {
            advance(10);
        }
        expect(sampler.fps).toBe(100);

        // A single 110ms stall moves the 10-frame average to 20ms, not 110ms.
        advance(110);
        expect(sampler.fps).toBe(50);
    });

    it("notifies only when the reading changes", () => {
        const sampler = new FpsSampler();
        const onUpdate = vi.fn();
        sampler.setUpdateCallback(onUpdate);
        sampler.start();

        for (let i = 0; i < 12; i++) {
            advance(16);
        }
        const settled = onUpdate.mock.calls.length;

        // Same delta again: the average is unchanged, so no repaint is asked for.
        advance(16);
        advance(16);
        expect(onUpdate).toHaveBeenCalledTimes(settled);

        advance(50);
        expect(onUpdate).toHaveBeenCalledTimes(settled + 1);
    });

    it("ignores a second start while running", () => {
        const sampler = new FpsSampler();
        sampler.start();
        sampler.start();

        expect(queued.size).toBe(1);
    });

    it("cancels the pending frame on stop, and keeps the last reading", () => {
        const sampler = new FpsSampler();
        sampler.start();
        for (let i = 0; i < 12; i++) {
            advance(16);
        }

        sampler.stop(); // drops the frame the last tick queued, right away

        expect(queued.size).toBe(0);
        advance(16);
        expect(queued.size).toBe(0);
        expect(sampler.fps).toBe(63);
    });

    it("can be restarted after stop", () => {
        const sampler = new FpsSampler();
        sampler.start();
        sampler.stop();
        expect(queued.size).toBe(0);

        sampler.start();
        expect(queued.size).toBe(1);
    });

    it("keeps one loop when restarted before the pending frame fires", () => {
        const sampler = new FpsSampler();
        sampler.start();
        for (let i = 0; i < 12; i++) {
            advance(16);
        }

        // No advance() between the two calls: the frame stop() cancels is the
        // one the last tick queued. A second chained loop here would feed the
        // average a 16ms delta and a 0ms one per frame and double the reading.
        sampler.stop();
        sampler.start();
        expect(queued.size).toBe(1);

        for (let i = 0; i < 12; i++) {
            advance(16);
        }
        expect(queued.size).toBe(1);
        expect(sampler.fps).toBe(63);
    });

    it("drops pre-stop samples on restart", () => {
        const sampler = new FpsSampler();
        sampler.start();
        for (let i = 0; i < 12; i++) {
            advance(10);
        }
        expect(sampler.fps).toBe(100);

        sampler.stop();
        advance(5_000); // idle gap; it must not land in the average either
        sampler.start();

        // First frame after the restart: 16ms alone, not blended with the 10ms run.
        advance(16);
        expect(sampler.fps).toBe(63);
    });

    it("stops the loop and drops the callback on destroy", () => {
        const sampler = new FpsSampler();
        const onUpdate = vi.fn();
        sampler.setUpdateCallback(onUpdate);
        sampler.start();
        advance(16);
        onUpdate.mockClear();

        sampler.destroy();
        advance(16);

        expect(queued.size).toBe(0);
        expect(onUpdate).not.toHaveBeenCalled();
    });
});
