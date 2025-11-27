import type { CanvasGridMapDrawCallback, Coords } from "../types";
import { Camera } from "./Camera";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { LayerManager } from "./LayerManager";
import { ConfigManager } from "./ConfigManager";
import { CoordinateOverlay } from "./CoordinateOverlay";

export class Renderer {
    private ctx: CanvasRenderingContext2D;
    private coordinateOverlay: CoordinateOverlay;
    public onDraw?: CanvasGridMapDrawCallback;

    constructor(
        private canvas: HTMLCanvasElement,
        private camera: Camera,
        private transformer: CoordinateTransformer,
        private configManager: ConfigManager,
        private layers: LayerManager
    ) {
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Failed to get 2D context");
        this.ctx = ctx;

        const config = this.configManager.get();
        this.canvas.width = config.size.width;
        this.canvas.height = config.size.height;
        this.coordinateOverlay = new CoordinateOverlay(this.ctx, this.camera, config);
    }

    getContext(): CanvasRenderingContext2D {
        return this.ctx;
    }

    render() {
        const config = this.configManager.get();
        const topLeft: Coords = { x: this.camera.x, y: this.camera.y };

        // Clear + background
        this.ctx.clearRect(0, 0, config.size.width, config.size.height);
        this.ctx.fillStyle = config.backgroundColor;
        this.ctx.fillRect(0, 0, config.size.width, config.size.height);

        // Layers
        this.layers.drawAll({
            ctx: this.ctx,
            camera: this.camera,
            transformer: this.transformer,
            config,
            topLeft,
        });

        // User defined draw
        if (this.onDraw) {
            this.onDraw(this.ctx, {
                scale: this.camera.scale,
                width: config.size.width,
                height: config.size.height,
                coords: topLeft,
            });
        }

        // Coordinates overlay
        if (config.showCoordinates && this.camera.scale >= config.minScaleShowCoordinates) {
            this.coordinateOverlay.draw();
        }
    }
}
