import { Coords } from "../types";
import { ICamera } from "./Camera";
import { ViewportState } from "./ViewportState";
import { DEFAULT_VALUES } from "../constants";

/**
 * Manages smooth animations for camera movements and canvas resizing.
 * Handles animation frame scheduling and cleanup.
 */
export class AnimationController {
    private moveAnimationId?: number;
    private resizeAnimationId?: number;

    constructor(
        private camera: ICamera,
        private viewport: ViewportState,
        private onAnimationFrame: () => void,
    ) {}

    /**
     * Smoothly animate camera movement to target coordinates.
     * @param targetX Target world x coordinate.
     * @param targetY Target world y coordinate.
     * @param durationMs Animation duration in milliseconds (default: 500ms). Set to 0 for instant move.
     * @param onComplete Optional callback fired when animation completes.
     */
    animateMoveTo(
        targetX: number,
        targetY: number,
        durationMs: number = DEFAULT_VALUES.ANIMATION_DURATION_MS,
        onComplete?: () => void,
    ) {
        // Cancel any existing move animation
        this.cancelMove();

        // Instant move if duration is 0 or negative
        if (durationMs <= 0) {
            const size = this.viewport.getSize();
            this.camera.setCenter({ x: targetX, y: targetY }, size.width, size.height);
            this.onAnimationFrame();
            onComplete?.();
            return;
        }

        const size = this.viewport.getSize();
        const start = this.camera.getCenter(size.width, size.height);
        const startTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / durationMs);

            // Easing function (ease-in-out)
            const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            const currentX = start.x + (targetX - start.x) * eased;
            const currentY = start.y + (targetY - start.y) * eased;

            const size = this.viewport.getSize();
            this.camera.setCenter({ x: currentX, y: currentY }, size.width, size.height);
            this.onAnimationFrame();

            if (progress < 1) {
                this.moveAnimationId = requestAnimationFrame(step);
            } else {
                this.moveAnimationId = undefined;
                onComplete?.();
            }
        };

        this.moveAnimationId = requestAnimationFrame(step);
    }

    /**
     * Smoothly animate canvas size change while keeping view centered.
     * @param targetWidth New canvas width in pixels.
     * @param targetHeight New canvas height in pixels.
     * @param durationMs Animation duration in milliseconds (default: 500ms). Set to 0 for instant resize.
     * @param onApplySize Callback to apply the new size (updates wrapper, canvas, renderer).
     * @param onComplete Optional callback fired when animation completes.
     */
    animateResize(
        targetWidth: number,
        targetHeight: number,
        durationMs: number = DEFAULT_VALUES.ANIMATION_DURATION_MS,
        onApplySize: (width: number, height: number, center: Coords) => void,
        onComplete?: () => void,
    ) {
        if (targetWidth <= 0 || targetHeight <= 0) {
            return;
        }

        // Cancel any existing resize animation
        this.cancelResize();

        const prev = this.viewport.getSize();
        const center = this.camera.getCenter(prev.width, prev.height);

        // Instant resize if duration is 0 or negative
        if (durationMs <= 0) {
            onApplySize(targetWidth, targetHeight, center);
            onComplete?.();
            return;
        }

        const startW = prev.width;
        const startH = prev.height;
        const deltaW = targetWidth - prev.width;
        const deltaH = targetHeight - prev.height;
        const startTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / durationMs);

            const nextW = startW + deltaW * progress;
            const nextH = startH + deltaH * progress;

            onApplySize(nextW, nextH, center);

            if (progress < 1) {
                this.resizeAnimationId = requestAnimationFrame(step);
            } else {
                this.resizeAnimationId = undefined;
                onComplete?.();
            }
        };

        this.resizeAnimationId = requestAnimationFrame(step);
    }

    /**
     * Cancel the current move animation if running.
     */
    cancelMove() {
        if (this.moveAnimationId !== undefined) {
            cancelAnimationFrame(this.moveAnimationId);
            this.moveAnimationId = undefined;
        }
    }

    /**
     * Cancel the current resize animation if running.
     */
    cancelResize() {
        if (this.resizeAnimationId !== undefined) {
            cancelAnimationFrame(this.resizeAnimationId);
            this.resizeAnimationId = undefined;
        }
    }

    /**
     * Cancel all running animations.
     */
    cancelAll() {
        this.cancelMove();
        this.cancelResize();
    }

    /**
     * Check if any animation is currently running.
     */
    isAnimating(): boolean {
        return this.moveAnimationId !== undefined || this.resizeAnimationId !== undefined;
    }
}
