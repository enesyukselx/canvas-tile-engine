import { Coords } from "../types";
import { ICamera } from "./Camera";
import { Config } from "./Config";
import { IRenderer } from "./Renderer/Renderer";
import { ViewportState } from "./ViewportState";
import { AnimationController } from "./AnimationController";

export class SizeController {
    private canvasWrapper: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private camera: ICamera;
    private viewport: ViewportState;
    private renderer: IRenderer;
    private config: Config;
    private onSizeApplied: () => void;

    constructor(
        canvasWrapper: HTMLDivElement,
        canvas: HTMLCanvasElement,
        camera: ICamera,
        renderer: IRenderer,
        viewport: ViewportState,

        config: Config,
        onSizeApplied: () => void
    ) {
        this.canvasWrapper = canvasWrapper;
        this.canvas = canvas;
        this.camera = camera;
        this.renderer = renderer;
        this.viewport = viewport;
        this.config = config;
        this.onSizeApplied = onSizeApplied;
    }

    /**
     * Manually update canvas size using AnimationController for smooth transitions.
     * @param width New canvas width in pixels.
     * @param height New canvas height in pixels.
     * @param durationMs Animation duration in ms (default 500). Use 0 for instant resize.
     * @param animationController AnimationController instance to handle the animation.
     */
    resizeWithAnimation(width: number, height: number, durationMs: number, animationController: AnimationController) {
        if (width <= 0 || height <= 0) {
            return;
        }

        const configSize = this.config.get().size;

        // Clamp to max values
        if (configSize && configSize.maxHeight && height > configSize.maxHeight) {
            height = configSize.maxHeight;
        }
        if (configSize && configSize.maxWidth && width > configSize.maxWidth) {
            width = configSize.maxWidth;
        }

        // Delegate to AnimationController
        animationController.animateResize(width, height, durationMs, (w, h, center) => this.applySize(w, h, center));
    }

    private applySize(nextW: number, nextH: number, center: Coords) {
        const roundedW = Math.round(nextW);
        const roundedH = Math.round(nextH);

        this.viewport.setSize(roundedW, roundedH);

        this.canvasWrapper.style.width = `${roundedW}px`;
        this.canvasWrapper.style.height = `${roundedH}px`;
        this.canvas.width = roundedW;
        this.canvas.height = roundedH;
        this.camera.setCenter(center, roundedW, roundedH);
        this.renderer.resize(roundedW, roundedH);
        this.onSizeApplied();
    }
}
