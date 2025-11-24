import { Coords } from "../types";

export function worldToScreen(x: number, y: number, origin: Coords, scale: number): { x: number; y: number } {
    return {
        x: (x - origin.x) * scale,
        y: (y - origin.y) * scale,
    };
}
