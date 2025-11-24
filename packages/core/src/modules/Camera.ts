import { Coords } from "../types";

export class Camera {
    /** World top-left coords */
    x: number;
    y: number;
    scale: number;
    readonly minScale: number;
    readonly maxScale: number;

    constructor(initialTopLeft: Coords, scale = 1, minScale = 0.1, maxScale = 10) {
        this.x = initialTopLeft.x;
        this.y = initialTopLeft.y;
        this.scale = scale;
        this.minScale = minScale;
        this.maxScale = maxScale;
    }

    pan(deltaScreenX: number, deltaScreenY: number) {
        this.x -= deltaScreenX / this.scale;
        this.y -= deltaScreenY / this.scale;
    }

    zoom(mouseX: number, mouseY: number, deltaY: number, canvasRect: DOMRect) {
        const zoomSensitivity = 0.001;
        const oldScale = this.scale;

        const limitedDelta = Math.min(Math.max(deltaY, -100), 100);
        const scaleFactor = Math.exp(-limitedDelta * zoomSensitivity);
        const newScale = Math.min(this.maxScale, Math.max(this.minScale, oldScale * scaleFactor));

        if (newScale === oldScale) {
            return;
        }

        // Mouse position relative to canvas
        const mx = mouseX - canvasRect.left;
        const my = mouseY - canvasRect.top;

        // world offset correction to keep the point under the mouse stationary
        this.x += mx * (1 / oldScale - 1 / newScale);
        this.y += my * (1 / oldScale - 1 / newScale);

        this.scale = newScale;
    }

    /** Canvas center coordinates */
    getCenter(canvasWidth: number, canvasHeight: number): Coords {
        return {
            x: this.x + canvasWidth / (2 * this.scale),
            y: this.y + canvasHeight / (2 * this.scale),
        };
    }

    /** Sets the camera's top-left coordinates based on an external center point */
    setCenter(center: Coords, canvasWidth: number, canvasHeight: number) {
        this.x = center.x - canvasWidth / (2 * this.scale);
        this.y = center.y - canvasHeight / (2 * this.scale);
    }
}
