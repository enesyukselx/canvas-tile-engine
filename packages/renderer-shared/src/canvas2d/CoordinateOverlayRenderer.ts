import { Config, ICamera, ViewportState } from "@canvas-tile-engine/core";
import {
    COORDINATE_OVERLAY_STYLE,
    coordinateOverlayBorders,
    coordinateOverlayFontSize,
    forEachCoordinateLabel,
    shouldDrawCoordinateOverlay,
} from "../scene";
import type { Canvas2DContextLike } from "./types";

/**
 * Renders a coordinate overlay (axes and labels) on top of the canvas.
 * Generic over the platform's 2D context type.
 *
 * Border geometry, font sizing and label positions come from the shared
 * layout helpers so every renderer draws the same overlay; this class only
 * paints what they return.
 * @internal
 */
export class CoordinateOverlayRenderer<TContext extends Canvas2DContextLike> {
    private ctx: TContext;
    private camera: ICamera;
    private config: Config;
    private viewport: ViewportState;

    /**
     * @param ctx Canvas context to draw on.
     * @param camera Active camera for position/scale.
     * @param config Normalized grid engine configuration store.
     * @param viewport Mutable viewport size store.
     */
    constructor(ctx: TContext, camera: ICamera, config: Config, viewport: ViewportState) {
        this.ctx = ctx;
        this.camera = camera;
        this.config = config;
        this.viewport = viewport;
    }

    /**
     * Draw overlay borders and coordinate labels based on current camera view.
     */
    draw() {
        // Save the current canvas state
        this.ctx.save();

        const size = this.viewport.getSize();
        const { left, bottom } = coordinateOverlayBorders(size);

        this.ctx.fillStyle = COORDINATE_OVERLAY_STYLE.borderColor;
        this.ctx.fillRect(left.x, left.y, left.width, left.height);
        this.ctx.fillRect(bottom.x, bottom.y, bottom.width, bottom.height);

        // Set text properties for coordinates
        this.ctx.fillStyle = COORDINATE_OVERLAY_STYLE.textColor;
        this.ctx.font = `${coordinateOverlayFontSize(this.camera.scale)}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        forEachCoordinateLabel(this.camera, size, (text, x, y) => this.ctx.fillText(text, x, y));

        // Restore the canvas state
        this.ctx.restore();
    }

    /**
     * Decide whether overlay should be drawn at current scale and config.
     * @param scale Current camera scale.
     * @returns True if overlay is enabled and scale is within range.
     */
    shouldDraw(scale: number): boolean {
        return shouldDrawCoordinateOverlay(this.config.get(), scale);
    }
}
