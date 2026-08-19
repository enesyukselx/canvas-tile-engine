import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AnimationController } from "../../src/modules/AnimationController";
import { ICamera } from "../../src/modules/Camera";
import { ViewportState } from "../../src/modules/ViewportState";
import { Coords, MotionPolicy } from "../../src/types";

describe("AnimationController", () => {
    let mockCamera: ICamera;
    let viewport: ViewportState;
    let onAnimationFrame: () => void;
    let controller: AnimationController;
    let setCenterMock: (center: Coords, canvasWidth: number, canvasHeight: number) => void;
    let currentScale: number;
    /** Mutable so a test can flip the preference mid-animation. */
    let reducedMotion: boolean;
    let motion: MotionPolicy;

    beforeEach(() => {
        vi.useFakeTimers();

        setCenterMock = vi.fn();
        currentScale = 1;
        mockCamera = {
            x: 0,
            y: 0,
            get scale() {
                return currentScale;
            },
            pan: vi.fn(),
            zoom: vi.fn(),
            zoomByFactor: vi.fn(),
            getCenter: vi.fn(() => ({ x: 50, y: 50 })),
            setCenter: setCenterMock,
            adjustForResize: vi.fn(),
            setScale: vi.fn((newScale: number) => {
                currentScale = Math.min(10, Math.max(0.1, newScale));
            }),
            setScaleLimits: vi.fn(),
            getVisibleBounds: vi.fn(() => ({ minX: 0, maxX: 100, minY: 0, maxY: 100 })),
        };

        viewport = new ViewportState(800, 600);
        onAnimationFrame = vi.fn();
        reducedMotion = false;
        motion = {
            getReducedMotion: () => reducedMotion,
            effectiveDuration: (durationMs: number) => (reducedMotion ? 0 : durationMs),
        };
        controller = new AnimationController(mockCamera, viewport, onAnimationFrame, motion);

        // Mock requestAnimationFrame. cancelAnimationFrame really cancels:
        // a no-op stub lets a cancelled animation keep writing on the next
        // timer tick, which would make every cancellation assertion in this
        // file vacuous.
        let frameId = 0;
        const frameTimers = new Map<number, ReturnType<typeof setTimeout>>();
        vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
            const id = ++frameId;
            frameTimers.set(
                id,
                setTimeout(() => {
                    frameTimers.delete(id);
                    cb(performance.now());
                }, 16),
            );
            return id;
        });
        vi.stubGlobal("cancelAnimationFrame", (id: number) => {
            const timer = frameTimers.get(id);
            if (timer !== undefined) {
                clearTimeout(timer);
                frameTimers.delete(id);
            }
        });
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
    });

    describe("animateMoveTo", () => {
        it("moves camera instantly when duration is 0", () => {
            controller.animateMoveTo(100, 100, 0);

            expect(setCenterMock).toHaveBeenCalledWith({ x: 100, y: 100 }, 800, 600);
            expect(onAnimationFrame).toHaveBeenCalled();
        });

        it("calls onComplete callback for instant move", () => {
            const onComplete = vi.fn();
            controller.animateMoveTo(100, 100, 0, onComplete);

            expect(onComplete).toHaveBeenCalled();
        });

        it("starts animation when duration > 0", () => {
            controller.animateMoveTo(100, 100, 500);

            expect(controller.isAnimating()).toBe(true);
        });

        it("updates camera position during animation", () => {
            controller.animateMoveTo(100, 100, 500);

            // Advance time partially through animation
            vi.advanceTimersByTime(250);

            expect(setCenterMock).toHaveBeenCalled();
            expect(onAnimationFrame).toHaveBeenCalled();
        });

        it("completes animation after duration", () => {
            const onComplete = vi.fn();
            controller.animateMoveTo(100, 100, 500, onComplete);

            // Advance past animation duration
            vi.advanceTimersByTime(600);

            expect(onComplete).toHaveBeenCalled();
        });

        it("cancels previous animation when new one starts", () => {
            const cancelAnimationFrame = vi.fn();
            vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

            controller.animateMoveTo(100, 100, 500);
            controller.animateMoveTo(200, 200, 500);

            expect(cancelAnimationFrame).toHaveBeenCalled();
        });
    });

    describe("animateZoomTo", () => {
        it("applies the scale instantly when duration is 0", () => {
            controller.animateZoomTo(2, 0);

            expect(mockCamera.setScale).toHaveBeenCalledWith(2);
            expect(onAnimationFrame).toHaveBeenCalled();
        });

        it("keeps the viewport center fixed", () => {
            controller.animateZoomTo(2, 0);

            expect(setCenterMock).toHaveBeenCalledWith({ x: 50, y: 50 }, 800, 600);
        });

        it("calls onComplete callback for instant zoom", () => {
            const onComplete = vi.fn();
            controller.animateZoomTo(2, 0, undefined, onComplete);

            expect(onComplete).toHaveBeenCalled();
        });

        it("reports the previous scale to onZoomFrame", () => {
            const onZoomFrame = vi.fn<(prevScale: number) => void>();
            controller.animateZoomTo(4, 0, onZoomFrame);

            expect(onZoomFrame).toHaveBeenCalledWith(1);
        });

        it("starts animation when duration > 0", () => {
            controller.animateZoomTo(2, 500);

            expect(controller.isAnimating()).toBe(true);
        });

        it("interpolates the scale between start and target during animation", () => {
            controller.animateZoomTo(4, 500);

            vi.advanceTimersByTime(250);

            expect(mockCamera.scale).toBeGreaterThan(1);
            expect(mockCamera.scale).toBeLessThan(4);
        });

        it("reaches the exact target scale after duration", () => {
            const onComplete = vi.fn();
            controller.animateZoomTo(4, 500, undefined, onComplete);

            vi.advanceTimersByTime(600);

            expect(mockCamera.scale).toBeCloseTo(4);
            expect(onComplete).toHaveBeenCalled();
            expect(controller.isAnimating()).toBe(false);
        });

        it("cancels previous zoom animation when new one starts", () => {
            const cancelAnimationFrame = vi.fn();
            vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

            controller.animateZoomTo(2, 500);
            controller.animateZoomTo(3, 500);

            expect(cancelAnimationFrame).toHaveBeenCalled();
        });
    });

    describe("animateResize", () => {
        it("resizes instantly when duration is 0", () => {
            const onApplySize = vi.fn();
            controller.animateResize(1024, 768, 0, onApplySize);

            expect(onApplySize).toHaveBeenCalledWith(1024, 768, expect.any(Object));
        });

        it("calls onComplete callback for instant resize", () => {
            const onComplete = vi.fn();
            controller.animateResize(1024, 768, 0, vi.fn(), onComplete);

            expect(onComplete).toHaveBeenCalled();
        });

        it("starts animation when duration > 0", () => {
            controller.animateResize(1024, 768, 500, vi.fn());

            expect(controller.isAnimating()).toBe(true);
        });

        it("does nothing for invalid dimensions", () => {
            const onApplySize = vi.fn();
            controller.animateResize(0, 768, 500, onApplySize);

            expect(onApplySize).not.toHaveBeenCalled();
            expect(controller.isAnimating()).toBe(false);
        });

        it("does nothing for negative dimensions", () => {
            const onApplySize = vi.fn();
            controller.animateResize(-100, 768, 500, onApplySize);

            expect(onApplySize).not.toHaveBeenCalled();
        });

        it("interpolates size during animation", () => {
            const onApplySize = vi.fn<(width: number, height: number, center: Coords) => void>();
            controller.animateResize(1000, 800, 500, onApplySize);

            // Advance time
            vi.advanceTimersByTime(250);

            // Should have called with intermediate values
            expect(onApplySize).toHaveBeenCalled();
            const lastCall = onApplySize.mock.calls[onApplySize.mock.calls.length - 1];
            expect(lastCall[0]).toBeGreaterThan(800);
            expect(lastCall[0]).toBeLessThan(1000);
        });
    });

    describe("cancelMove", () => {
        it("stops move animation", () => {
            const cancelAnimationFrame = vi.fn();
            vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

            controller.animateMoveTo(100, 100, 500);
            controller.cancelMove();

            expect(cancelAnimationFrame).toHaveBeenCalled();
        });

        it("does nothing when no animation is running", () => {
            expect(() => controller.cancelMove()).not.toThrow();
        });
    });

    describe("cancelZoom", () => {
        it("stops zoom animation", () => {
            const cancelAnimationFrame = vi.fn();
            vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

            controller.animateZoomTo(2, 500);
            controller.cancelZoom();

            expect(cancelAnimationFrame).toHaveBeenCalled();
        });

        it("does nothing when no animation is running", () => {
            expect(() => controller.cancelZoom()).not.toThrow();
        });
    });

    describe("cancelResize", () => {
        it("stops resize animation", () => {
            const cancelAnimationFrame = vi.fn();
            vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

            controller.animateResize(1024, 768, 500, vi.fn());
            controller.cancelResize();

            expect(cancelAnimationFrame).toHaveBeenCalled();
        });

        it("does nothing when no animation is running", () => {
            expect(() => controller.cancelResize()).not.toThrow();
        });
    });

    describe("cancelAll", () => {
        it("cancels move, zoom and resize animations", () => {
            const cancelAnimationFrame = vi.fn();
            vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

            controller.animateMoveTo(100, 100, 500);
            controller.animateZoomTo(2, 500);
            controller.animateResize(1024, 768, 500, vi.fn());
            controller.cancelAll();

            expect(cancelAnimationFrame).toHaveBeenCalledTimes(3);
        });
    });

    describe("isAnimating", () => {
        it("returns false when no animations are running", () => {
            expect(controller.isAnimating()).toBe(false);
        });

        it("returns true when move animation is running", () => {
            controller.animateMoveTo(100, 100, 500);
            expect(controller.isAnimating()).toBe(true);
        });

        it("returns true when zoom animation is running", () => {
            controller.animateZoomTo(2, 500);
            expect(controller.isAnimating()).toBe(true);
        });

        it("returns true when resize animation is running", () => {
            controller.animateResize(1024, 768, 500, vi.fn());
            expect(controller.isAnimating()).toBe(true);
        });

        it("returns true when both animations are running", () => {
            controller.animateMoveTo(100, 100, 500);
            controller.animateResize(1024, 768, 500, vi.fn());
            expect(controller.isAnimating()).toBe(true);
        });

        it("returns false after animation completes", () => {
            controller.animateMoveTo(100, 100, 100);
            vi.advanceTimersByTime(200);
            expect(controller.isAnimating()).toBe(false);
        });

        it("returns false after animation is cancelled", () => {
            controller.animateMoveTo(100, 100, 500);
            controller.cancelMove();
            expect(controller.isAnimating()).toBe(false);
        });
    });

    describe("without requestAnimationFrame (headless environments)", () => {
        beforeEach(() => {
            // Node has no requestAnimationFrame; drop the stub to simulate it.
            vi.unstubAllGlobals();
        });

        it("completes animateMoveTo instantly instead of crashing", () => {
            const onComplete = vi.fn();
            controller.animateMoveTo(100, 100, 500, onComplete);

            expect(setCenterMock).toHaveBeenCalledWith({ x: 100, y: 100 }, 800, 600);
            expect(onAnimationFrame).toHaveBeenCalled();
            expect(onComplete).toHaveBeenCalled();
            expect(controller.isAnimating()).toBe(false);
        });

        it("completes animateZoomTo instantly instead of crashing", () => {
            const onComplete = vi.fn();
            controller.animateZoomTo(2, 500, undefined, onComplete);

            expect(mockCamera.setScale).toHaveBeenCalledWith(2);
            expect(onComplete).toHaveBeenCalled();
            expect(controller.isAnimating()).toBe(false);
        });

        it("completes animateResize instantly instead of crashing", () => {
            const onApplySize = vi.fn();
            const onComplete = vi.fn();
            controller.animateResize(1000, 800, 500, onApplySize, onComplete);

            expect(onApplySize).toHaveBeenCalledWith(1000, 800, { x: 50, y: 50 });
            expect(onComplete).toHaveBeenCalled();
        });
    });

    describe("reduced motion", () => {
        it("lands a move on target synchronously and fires onComplete once", () => {
            reducedMotion = true;
            const onComplete = vi.fn();

            controller.animateMoveTo(100, 100, 500, onComplete);

            expect(setCenterMock).toHaveBeenCalledWith({ x: 100, y: 100 }, 800, 600);
            expect(onComplete).toHaveBeenCalledTimes(1);
            expect(controller.isAnimating()).toBe(false);

            // No frame was ever scheduled, so advancing time changes nothing.
            const calls = (setCenterMock as ReturnType<typeof vi.fn>).mock.calls.length;
            vi.advanceTimersByTime(1000);
            expect((setCenterMock as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
        });

        it("lands a zoom on the exact target scale synchronously", () => {
            reducedMotion = true;
            const onComplete = vi.fn();

            controller.animateZoomTo(4, 500, undefined, onComplete);

            expect(mockCamera.scale).toBe(4);
            expect(onComplete).toHaveBeenCalledTimes(1);
            expect(controller.isAnimating()).toBe(false);
        });

        it("applies a resize in one step", () => {
            reducedMotion = true;
            const onApplySize = vi.fn();
            const onComplete = vi.fn();

            controller.animateResize(1000, 800, 500, onApplySize, onComplete);

            expect(onApplySize).toHaveBeenCalledTimes(1);
            expect(onApplySize).toHaveBeenCalledWith(1000, 800, { x: 50, y: 50 });
            expect(onComplete).toHaveBeenCalledTimes(1);
        });

        it("still cancels an in-flight animation before applying", () => {
            controller.animateMoveTo(200, 200, 500);
            expect(controller.isAnimating()).toBe(true);

            reducedMotion = true;
            controller.animateMoveTo(100, 100, 500);

            expect(setCenterMock).toHaveBeenLastCalledWith({ x: 100, y: 100 }, 800, 600);
            expect(controller.isAnimating()).toBe(false);

            // The cancelled animation must not resume and drag the camera back.
            vi.advanceTimersByTime(1000);
            expect(setCenterMock).toHaveBeenLastCalledWith({ x: 100, y: 100 }, 800, 600);
        });

        it("still rejects a non-positive resize", () => {
            reducedMotion = true;
            const onApplySize = vi.fn();

            controller.animateResize(0, 100, 500, onApplySize);

            expect(onApplySize).not.toHaveBeenCalled();
        });

        it("ends on target when the preference flips mid-animation", () => {
            controller.animateMoveTo(100, 100, 500);
            vi.advanceTimersByTime(16);
            expect(controller.isAnimating()).toBe(true);

            reducedMotion = true;
            vi.advanceTimersByTime(16);

            expect(setCenterMock).toHaveBeenLastCalledWith({ x: 100, y: 100 }, 800, 600);
            expect(controller.isAnimating()).toBe(false);
        });
    });
});
