import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FpsSampler } from "../src/scene/FpsSampler";

// Drives the sampler's rAF loop by hand: `advance` moves the fake clock and
// runs whatever the last tick queued.
let now = 0;
let queued: Array<() => void> = [];

function advance(ms: number) {
    now += ms;
    const pending = queued;
    queued = [];
    for (const cb of pending) {
        cb();
    }
}

beforeEach(() => {
    now = 0;
    queued = [];
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", (cb: () => void) => {
        queued.push(cb);
        return queued.length;
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

        expect(queued).toHaveLength(1);
    });

    it("stops scheduling frames after stop, and keeps the last reading", () => {
        const sampler = new FpsSampler();
        sampler.start();
        for (let i = 0; i < 12; i++) {
            advance(16);
        }

        sampler.stop();
        advance(16); // the already-queued frame runs, and queues nothing further

        expect(queued).toHaveLength(0);
        expect(sampler.fps).toBe(63);
    });

    it("can be restarted after stop", () => {
        const sampler = new FpsSampler();
        sampler.start();
        sampler.stop();
        advance(16);
        expect(queued).toHaveLength(0);

        sampler.start();
        expect(queued).toHaveLength(1);
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

        expect(queued).toHaveLength(0);
        expect(onUpdate).not.toHaveBeenCalled();
    });
});
