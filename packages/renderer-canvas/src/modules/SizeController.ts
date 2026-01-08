import { AnimationController, Config, Coords, ICamera, ViewportState } from "@canvas-tile-engine/core";

/**
 * Controls canvas size and handles resize animations.
 * Manages DOM manipulation for wrapper and canvas elements.
 */
export class SizeController {
    constructor(
        private canvasWrapper: HTMLDivElement,
        private canvas: HTMLCanvasElement,
        private camera: ICamera,
        private viewport: ViewportState,
        private config: Config,
        private onRender: () => void
    ) {}

    /**
     * Manually update canvas size using AnimationController for smooth transitions.
     * @param width New canvas width in pixels.
     * @param height New canvas height in pixels.
     * @param durationMs Animation duration in ms (default 500). Use 0 for instant resize.
     * @param animationController AnimationController instance to handle the animation.
     * @param onComplete Optional callback fired when resize animation completes.
     */
    resizeWithAnimation(
        width: number,
        height: number,
        durationMs: number,
        animationController: AnimationController,
        onComplete?: () => void
    ) {
        if (width <= 0 || height <= 0) {
            return;
        }

        const configSize = this.config.get().size;
        const clamp = (value: number, min?: number, max?: number) => {
            let result = value;
            if (min !== undefined) {
                result = Math.max(min, result);
            }
            if (max !== undefined) {
                result = Math.min(max, result);
            }
            return result;
        };

        // Clamp to min/max values
        width = clamp(width, configSize?.minWidth, configSize?.maxWidth);
        height = clamp(height, configSize?.minHeight, configSize?.maxHeight);

        // Delegate to AnimationController
        animationController.animateResize(
            width,
            height,
            durationMs,
            (w: number, h: number, center: Coords) => this.applySize(w, h, center),
            onComplete
        );
    }

    /**
     * Apply size directly without animation.
     * @param width New canvas width in pixels.
     * @param height New canvas height in pixels.
     * @param center Center coordinates to maintain after resize.
     */
    applySize(width: number, height: number, center: Coords) {
        const roundedW = Math.round(width);
        const roundedH = Math.round(height);
        const dpr = this.viewport.dpr;

        this.viewport.setSize(roundedW, roundedH);

        // CSS size (logical pixels)
        this.canvasWrapper.style.width = `${roundedW}px`;
        this.canvasWrapper.style.height = `${roundedH}px`;

        // Canvas resolution (physical pixels for HiDPI)
        this.canvas.width = roundedW * dpr;
        this.canvas.height = roundedH * dpr;
        this.canvas.style.width = `${roundedW}px`;
        this.canvas.style.height = `${roundedH}px`;

        this.camera.setCenter(center, roundedW, roundedH);
        this.onRender();
    }
}
