import { type Config, type ICamera, type ViewportState } from "@canvas-tile-engine/core";
import { computeHudLayout, FpsSampler, HUD_STYLE } from "@canvas-tile-engine/renderer-shared/scene";
import { matchFont, Skia, type SkCanvas, type SkFont, type SkPaint } from "@shopify/react-native-skia";
import { DEFAULT_MONOSPACE } from "../utils/fonts";

// The React Native canvas usually extends edge-to-edge under the status bar /
// notch, which would hide a HUD anchored to the very top — push it below.
const HUD_TOP_OFFSET = 50;

/**
 * Skia debug overlay: paints the HUD (mirrors the Canvas2D `DebugOverlay`).
 *
 * The readouts, their positions and the FPS sampling all come from the shared
 * scene modules; this class only paints what {@link computeHudLayout} returns,
 * shifted down by {@link HUD_TOP_OFFSET}.
 *
 * The canvas is handed in fresh per frame via {@link draw} rather than held
 * on the instance, since Skia records each frame into a new picture.
 * @internal
 */
export class SkiaDebug {
    private panelPaint: SkPaint;
    private textPaint: SkPaint;
    private font: SkFont;

    private fpsSampler = new FpsSampler();

    constructor(
        private camera: ICamera,
        private config: Config,
        private viewport: ViewportState,
    ) {
        this.panelPaint = Skia.Paint();
        this.panelPaint.setColor(Skia.Color(HUD_STYLE.panelColor));

        this.textPaint = Skia.Paint();
        this.textPaint.setAntiAlias(true);
        this.textPaint.setColor(Skia.Color(HUD_STYLE.textColor));

        this.font = matchFont({ fontFamily: DEFAULT_MONOSPACE, fontSize: HUD_STYLE.fontSizePx });
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

    draw(canvas: SkCanvas) {
        const layout = computeHudLayout(
            this.camera,
            this.config.get(),
            this.viewport.getSize(),
            this.fpsSampler.fps,
            HUD_TOP_OFFSET,
        );

        if (!layout) {
            return;
        }

        canvas.drawRect(
            Skia.XYWHRect(layout.panel.x, layout.panel.y, layout.panel.width, layout.panel.height),
            this.panelPaint,
        );

        for (const line of layout.lines) {
            canvas.drawText(line.text, line.x, line.y, this.textPaint, this.font);
        }
    }

    /**
     * Stop FPS tracking and release callbacks.
     */
    destroy() {
        this.fpsSampler.destroy();
    }
}
