import { Coords } from "../types";

export function screenToWorld(x: number, y: number, origin: Coords, scale: number): { x: number; y: number } {
    return {
        x: x / scale + origin.x,
        y: y / scale + origin.y,
    };
}
