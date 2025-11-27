import { ICamera } from "./Camera";
import { Config } from "./Config";
import { CoordinateTransformer } from "./CoordinateTransformer";

/**
 * Canvas-only debug overlay: draws grid and HUD information.
 * @internal
 */
export class CanvasDebug {
    private ctx: CanvasRenderingContext2D;
    private camera: ICamera;
    private transformer: CoordinateTransformer;
    private config: Config;

    constructor(ctx: CanvasRenderingContext2D, camera: ICamera, transformer: CoordinateTransformer, config: Config) {
        this.ctx = ctx;
        this.camera = camera;
        this.transformer = transformer;
        this.config = config;
    }

    draw() {
        this.drawGrid();
        this.drawHud();
    }

    private drawGrid() {
        const tile = this.camera.scale;

        const left = Math.floor(this.camera.x);
        const right = Math.ceil(this.camera.x + this.config.get().size.width / tile);
        const top = Math.floor(this.camera.y);
        const bottom = Math.ceil(this.camera.y + this.config.get().size.height / tile);

        this.ctx.strokeStyle = "rgba(255,255,255,0.25)";
        this.ctx.lineWidth = 1;

        for (let gx = left; gx <= right; gx++) {
            for (let gy = top; gy <= bottom; gy++) {
                const topLeft = this.transformer.worldToScreen(gx - 0.5, gy - 0.5);
                this.ctx.strokeRect(topLeft.x, topLeft.y, tile, tile);
            }
        }
    }

    private drawHud() {
        const config = this.config.get();

        if (!config.debug.hud) {
            return;
        }

        const datas = [];

        const topLeft = { x: this.camera.x, y: this.camera.y };

        if (config.debug.hud.topLeftCoordinates) {
            datas.push(`TopLeft: ${topLeft.x.toFixed(2)}, ${topLeft.y.toFixed(2)}`);
        }

        if (config.debug.hud.coordinates) {
            const center = this.camera.getCenter(config.size.width, config.size.height);
            datas.push(`Coords: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}`);
        }

        if (config.debug.hud.scale) {
            datas.push(`Scale: ${this.camera.scale.toFixed(2)}`);
        }

        if (config.debug.hud.tilesInView) {
            datas.push(
                `Tiles in view: ${Math.ceil(config.size.width / this.camera.scale)} x ${Math.ceil(
                    config.size.height / this.camera.scale
                )}`
            );
        }

        const panelWidth = 160;
        const margin = 8;

        this.ctx.save();
        this.ctx.fillStyle = "rgba(0,0,0,0.5)";
        this.ctx.fillRect(config.size.width - panelWidth - margin, margin / 2, panelWidth, datas.length * 14 + margin);

        this.ctx.fillStyle = "#00ff99";
        this.ctx.font = "12px monospace";

        for (let i = 0; i < datas.length; i++) {
            this.ctx.fillText(datas[i], config.size.width - panelWidth - margin + 5, 18 + i * 14);
        }

        this.ctx.restore();
    }
}
