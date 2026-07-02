import { COORDINATE_OVERLAY, type Config, type ICamera, type ViewportState } from "@canvas-tile-engine/core";
import { Skia, matchFont, type SkCanvas, type SkFont, type SkPaint } from "@shopify/react-native-skia";

/**
 * Renders a coordinate overlay (axes and labels) on top of the canvas.
 *
 * Mirrors the Canvas2D `CoordinateOverlayRenderer`. Unlike the DOM backend
 * there is no persistent 2D context to hold paints against; the canvas is
 * handed in fresh per frame via {@link draw}, so paints/fonts are cached on
 * the instance instead.
 * @internal
 */
export class SkiaCoordinateOverlayRenderer {
    private borderPaint: SkPaint;
    private textPaint: SkPaint;
    private fontCache = new Map<number, SkFont>();

    constructor(private camera: ICamera, private config: Config, private viewport: ViewportState) {
        this.borderPaint = Skia.Paint();
        this.borderPaint.setColor(Skia.Color(`rgba(0, 0, 0, ${COORDINATE_OVERLAY.BORDER_OPACITY})`));

        this.textPaint = Skia.Paint();
        this.textPaint.setAntiAlias(true);
        this.textPaint.setColor(Skia.Color(`rgba(255, 255, 255, ${COORDINATE_OVERLAY.TEXT_OPACITY})`));
    }

    /**
     * Draw overlay borders and coordinate labels based on current camera view.
     */
    draw(canvas: SkCanvas) {
        const { width, height } = this.viewport.getSize();

        // Left border - full height
        canvas.drawRect(Skia.XYWHRect(0, 0, COORDINATE_OVERLAY.BORDER_WIDTH, height), this.borderPaint);

        // Bottom border - full width
        canvas.drawRect(
            Skia.XYWHRect(
                COORDINATE_OVERLAY.BORDER_WIDTH,
                height - COORDINATE_OVERLAY.BORDER_WIDTH,
                width,
                COORDINATE_OVERLAY.BORDER_WIDTH
            ),
            this.borderPaint
        );

        // Adjust font size based on scale (min 8px, max 12px)
        const fontSize = Math.min(
            COORDINATE_OVERLAY.MAX_FONT_SIZE,
            Math.max(COORDINATE_OVERLAY.MIN_FONT_SIZE, this.camera.scale * COORDINATE_OVERLAY.FONT_SIZE_SCALE_FACTOR)
        );
        const font = this.getFont(fontSize);

        const cordGap = this.camera.scale;
        const visibleAreaWidthInCords = width / cordGap;
        const visibleAreaHeightInCords = height / cordGap;

        // Draw Y coordinates (left side)
        for (let i = 0 - (this.camera.y % 1); i <= visibleAreaHeightInCords + 1; i++) {
            this.drawCenteredText(canvas, Math.round(this.camera.y + i).toString(), 10, cordGap * i + cordGap / 2, font);
        }

        // Draw X coordinates (bottom)
        for (let i = 0 - (this.camera.x % 1); i <= visibleAreaWidthInCords + 1; i++) {
            this.drawCenteredText(
                canvas,
                Math.round(this.camera.x + i).toString(),
                cordGap * i + cordGap / 2,
                height - 10,
                font
            );
        }
    }

    /**
     * Decide whether overlay should be drawn at current scale and config.
     * @param scale Current camera scale.
     * @returns True if overlay is enabled and scale is within range.
     */
    shouldDraw(scale: number): boolean {
        const coordsConfig = this.config.get().coordinates;

        if (!coordsConfig.enabled) {
            return false;
        }

        if (!coordsConfig.shownScaleRange) {
            return false;
        }

        const { min, max } = coordsConfig.shownScaleRange;

        return scale >= min && scale <= max;
    }

    private getFont(size: number): SkFont {
        const px = Math.max(1, Math.round(size));
        let font = this.fontCache.get(px);
        if (!font) {
            font = matchFont({ fontFamily: "sans-serif", fontSize: px });
            this.fontCache.set(px, font);
        }
        return font;
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
