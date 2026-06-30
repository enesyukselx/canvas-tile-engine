import { Config, COORDINATE_OVERLAY, ICamera, ViewportState } from "@canvas-tile-engine/core";

/**
 * Renders a coordinate overlay (axes and labels) on the 2D overlay canvas that
 * sits above the WebGL surface.
 * @internal
 */
export class CoordinateOverlayRenderer {
    private ctx: CanvasRenderingContext2D;
    private camera: ICamera;
    private config: Config;
    private viewport: ViewportState;

    constructor(ctx: CanvasRenderingContext2D, camera: ICamera, config: Config, viewport: ViewportState) {
        this.ctx = ctx;
        this.camera = camera;
        this.config = config;
        this.viewport = viewport;
    }

    /**
     * Draw overlay borders and coordinate labels based on current camera view.
     */
    draw() {
        this.ctx.save();

        this.ctx.fillStyle = `rgba(0, 0, 0, ${COORDINATE_OVERLAY.BORDER_OPACITY})`;

        const { width, height } = this.viewport.getSize();
        this.ctx.fillRect(0, 0, COORDINATE_OVERLAY.BORDER_WIDTH, height);

        this.ctx.fillRect(
            COORDINATE_OVERLAY.BORDER_WIDTH,
            height - COORDINATE_OVERLAY.BORDER_WIDTH,
            width,
            COORDINATE_OVERLAY.BORDER_WIDTH
        );

        this.ctx.fillStyle = `rgba(255, 255, 255, ${COORDINATE_OVERLAY.TEXT_OPACITY})`;

        const fontSize = Math.min(
            COORDINATE_OVERLAY.MAX_FONT_SIZE,
            Math.max(COORDINATE_OVERLAY.MIN_FONT_SIZE, this.camera.scale * COORDINATE_OVERLAY.FONT_SIZE_SCALE_FACTOR)
        );
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        const cordGap = this.camera.scale;
        const visibleAreaWidthInCords = width / cordGap;
        const visibleAreaHeightInCords = height / cordGap;

        // Draw Y coordinates (left side)
        for (let i = 0 - (this.camera.y % 1); i <= visibleAreaHeightInCords + 1; i++) {
            this.ctx.fillText(Math.round(this.camera.y + i).toString(), 10, cordGap * i + cordGap / 2);
        }

        // Draw X coordinates (bottom)
        for (let i = 0 - (this.camera.x % 1); i <= visibleAreaWidthInCords + 1; i++) {
            this.ctx.fillText(Math.round(this.camera.x + i).toString(), cordGap * i + cordGap / 2, height - 10);
        }

        this.ctx.restore();
    }

    /**
     * Decide whether overlay should be drawn at current scale and config.
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
}
