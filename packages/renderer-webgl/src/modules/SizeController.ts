import { AnimationController, Config, Coords, ICamera, ViewportState } from "@canvas-tile-engine/core";

/**
 * Controls canvas size and handles resize animations.
 * Keeps both the WebGL canvas and the 2D overlay canvas in sync.
 * @internal
 */
export class SizeController {
    constructor(
        private canvasWrapper: HTMLDivElement,
        private canvas: HTMLCanvasElement,
        private overlay: HTMLCanvasElement,
        private camera: ICamera,
        private viewport: ViewportState,
        private config: Config,
        private onRender: () => void
    ) {}

    /**
     * Manually update canvas size using AnimationController for smooth transitions.
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

        width = clamp(width, configSize?.minWidth, configSize?.maxWidth);
        height = clamp(height, configSize?.minHeight, configSize?.maxHeight);

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
     */
    applySize(width: number, height: number, center: Coords) {
        const roundedW = Math.round(width);
        const roundedH = Math.round(height);
        const dpr = this.viewport.dpr;

        this.viewport.setSize(roundedW, roundedH);

        this.canvasWrapper.style.width = `${roundedW}px`;
        this.canvasWrapper.style.height = `${roundedH}px`;

        for (const el of [this.canvas, this.overlay]) {
            el.width = roundedW * dpr;
            el.height = roundedH * dpr;
            el.style.width = `${roundedW}px`;
            el.style.height = `${roundedH}px`;
        }

        this.camera.setCenter(center, roundedW, roundedH);
        this.onRender();
    }
}
