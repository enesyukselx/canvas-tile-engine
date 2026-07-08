import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { SpriteAnimator } from "../../src/modules/SpriteAnimator";
import { SpriteSheet } from "../../src/modules/SpriteSheet";

const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32 });
const frames = sheet.framesInRow(0, 0, 4); // 5 frames

describe("SpriteAnimator", () => {
    describe("constructor", () => {
        it("throws on empty frames", () => {
            expect(() => new SpriteAnimator({ frames: [], fps: 8 })).toThrow();
        });

        it("throws on non-positive fps", () => {
            expect(() => new SpriteAnimator({ frames, fps: 0 })).toThrow();
            expect(() => new SpriteAnimator({ frames, fps: -5 })).toThrow();
        });
    });

    describe("frameIndexAt", () => {
        it("advances at the configured fps", () => {
            const animator = new SpriteAnimator({ frames, fps: 8 }); // 125ms per frame

            expect(animator.frameIndexAt(0)).toBe(0);
            expect(animator.frameIndexAt(124)).toBe(0);
            expect(animator.frameIndexAt(125)).toBe(1);
            expect(animator.frameIndexAt(500)).toBe(4);
        });

        it("wraps around when looping", () => {
            const animator = new SpriteAnimator({ frames, fps: 8 });

            expect(animator.frameIndexAt(625)).toBe(0);
            expect(animator.frameIndexAt(750)).toBe(1);
        });

        it("clamps to the last frame when not looping", () => {
            const animator = new SpriteAnimator({ frames, fps: 8, loop: false });

            expect(animator.frameIndexAt(500)).toBe(4);
            expect(animator.frameIndexAt(10_000)).toBe(4);
        });

        it("treats negative elapsed time as 0", () => {
            const animator = new SpriteAnimator({ frames, fps: 8 });

            expect(animator.frameIndexAt(-50)).toBe(0);
        });
    });

    describe("frameAt", () => {
        it("returns the source rect of the current frame", () => {
            const animator = new SpriteAnimator({ frames, fps: 8 });

            expect(animator.frameAt(0)).toEqual(frames[0]);
            expect(animator.frameAt(130)).toEqual(frames[1]);
        });
    });

    describe("start/stop", () => {
        beforeEach(() => {
            vi.useFakeTimers();

            let frameId = 0;
            vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
                frameId++;
                setTimeout(() => cb(performance.now()), 16);
                return frameId;
            });
            vi.stubGlobal("cancelAnimationFrame", vi.fn());
        });

        afterEach(() => {
            vi.useRealTimers();
            vi.unstubAllGlobals();
        });

        it("fires immediately with the first frame", () => {
            const animator = new SpriteAnimator({ frames, fps: 8 });
            const onFrame = vi.fn();

            animator.start(onFrame);

            expect(onFrame).toHaveBeenCalledWith(frames[0], 0);
            animator.stop();
        });

        it("fires only when the frame index changes", () => {
            const animator = new SpriteAnimator({ frames, fps: 8 });
            const onFrame = vi.fn();

            animator.start(onFrame);
            // 8fps = 125ms per frame; 100ms of 16ms ticks stays on frame 0
            vi.advanceTimersByTime(100);
            expect(onFrame).toHaveBeenCalledTimes(1);

            vi.advanceTimersByTime(50);
            expect(onFrame).toHaveBeenCalledTimes(2);
            expect(onFrame).toHaveBeenLastCalledWith(frames[1], 1);

            animator.stop();
        });

        it("completes a non-looping animation on the last frame", () => {
            const animator = new SpriteAnimator({ frames, fps: 8, loop: false });
            const onFrame = vi.fn();
            const onComplete = vi.fn();

            animator.start(onFrame, onComplete);
            vi.advanceTimersByTime(1000);

            expect(onFrame).toHaveBeenLastCalledWith(frames[4], 4);
            expect(onComplete).toHaveBeenCalledTimes(1);
            expect(animator.isRunning()).toBe(false);
        });

        it("keeps looping animations running", () => {
            const animator = new SpriteAnimator({ frames, fps: 8 });
            const onFrame = vi.fn();

            animator.start(onFrame);
            vi.advanceTimersByTime(1000);

            expect(animator.isRunning()).toBe(true);
            animator.stop();
            expect(animator.isRunning()).toBe(false);
        });

        it("stops firing after stop()", () => {
            vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
            // Re-stub rAF so ids match the timeout ids for clearTimeout
            vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
                return setTimeout(() => cb(performance.now()), 16) as unknown as number;
            });

            const animator = new SpriteAnimator({ frames, fps: 8 });
            const onFrame = vi.fn();

            animator.start(onFrame);
            animator.stop();
            vi.advanceTimersByTime(1000);

            expect(onFrame).toHaveBeenCalledTimes(1);
        });

        it("completes single-frame non-looping animations immediately", () => {
            const animator = new SpriteAnimator({ frames: [frames[0]], fps: 8, loop: false });
            const onFrame = vi.fn();
            const onComplete = vi.fn();

            animator.start(onFrame, onComplete);

            expect(onFrame).toHaveBeenCalledWith(frames[0], 0);
            expect(onComplete).toHaveBeenCalledTimes(1);
            expect(animator.isRunning()).toBe(false);
        });

        it("applies only the first frame in headless environments", () => {
            vi.stubGlobal("requestAnimationFrame", undefined);

            const animator = new SpriteAnimator({ frames, fps: 8 });
            const onFrame = vi.fn();

            animator.start(onFrame);

            expect(onFrame).toHaveBeenCalledWith(frames[0], 0);
            expect(animator.isRunning()).toBe(false);
        });
    });
});
