import { ICamera } from "./Camera";
import { Config } from "./Config";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { ViewportState } from "./ViewportState";
import { DEBUG_HUD, DEFAULT_VALUES } from "../constants";

const FPS_SAMPLE_SIZE = 10;

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

    // FPS tracking (runs continuously via rAF)
    private frameTimes: number[] = [];
    private lastFrameTime = 0;
    private currentFps = 0;
    private fpsLoopRunning = false;
    private onFpsUpdate: (() => void) | null = null;

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

    /**
     * Set callback for FPS updates (triggers re-render)
     */
    setFpsUpdateCallback(callback: () => void) {
        this.onFpsUpdate = callback;
    }

    /**
     * Start FPS monitoring loop
     */
    startFpsLoop() {
        if (this.fpsLoopRunning) return;
        this.fpsLoopRunning = true;
        this.lastFrameTime = performance.now();
        this.fpsLoop();
    }

    /**
     * Stop FPS monitoring loop
     */
    stopFpsLoop() {
        this.fpsLoopRunning = false;
    }

    private fpsLoop() {
        if (!this.fpsLoopRunning) return;

        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.frameTimes.push(delta);
        if (this.frameTimes.length > FPS_SAMPLE_SIZE) {
            this.frameTimes.shift();
        }

        const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        const newFps = Math.round(1000 / avgDelta);

        // Only trigger update if FPS changed
        if (newFps !== this.currentFps) {
            this.currentFps = newFps;
            this.onFpsUpdate?.();
        }

        requestAnimationFrame(() => this.fpsLoop());
    }

    draw() {
        this.drawHud();
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

        if (config.debug.hud.fps) {
            datas.push(`FPS: ${this.currentFps}`);
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
