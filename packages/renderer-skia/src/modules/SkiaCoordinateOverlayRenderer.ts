import { type Config, type ICamera, type ViewportState } from "@canvas-tile-engine/core";
import {
    COORDINATE_OVERLAY_STYLE,
    coordinateOverlayBorders,
    coordinateOverlayFontSize,
    forEachCoordinateLabel,
    shouldDrawCoordinateOverlay,
} from "@canvas-tile-engine/renderer-shared/scene";
import { Skia, matchFont, type SkCanvas, type SkFont, type SkPaint } from "@shopify/react-native-skia";
import { DEFAULT_SANS_SERIF } from "../utils/fonts";

/**
 * Renders a coordinate overlay (axes and labels) on top of the canvas.
 *
 * Mirrors the Canvas2D `CoordinateOverlayRenderer`, and shares its layout:
 * border geometry, font sizing and label positions come from the shared scene
 * modules, leaving this class to paint them. Unlike the DOM backend there is
 * no persistent 2D context to hold paints against; the canvas is handed in
 * fresh per frame via {@link draw}, so paints/fonts are cached on the instance
 * instead.
 * @internal
 */
export class SkiaCoordinateOverlayRenderer {
    private borderPaint: SkPaint;
    private textPaint: SkPaint;
    private font?: SkFont;

    constructor(
        private camera: ICamera,
        private config: Config,
        private viewport: ViewportState,
    ) {
        this.borderPaint = Skia.Paint();
        this.borderPaint.setColor(Skia.Color(COORDINATE_OVERLAY_STYLE.borderColor));

        this.textPaint = Skia.Paint();
        this.textPaint.setAntiAlias(true);
        this.textPaint.setColor(Skia.Color(COORDINATE_OVERLAY_STYLE.textColor));
    }

    /**
     * Draw overlay borders and coordinate labels based on current camera view.
     */
    draw(canvas: SkCanvas) {
        const size = this.viewport.getSize();
        const { left, bottom } = coordinateOverlayBorders(size);

        canvas.drawRect(Skia.XYWHRect(left.x, left.y, left.width, left.height), this.borderPaint);
        canvas.drawRect(Skia.XYWHRect(bottom.x, bottom.y, bottom.width, bottom.height), this.borderPaint);

        const font = this.getFont(coordinateOverlayFontSize(this.camera.scale));

        forEachCoordinateLabel(this.camera, size, (text, x, y) => {
            this.drawCenteredText(canvas, text, x, y, font);
        });
    }

    /**
     * Decide whether overlay should be drawn at current scale and config.
     * @param scale Current camera scale.
     * @returns True if overlay is enabled and scale is within range.
     */
    shouldDraw(scale: number): boolean {
        return shouldDrawCoordinateOverlay(this.config.get(), scale);
    }

    /** Single cached font; the size is set per frame so labels scale continuously. */
    private getFont(size: number): SkFont {
        if (!this.font) {
            this.font = matchFont({ fontFamily: DEFAULT_SANS_SERIF, fontSize: size });
        }
        this.font.setSize(size);
        return this.font;
    }

    /** Draws text centered on (x, y), matching Canvas2D's `textAlign: "center"` / `textBaseline: "middle"`. */
    private drawCenteredText(canvas: SkCanvas, text: string, x: number, y: number, font: SkFont) {
        const width = font.measureText(text).width;
        const metrics = font.getMetrics();
        const drawX = x - width / 2;
        const drawY = y - (metrics.ascent + metrics.descent) / 2;
        canvas.drawText(text, drawX, drawY, this.textPaint, font);
    }
}
