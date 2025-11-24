import { Coords } from "../types";

export function screenToWorld(x: number, y: number, origin: Coords, scale: number): { x: number; y: number } {
    return {
        x: x / scale + origin.x - 0.5,
        y: y / scale + origin.y - 0.5,
    };
}
