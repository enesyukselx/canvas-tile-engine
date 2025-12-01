import { ICamera } from "./Camera";
import { Config } from "./Config";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { ViewportState } from "./ViewportState";
import { DEBUG_HUD } from "../constants";

/**
 * Canvas-only debug overlay: draws grid and HUD information.
 * @internal
 */
export class CanvasDebug {
    private ctx: CanvasRenderingContext2D;
    private camera: ICamera;
    private transformer: CoordinateTransformer;
    private config: Config;
    private viewport: ViewportState;

    constructor(
        ctx: CanvasRenderingContext2D,
        camera: ICamera,
        transformer: CoordinateTransformer,
        config: Config,
        viewport: ViewportState
    ) {
        this.ctx = ctx;
        this.camera = camera;
        this.transformer = transformer;
        this.config = config;
        this.viewport = viewport;
    }

    draw() {
        this.drawGrid();
        this.drawHud();
    }

    private drawGrid() {
        const config = this.config.get();

        if (!config.debug.grid?.enabled) {
            return;
        }

        const tile = this.camera.scale;
        const { width, height } = this.viewport.getSize();
        const camX = this.camera.x;
        const camY = this.camera.y;

        const left = Math.floor(camX);
        const right = Math.ceil(camX + width / tile);
        const top = Math.floor(camY);
        const bottom = Math.ceil(camY + height / tile);

        this.ctx.strokeStyle = config.debug.grid?.color ?? "rgba(255,255,255,0.25)";
        this.ctx.lineWidth = config.debug.grid?.lineWidth ?? 1;

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

        if (!config.debug.hud.enabled) {
            return;
        }

        const datas = [];

        const topLeft = { x: this.camera.x, y: this.camera.y };

        if (config.debug.hud.topLeftCoordinates) {
            datas.push(`TopLeft: ${topLeft.x.toFixed(2)}, ${topLeft.y.toFixed(2)}`);
        }

        if (config.debug.hud.coordinates) {
            const { width, height } = this.viewport.getSize();
            const center = this.camera.getCenter(width, height);
            datas.push(`Coords: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}`);
        }

        if (config.debug.hud.scale) {
            datas.push(`Scale: ${this.camera.scale.toFixed(2)}`);
        }

        if (config.debug.hud.tilesInView) {
            const { width, height } = this.viewport.getSize();
            datas.push(
                `Tiles in view: ${Math.ceil(width / this.camera.scale)} x ${Math.ceil(height / this.camera.scale)}`
            );
        }

        const { width } = this.viewport.getSize();

        this.ctx.save();
        this.ctx.fillStyle = "rgba(0,0,0,0.5)";
        this.ctx.fillRect(
            width - DEBUG_HUD.PANEL_WIDTH - DEBUG_HUD.PADDING,
            DEBUG_HUD.PADDING / 2,
            DEBUG_HUD.PANEL_WIDTH,
            datas.length * DEBUG_HUD.LINE_HEIGHT + DEBUG_HUD.PADDING
        );

        this.ctx.fillStyle = "#00ff99";
        this.ctx.font = "12px monospace";

        for (let i = 0; i < datas.length; i++) {
            this.ctx.fillText(
                datas[i],
                width - DEBUG_HUD.PANEL_WIDTH - DEBUG_HUD.PADDING + 5,
                18 + i * DEBUG_HUD.LINE_HEIGHT
            );
        }

        this.ctx.restore();
    }
}
