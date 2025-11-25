import { Camera } from "./Camera";
import type { Coords } from "../types";

export class CoordinateTransformer {
    constructor(private camera: Camera) {}

    worldToScreen(worldX: number, worldY: number): Coords {
        return {
            x: (worldX + 0.5 - this.camera.x) * this.camera.scale,
            y: (worldY + 0.5 - this.camera.y) * this.camera.scale,
        };
    }

    screenToWorld(screenX: number, screenY: number): Coords {
        return {
            x: this.camera.x + screenX / this.camera.scale,
            y: this.camera.y + screenY / this.camera.scale,
        };
    }
}
