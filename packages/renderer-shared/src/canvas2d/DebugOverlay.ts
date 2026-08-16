import { Config, ICamera, ViewportState } from "@canvas-tile-engine/core";
import { computeHudLayout, FpsSampler, HUD_STYLE } from "../scene";
import type { Canvas2DContextLike } from "./types";

/**
 * Debug overlay: paints the HUD (coordinates, scale, tiles in view, FPS) on a
 * Canvas2D-style context. Used by the Canvas2D renderer directly and by the
 * WebGL renderer on its 2D overlay canvas.
 *
 * The readouts and their positions come from the shared {@link computeHudLayout}
 * so every renderer shows the same HUD; this class only paints what it returns.
 * @internal
 */
export class DebugOverlay<TContext extends Canvas2DContextLike> {
    private ctx: TContext;
    private camera: ICamera;
    private config: Config;
    private viewport: ViewportState;

    private fpsSampler = new FpsSampler();

    constructor(ctx: TContext, camera: ICamera, config: Config, viewport: ViewportState) {
        this.ctx = ctx;
        this.camera = camera;
        this.config = config;
        this.viewport = viewport;
    }

    /**
     * Set callback for FPS updates (triggers re-render)
     */
    setFpsUpdateCallback(callback: () => void) {
        this.fpsSampler.setUpdateCallback(callback);
    }

    /**
     * Start FPS monitoring loop
     */
    startFpsLoop() {
        this.fpsSampler.start();
    }

    /**
     * Stop FPS monitoring loop
     */
    stopFpsLoop() {
        this.fpsSampler.stop();
    }

    draw() {
        const layout = computeHudLayout(this.camera, this.config.get(), this.viewport.getSize(), this.fpsSampler.fps);

        if (!layout) {
            return;
        }

        this.ctx.save();

        this.ctx.fillStyle = HUD_STYLE.panelColor;
        this.ctx.fillRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height);

        this.ctx.fillStyle = HUD_STYLE.textColor;
        this.ctx.font = `${HUD_STYLE.fontSizePx}px monospace`;

        for (const line of layout.lines) {
            this.ctx.fillText(line.text, line.x, line.y);
        }

        this.ctx.restore();
    }

    /**
     * Stop FPS tracking and release callbacks.
     */
    destroy() {
        this.fpsSampler.destroy();
    }
}
