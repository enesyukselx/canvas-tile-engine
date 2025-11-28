import { Coords } from "../types";
import { ICamera } from "./Camera";
import { Config } from "./Config";
import { IRenderer } from "./Renderer/Renderer";
import { ViewportState } from "./ViewportState";

export class SizeController {
    private canvasWrapper: HTMLDivElement;
    private canvas: HTMLCanvasElement;
    private camera: ICamera;
    private viewport: ViewportState;
    private renderer: IRenderer;
    private config: Config;
    private resizeAnimationId: number | undefined;
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
     * Manually update canvas size (e.g., user-driven select). Keeps view centered.
     * @param width New canvas width in pixels.
     * @param height New canvas height in pixels.
     * @param durationMs Animation duration in ms (default 500). Use 0 for instant resize.
     */
    resize(width: number, height: number, durationMs: number = 500) {
        if (width <= 0 || height <= 0) {
            return;
        }

        const configSize = this.config.get().size;

        if (configSize && configSize.maxHeight && height > configSize.maxHeight) {
            height = configSize.maxHeight;
        }
        if (configSize && configSize.maxWidth && width > configSize.maxWidth) {
            width = configSize.maxWidth;
        }

        if (this.resizeAnimationId !== undefined) {
            cancelAnimationFrame(this.resizeAnimationId);
        }

        const prev = this.viewport.getSize();
        const center = this.camera.getCenter(prev.width, prev.height);
        if (durationMs <= 0) {
            this.applySize(width, height, center);
            this.resizeAnimationId = undefined;
            return;
        }

        const startW = prev.width;
        const startH = prev.height;
        const deltaW = width - prev.width;
        const deltaH = height - prev.height;

        const start = performance.now();

        const step = (now: number) => {
            const t = Math.min(1, (now - start) / durationMs);
            const nextW = startW + deltaW * t;
            const nextH = startH + deltaH * t;

            this.applySize(nextW, nextH, center);

            if (t < 1) {
                this.resizeAnimationId = requestAnimationFrame(step);
            } else {
                this.resizeAnimationId = undefined;
            }
        };

        this.resizeAnimationId = requestAnimationFrame(step);
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
