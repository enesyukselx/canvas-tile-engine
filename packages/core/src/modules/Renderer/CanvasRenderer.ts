import { Coords, onDrawCallback } from "../../types";
import { ICamera } from "../Camera";
import { Config } from "../Config";
import { CoordinateOverlayRenderer } from "../CoordinateOverlayRenderer";
import { CoordinateTransformer } from "../CoordinateTransformer";
import { CanvasDebug } from "../CanvasDebug";
import { Layer } from "../Layer";
import { ViewportState } from "../ViewportState";
import { IRenderer } from "./Renderer";

/**
 * Canvas-based renderer that draws engine layers, user callbacks, and coordinate overlays.
 * Supports HiDPI/Retina displays via devicePixelRatio scaling.
 * @internal
 */
export class CanvasRenderer implements IRenderer {
    private ctx: CanvasRenderingContext2D;
    private coordinateOverlayRenderer: CoordinateOverlayRenderer;
    private debugOverlay?: CanvasDebug;

    /** Optional user-provided draw hook executed after engine layers. */
    public onDraw?: onDrawCallback;

    /**
     * @param canvas Target canvas element.
     * @param camera Active camera.
     * @param coordinateTransformer World/screen transformer shared with layers.
     * @param config Normalized engine configuration store.
     * @param layers Layer manager whose callbacks are drawn in order.
     */
    constructor(
        private canvas: HTMLCanvasElement,
        private camera: ICamera,
        private coordinateTransformer: CoordinateTransformer,
        private config: Config,
        private viewport: ViewportState,
        private layers: Layer
    ) {
        const context = canvas.getContext("2d");
        if (!context) {
            throw new Error("Failed to get 2D canvas context");
        }

        this.ctx = context;
        this.applyCanvasSize();
        this.coordinateOverlayRenderer = new CoordinateOverlayRenderer(
            this.ctx,
            this.camera,
            this.config,
            this.viewport
        );
        if (this.config.get().debug?.enabled) {
            this.debugOverlay = new CanvasDebug(
                this.ctx,
                this.camera,
                this.coordinateTransformer,
                this.config,
                this.viewport
            );
            // Start FPS loop if fps hud is enabled
            if (this.config.get().debug?.hud?.fps) {
                this.debugOverlay.setFpsUpdateCallback(() => this.render());
                this.debugOverlay.startFpsLoop();
            }
        }
    }

    init(): void {
        this.applyCanvasSize();
    }

    private applyCanvasSize() {
        const size = this.viewport.getSize();
        const dpr = this.viewport.dpr;

        // Set actual canvas resolution (physical pixels)
        this.canvas.width = size.width * dpr;
        this.canvas.height = size.height * dpr;

        // Set display size via CSS (logical pixels)
        this.canvas.style.width = `${size.width}px`;
        this.canvas.style.height = `${size.height}px`;

        // Scale context to match DPR
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    render(): void {
        const size = this.viewport.getSize();
        const dpr = this.viewport.dpr;
        const config = { ...this.config.get(), size: { ...size }, scale: this.camera.scale };
        const topLeft: Coords = { x: this.camera.x, y: this.camera.y };

        // Reset transform for HiDPI support (canvas.width/height changes reset transform)
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear background
        this.ctx.clearRect(0, 0, config.size.width, config.size.height);
        this.ctx.fillStyle = config.backgroundColor;
        this.ctx.fillRect(0, 0, config.size.width, config.size.height);

        // Draw engine layers
        this.layers.drawAll({
            ctx: this.ctx,
            camera: this.camera,
            transformer: this.coordinateTransformer,
            config,
            topLeft,
        });

        // User custom draw callback (optional)
        this.onDraw?.(this.ctx, {
            scale: this.camera.scale,
            width: config.size.width,
            height: config.size.height,
            coords: topLeft,
        });

        // Coordinate overlay
        if (this.coordinateOverlayRenderer.shouldDraw(this.camera.scale)) {
            this.coordinateOverlayRenderer.draw();
        }

        // Debug overlay
        if (config.debug?.enabled) {
            if (!this.debugOverlay) {
                this.debugOverlay = new CanvasDebug(
                    this.ctx,
                    this.camera,
                    this.coordinateTransformer,
                    this.config,
                    this.viewport
                );
                // Start FPS loop if fps hud is enabled
                if (config.debug?.hud?.fps) {
                    this.debugOverlay.setFpsUpdateCallback(() => this.render());
                    this.debugOverlay.startFpsLoop();
                }
            }
            this.debugOverlay.draw();
        }
    }

    resize(width: number, height: number): void {
        const dpr = this.viewport.dpr;

        this.viewport.setSize(width, height);

        // Set actual canvas resolution (physical pixels)
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;

        // Set display size via CSS (logical pixels)
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        // Scale context to match DPR
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    destroy(): void {
        //
    }

    /** Access the underlying 2D rendering context for advanced usage. */
    getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }
}
