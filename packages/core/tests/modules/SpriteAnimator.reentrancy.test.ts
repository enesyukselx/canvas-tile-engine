import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpriteAnimator } from "../../src/modules/SpriteAnimator";
import { SpriteSheet } from "../../src/modules/SpriteSheet";

const frames = new SpriteSheet({ frameWidth: 32, frameHeight: 32 }).framesInRow(0, 0, 2);

describe("SpriteAnimator callback interruption", () => {
    let now: number;
    let nextId: number;
    let pending: Map<number, FrameRequestCallback>;

    beforeEach(() => {
        now = 0;
        nextId = 0;
        pending = new Map();
        vi.spyOn(performance, "now").mockImplementation(() => now);
        vi.stubGlobal(
            "requestAnimationFrame",
            vi.fn((callback: FrameRequestCallback) => {
                const id = ++nextId;
                pending.set(id, callback);
                return id;
            }),
        );
        vi.stubGlobal(
            "cancelAnimationFrame",
            vi.fn((id: number) => pending.delete(id)),
        );
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    function advanceTo(time: number) {
        now = time;
        for (const [id, callback] of [...pending]) {
            if (pending.delete(id)) {
                callback(time);
            }
        }
    }

    function queuedFrame(): FrameRequestCallback {
        expect(pending.size).toBe(1);
        return [...pending.values()][0];
    }

    it("stops at frame 1 when its callback stops a three-frame, 10fps loop (H11)", () => {
        const animator = new SpriteAnimator({ frames, fps: 10 });
        const observed: number[] = [];

        animator.start((_, index) => {
            observed.push(index);
            if (index === 1) {
                animator.stop();
            }
        });
        advanceTo(100);
        advanceTo(200);

        expect(observed).toEqual([0, 1]);
        expect(animator.isRunning()).toBe(false);
        expect(pending.size).toBe(0);
    });

    it.each([
        { name: "looping", loop: true, singleFrame: false, headless: false },
        { name: "non-looping", loop: false, singleFrame: false, headless: false },
        { name: "single-frame looping", loop: true, singleFrame: true, headless: false },
        { name: "single-frame non-looping", loop: false, singleFrame: true, headless: false },
        { name: "headless looping", loop: true, singleFrame: false, headless: true },
        { name: "headless non-looping", loop: false, singleFrame: false, headless: true },
    ])("honors stop in the immediate callback for $name playback", ({ loop, singleFrame, headless }) => {
        if (headless) {
            vi.stubGlobal("requestAnimationFrame", undefined);
        }
        const animator = new SpriteAnimator({ frames: singleFrame ? [frames[0]] : frames, fps: 10, loop });
        const onComplete = vi.fn();
        const onFrame = vi.fn(() => animator.stop());

        animator.start(onFrame, onComplete);
        advanceTo(300);

        expect(onFrame).toHaveBeenCalledExactlyOnceWith(frames[0], 0);
        expect(onComplete).not.toHaveBeenCalled();
        expect(animator.isRunning()).toBe(false);
        expect(pending.size).toBe(0);
    });

    it.each([0, 1, 2])("keeps only the replacement run when restarted from frame %i", (restartIndex) => {
        const animator = new SpriteAnimator({ frames, fps: 10, loop: false });
        const replacement = vi.fn();
        const replacementComplete = vi.fn();
        const oldComplete = vi.fn();
        const oldFrame = vi.fn((_, index: number) => {
            if (index === restartIndex) {
                animator.start(replacement, replacementComplete);
            }
        });

        animator.start(oldFrame, oldComplete);
        if (restartIndex > 0) {
            advanceTo(restartIndex * 100);
        }

        expect(replacement).toHaveBeenCalledExactlyOnceWith(frames[0], 0);
        expect(oldComplete).not.toHaveBeenCalled();
        expect(animator.isRunning()).toBe(true);
        expect(pending.size).toBe(1);

        advanceTo((restartIndex + 1) * 100);
        expect(replacement).toHaveBeenLastCalledWith(frames[1], 1);
        expect(oldFrame).toHaveBeenCalledTimes(restartIndex === 0 ? 1 : 2);
        expect(pending.size).toBe(1);

        advanceTo((restartIndex + 2) * 100);
        expect(replacement).toHaveBeenLastCalledWith(frames[2], 2);
        expect(replacementComplete).toHaveBeenCalledOnce();
        expect(oldComplete).not.toHaveBeenCalled();
        expect(animator.isRunning()).toBe(false);
        expect(pending.size).toBe(0);
    });

    it("does not complete a non-looping run stopped by its last-frame callback", () => {
        const animator = new SpriteAnimator({ frames, fps: 10, loop: false });
        const onComplete = vi.fn();

        animator.start((_, index) => {
            if (index === 2) {
                animator.stop();
            }
        }, onComplete);
        advanceTo(200);

        expect(onComplete).not.toHaveBeenCalled();
        expect(animator.isRunning()).toBe(false);
        expect(pending.size).toBe(0);
    });

    describe.each([
        { name: "single-frame", animationFrames: [frames[0]], headless: false },
        { name: "headless", animationFrames: frames, headless: true },
    ])("immediate $name completion", ({ animationFrames, headless }) => {
        beforeEach(() => {
            if (headless) {
                vi.stubGlobal("requestAnimationFrame", undefined);
            }
        });

        it("only completes the replacement when restarted from the initial frame", () => {
            const animator = new SpriteAnimator({ frames: animationFrames, fps: 10, loop: false });
            const replacement = vi.fn();
            const replacementComplete = vi.fn();
            const oldComplete = vi.fn();

            animator.start(() => animator.start(replacement, replacementComplete), oldComplete);

            expect(oldComplete).not.toHaveBeenCalled();
            expect(replacement).toHaveBeenCalledExactlyOnceWith(frames[0], 0);
            expect(replacementComplete).toHaveBeenCalledOnce();
            expect(animator.isRunning()).toBe(false);
            expect(pending.size).toBe(0);
        });

        it("allows the completion callback to start a new run", () => {
            const animator = new SpriteAnimator({ frames: animationFrames, fps: 10, loop: false });
            const replacement = vi.fn();
            const replacementComplete = vi.fn();
            const onComplete = vi.fn(() => animator.start(replacement, replacementComplete));

            animator.start(vi.fn(), onComplete);

            expect(onComplete).toHaveBeenCalledOnce();
            expect(replacement).toHaveBeenCalledExactlyOnceWith(frames[0], 0);
            expect(replacementComplete).toHaveBeenCalledOnce();
            expect(animator.isRunning()).toBe(false);
            expect(pending.size).toBe(0);
        });
    });

    it("ignores a canceled frame delivered after stop", () => {
        const animator = new SpriteAnimator({ frames, fps: 10 });
        const onFrame = vi.fn();
        animator.start(onFrame);
        const canceledFrame = queuedFrame();

        animator.stop();
        canceledFrame(100);

        expect(onFrame).toHaveBeenCalledExactlyOnceWith(frames[0], 0);
        expect(animator.isRunning()).toBe(false);
        expect(pending.size).toBe(0);
    });

    it("does not let a stale frame overwrite the replacement run's scheduled frame", () => {
        const animator = new SpriteAnimator({ frames, fps: 10, loop: false });
        const oldFrame = vi.fn();
        const oldComplete = vi.fn();
        animator.start(oldFrame, oldComplete);
        const canceledFrame = queuedFrame();
        const replacement = vi.fn();

        animator.start(replacement);
        const replacementFrame = queuedFrame();
        canceledFrame(200);

        expect(oldFrame).toHaveBeenCalledExactlyOnceWith(frames[0], 0);
        expect(oldComplete).not.toHaveBeenCalled();
        expect(replacement).toHaveBeenCalledExactlyOnceWith(frames[0], 0);
        expect(queuedFrame()).toBe(replacementFrame);
        expect(animator.isRunning()).toBe(true);

        animator.stop();
        replacementFrame(100);
        expect(replacement).toHaveBeenCalledOnce();
        expect(pending.size).toBe(0);
        expect(animator.isRunning()).toBe(false);
    });

    it("allows onComplete to restart without stale callbacks completing the old run again", () => {
        const animator = new SpriteAnimator({ frames, fps: 10, loop: false });
        const replacement = vi.fn();
        const oldFrame = vi.fn();
        const onComplete = vi.fn(() => {
            expect(animator.isRunning()).toBe(false);
            animator.start(replacement);
        });
        animator.start(oldFrame, onComplete);
        const completedFrame = queuedFrame();

        advanceTo(200);
        completedFrame(200);

        expect(onComplete).toHaveBeenCalledOnce();
        expect(oldFrame).toHaveBeenCalledTimes(2);
        expect(replacement).toHaveBeenCalledExactlyOnceWith(frames[0], 0);
        expect(animator.isRunning()).toBe(true);
        expect(pending.size).toBe(1);
        advanceTo(300);
        expect(replacement).toHaveBeenLastCalledWith(frames[1], 1);
        animator.stop();
        expect(pending.size).toBe(0);
    });

    it("does not complete again if a finished run's callback is delivered twice", () => {
        const animator = new SpriteAnimator({ frames, fps: 10, loop: false });
        const onComplete = vi.fn();
        const onFrame = vi.fn();
        animator.start(onFrame, onComplete);
        const completedFrame = queuedFrame();

        advanceTo(200);
        completedFrame(300);

        expect(onFrame).toHaveBeenCalledTimes(2);
        expect(onComplete).toHaveBeenCalledOnce();
        expect(animator.isRunning()).toBe(false);
        expect(pending.size).toBe(0);
    });
});
