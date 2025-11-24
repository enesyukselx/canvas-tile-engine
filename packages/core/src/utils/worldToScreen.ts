import { Coords } from "../types";

export function worldToScreen(x: number, y: number, origin: Coords, scale: number): { x: number; y: number } {
    return {
        x: (x + 0.5 - origin.x) * scale,
        y: (y + 0.5 - origin.y) * scale,
    };
}
