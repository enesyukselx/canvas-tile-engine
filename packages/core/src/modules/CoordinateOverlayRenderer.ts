import { GridEngineConfig } from "../types";
import { Config } from "./Config";
import { ICamera } from "./Camera";

/**
 * Renders a coordinate overlay (axes and labels) on top of the canvas.
 * @internal
 */
export class CoordinateOverlayRenderer {
    private ctx: CanvasRenderingContext2D;
    private camera: ICamera;
    private config: Config;

    /**
     * @param ctx Canvas context to draw on.
     * @param camera Active camera for position/scale.
     * @param config Normalized grid engine configuration store.
     */
    constructor(ctx: CanvasRenderingContext2D, camera: ICamera, config: Config) {
        this.ctx = ctx;
        this.camera = camera;
        this.config = config;
    }

    /**
     * Draw overlay borders and coordinate labels based on current camera view.
     */
    draw() {
        // Save the current canvas state
        this.ctx.save();

        // Set fill style to black with 0.1 opacity
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.1)";

        // Draw left border - 20px wide, full height
        const config = this.config.get();
        this.ctx.fillRect(0, 0, 20, config.size.height);

        // Draw bottom border - full width, 20px high
        this.ctx.fillRect(20, config.size.height - 20, config.size.width, 20);

        // Set text properties for coordinates
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";

        // Adjust font size based on scale (min 8px, max 12px)
        const fontSize = Math.min(12, Math.max(8, this.camera.scale * 0.25));
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        const cordGap = this.camera.scale;
        const visibleAreaWidthInCords = config.size.width / cordGap;
        const visibleAreaHeightInCords = config.size.height / cordGap;

        // Draw Y coordinates (left side)
        for (let i = 0 - (this.camera.y % 1); i <= visibleAreaHeightInCords + 1; i++) {
            this.ctx.fillText(Math.round(this.camera.y + i).toString(), 10, cordGap * i + cordGap / 2);
        }

        // Draw X coordinates (bottom)
        for (let i = 0 - (this.camera.x % 1); i <= visibleAreaWidthInCords + 1; i++) {
            this.ctx.fillText(
                Math.round(this.camera.x + i).toString(),
                cordGap * i + cordGap / 2,
                config.size.height - 10
            );
        }

        // Restore the canvas state
        this.ctx.restore();
    }

    /**
     * Decide whether overlay should be drawn at current scale and config.
     * @param scale Current camera scale.
     * @param coordsConfig Coordinate overlay config.
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
}
