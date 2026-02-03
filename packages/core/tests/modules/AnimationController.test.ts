import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { AnimationController } from "../../src/modules/AnimationController";
import { ICamera } from "../../src/modules/Camera";
import { ViewportState } from "../../src/modules/ViewportState";
import { Coords } from "../../src/types";

describe("AnimationController", () => {
    let mockCamera: ICamera;
    let viewport: ViewportState;
    let onAnimationFrame: () => void;
    let controller: AnimationController;
    let setCenterMock: (center: Coords, canvasWidth: number, canvasHeight: number) => void;

    beforeEach(() => {
        vi.useFakeTimers();

        setCenterMock = vi.fn();
        mockCamera = {
            x: 0,
            y: 0,
            scale: 1,
            pan: vi.fn(),
            zoom: vi.fn(),
            zoomByFactor: vi.fn(),
            getCenter: vi.fn(() => ({ x: 50, y: 50 })),
            setCenter: setCenterMock,
            adjustForResize: vi.fn(),
            setScale: vi.fn(),
            getVisibleBounds: vi.fn(() => ({ minX: 0, maxX: 100, minY: 0, maxY: 100 })),
        };

        viewport = new ViewportState(800, 600);
        onAnimationFrame = vi.fn();
        controller = new AnimationController(mockCamera, viewport, onAnimationFrame);

        // Mock requestAnimationFrame
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
        it("cancels both move and resize animations", () => {
            const cancelAnimationFrame = vi.fn();
            vi.stubGlobal("cancelAnimationFrame", cancelAnimationFrame);

            controller.animateMoveTo(100, 100, 500);
            controller.animateResize(1024, 768, 500, vi.fn());
            controller.cancelAll();

            expect(cancelAnimationFrame).toHaveBeenCalledTimes(2);
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
});
