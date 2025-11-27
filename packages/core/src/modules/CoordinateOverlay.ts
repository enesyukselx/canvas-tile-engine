import { CanvasGridMapConfig } from "../types";
import { Camera } from "./Camera";
import { ConfigManager } from "./ConfigManager";
import { CoordinateTransformer } from "./CoordinateTransformer";

export class CoordinateOverlay {
    private ctx: CanvasRenderingContext2D;
    private camera: Camera;
    private config: Required<CanvasGridMapConfig>;

    constructor(ctx: CanvasRenderingContext2D, camera: Camera, config: Required<CanvasGridMapConfig>) {
        this.ctx = ctx;
        this.camera = camera;
        this.config = config;
    }

    draw() {
        // Save the current canvas state
        this.ctx.save();

        // Set fill style to black with 0.1 opacity
        this.ctx.fillStyle = "rgba(0, 0, 0, 0.1)";

        // Draw left border - 20px wide, full height
        this.ctx.fillRect(0, 0, 20, this.config.size.height);

        // Draw bottom border - full width, 20px high
        this.ctx.fillRect(20, this.config.size.height - 20, this.config.size.width, 20);

        // Set text properties for coordinates
        this.ctx.fillStyle = "rgba(255, 255, 255, 0.8)";

        // Adjust font size based on scale (min 8px, max 12px)
        const fontSize = Math.min(12, Math.max(8, this.camera.scale * 0.25));
        this.ctx.font = `${fontSize}px Arial`;
        this.ctx.textAlign = "center";
        this.ctx.textBaseline = "middle";

        const cordGap = this.camera.scale;
        const visibleAreaWidthInCords = this.config.size.width / cordGap;
        const visibleAreaHeightInCords = this.config.size.height / cordGap;

        // Draw Y coordinates (left side)
        for (let i = 0 - (this.camera.y % 1); i <= visibleAreaHeightInCords + 1; i++) {
            this.ctx.fillText(Math.round(this.camera.y + i).toString(), 10, cordGap * i + cordGap / 2);
        }

        // Draw X coordinates (bottom)
        for (let i = 0 - (this.camera.x % 1); i <= visibleAreaWidthInCords + 1; i++) {
            this.ctx.fillText(
                Math.round(this.camera.x + i).toString(),
                cordGap * i + cordGap / 2,
                this.config.size.height - 10
            );
        }

        // Restore the canvas state
        this.ctx.restore();
    }
}
