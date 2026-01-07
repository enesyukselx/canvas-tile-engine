import type { Coords } from "../types";
import { ICamera } from "./Camera";
import { screenToWorld, worldToScreen } from "../utils/viewport";

/**
 * Transforms coordinates between world space and screen space using the active camera.
 */
export class CoordinateTransformer {
    /**
     * @param camera Camera providing origin and scaling for transformations.
     */
    constructor(private camera: ICamera) {}

    /**
     * Convert a world grid coordinate to screen pixels, accounting for camera offset and scale.
     * @param worldX Grid X in world space (tile index).
     * @param worldY Grid Y in world space (tile index).
     * @returns Screen-space coordinates in pixels. e.g., (e.g. `{ x: 100.5, y: 200.5 }`).
     */
    worldToScreen(worldX: number, worldY: number): Coords {
        return worldToScreen(
            { x: worldX, y: worldY },
            { x: this.camera.x, y: this.camera.y, scale: this.camera.scale }
        );
    }

    /**
     * Convert screen pixel coordinates back to world space grid coordinates.
     * @param screenX X coordinate in screen space (pixels).
     * @param screenY Y coordinate in screen space (pixels).
     * @returns World-space grid coordinates. (e.g. `{ x: 10, y: 20 }`).
     */
    screenToWorld(screenX: number, screenY: number): Coords {
        return screenToWorld(
            { x: screenX, y: screenY },
            { x: this.camera.x, y: this.camera.y, scale: this.camera.scale }
        );
    }
}
