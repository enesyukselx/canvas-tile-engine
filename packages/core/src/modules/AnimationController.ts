import { Coords } from "../types";
import { ICamera } from "./Camera";
import { ViewportState } from "./ViewportState";
import { DEFAULT_VALUES } from "../constants";

/**
 * Whether frame scheduling is available. Headless environments (e.g. the
 * server renderer under Node) have no requestAnimationFrame; animations
 * complete instantly there instead of crashing.
 */
function canAnimate(): boolean {
    return typeof requestAnimationFrame === "function";
}

/**
 * Manages smooth animations for camera movements, zooming, and canvas resizing.
 * Handles animation frame scheduling and cleanup.
 */
export class AnimationController {
    private moveAnimationId?: number;
    private zoomAnimationId?: number;
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

        // Instant move if duration is 0/negative or frames can't be scheduled
        if (durationMs <= 0 || !canAnimate()) {
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
     * Smoothly animate the camera scale to a target value, anchored at the
     * viewport center (matching zoomIn/zoomOut).
     * @param targetScale Target scale. Callers should pre-clamp it to the camera's limits so the animation ends exactly at the effective value.
     * @param durationMs Animation duration in milliseconds (default: 500ms). Set to 0 for instant change.
     * @param onZoomFrame Optional callback fired after each scale step with the scale before the step, for zoom-change notifications.
     * @param onComplete Optional callback fired when animation completes.
     */
    animateZoomTo(
        targetScale: number,
        durationMs: number = DEFAULT_VALUES.ANIMATION_DURATION_MS,
        onZoomFrame?: (prevScale: number) => void,
        onComplete?: () => void,
    ) {
        // Cancel any existing zoom animation
        this.cancelZoom();

        // Re-center after setScale because the camera anchors scale changes at
        // the top-left corner. Reading the center each frame (instead of
        // pinning it once) lets a concurrent move animation keep working.
        const applyScale = (scale: number) => {
            const size = this.viewport.getSize();
            const center = this.camera.getCenter(size.width, size.height);
            const prevScale = this.camera.scale;
            this.camera.setScale(scale);
            this.camera.setCenter(center, size.width, size.height);
            onZoomFrame?.(prevScale);
            this.onAnimationFrame();
        };

        // Instant change if duration is 0/negative or frames can't be scheduled
        if (durationMs <= 0 || !canAnimate()) {
            applyScale(targetScale);
            onComplete?.();
            return;
        }

        const startScale = this.camera.scale;
        const startTime = performance.now();

        const step = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(1, elapsed / durationMs);

            // Easing function (ease-in-out)
            const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;

            // Geometric interpolation: zoom speed is perceptually uniform
            // (linear interpolation front-loads the zoom-in half).
            applyScale(startScale * Math.pow(targetScale / startScale, eased));

            if (progress < 1) {
                this.zoomAnimationId = requestAnimationFrame(step);
            } else {
                this.zoomAnimationId = undefined;
                onComplete?.();
            }
        };

        this.zoomAnimationId = requestAnimationFrame(step);
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

        // Instant resize if duration is 0/negative or frames can't be scheduled
        if (durationMs <= 0 || !canAnimate()) {
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
     * Cancel the current zoom animation if running.
     */
    cancelZoom() {
        if (this.zoomAnimationId !== undefined) {
            cancelAnimationFrame(this.zoomAnimationId);
            this.zoomAnimationId = undefined;
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
        this.cancelZoom();
        this.cancelResize();
    }

    /**
     * Check if any animation is currently running.
     */
    isAnimating(): boolean {
        return (
            this.moveAnimationId !== undefined ||
            this.zoomAnimationId !== undefined ||
            this.resizeAnimationId !== undefined
        );
    }
}
