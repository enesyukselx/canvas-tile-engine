import { DEBUG_HUD, type Config, type ICamera, type ViewportState } from "@canvas-tile-engine/core";
import { matchFont, Skia, type SkCanvas, type SkFont, type SkPaint } from "@shopify/react-native-skia";
import { DEFAULT_MONOSPACE } from "../utils/fonts";

const FPS_SAMPLE_SIZE = 10;

// The React Native canvas usually extends edge-to-edge under the status bar /
// notch, which would hide a HUD anchored to the very top — push it below.
const HUD_TOP_OFFSET = 50;

/**
 * Skia debug overlay: draws HUD information (mirrors the Canvas2D `CanvasDebug`).
 *
 * The canvas is handed in fresh per frame via {@link draw} rather than held
 * on the instance, since Skia records each frame into a new picture.
 * @internal
 */
export class SkiaDebug {
    private panelPaint: SkPaint;
    private textPaint: SkPaint;
    private font: SkFont;

    // FPS tracking (runs continuously via rAF)
    private frameTimes: number[] = [];
    private lastFrameTime = 0;
    private currentFps = 0;
    private fpsLoopRunning = false;
    private onFpsUpdate: (() => void) | null = null;

    constructor(
        private camera: ICamera,
        private config: Config,
        private viewport: ViewportState,
    ) {
        this.panelPaint = Skia.Paint();
        this.panelPaint.setColor(Skia.Color("rgba(0, 0, 0, 0.5)"));

        this.textPaint = Skia.Paint();
        this.textPaint.setAntiAlias(true);
        this.textPaint.setColor(Skia.Color("#00ff99"));

        this.font = matchFont({ fontFamily: DEFAULT_MONOSPACE, fontSize: 12 });
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

    draw(canvas: SkCanvas) {
        this.drawHud(canvas);
    }

    /**
     * Stop FPS tracking and release callbacks.
     */
    destroy() {
        this.stopFpsLoop();
        this.onFpsUpdate = null;
    }

    private drawHud(canvas: SkCanvas) {
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
                `Tiles in view: ${Math.ceil(width / this.camera.scale)} x ${Math.ceil(height / this.camera.scale)}`,
            );
        }

        if (config.debug.hud.fps) {
            datas.push(`FPS: ${this.currentFps}`);
        }

        const { width } = this.viewport.getSize();

        canvas.drawRect(
            Skia.XYWHRect(
                width - DEBUG_HUD.PANEL_WIDTH - DEBUG_HUD.PADDING,
                HUD_TOP_OFFSET + DEBUG_HUD.PADDING / 2,
                DEBUG_HUD.PANEL_WIDTH,
                datas.length * DEBUG_HUD.LINE_HEIGHT + DEBUG_HUD.PADDING,
            ),
            this.panelPaint,
        );

        for (let i = 0; i < datas.length; i++) {
            canvas.drawText(
                datas[i],
                width - DEBUG_HUD.PANEL_WIDTH - DEBUG_HUD.PADDING + 5,
                HUD_TOP_OFFSET + 18 + i * DEBUG_HUD.LINE_HEIGHT,
                this.textPaint,
                this.font,
            );
        }
    }
}
