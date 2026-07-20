import type { Coords } from "@canvas-tile-engine/core";

/**
 * Tiled pixel coordinate → engine item-space coordinate.
 *
 * Tiled measures in pixels from the map's top-left corner; engine item space
 * measures in world units where INTEGERS ARE CELL CENTERS. Pixel 0 is the
 * left edge of cell 0, whose center is item-space 0 — hence the -0.5.
 */
export function pxToWorld(px: number, tileSize: number): number {
    return px / tileSize - 0.5;
}

export function pxPointToWorld(p: { x: number; y: number }, tileSize: number): Coords {
    return { x: pxToWorld(p.x, tileSize), y: pxToWorld(p.y, tileSize) };
}

/** Rotate `p` around `anchor` by `deg` clockwise (screen coords, y-down). */
export function rotateAround(p: Coords, anchor: Coords, deg: number): Coords {
    if (deg === 0) return p;
    const rad = (deg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const dx = p.x - anchor.x;
    const dy = p.y - anchor.y;
    return {
        x: anchor.x + dx * cos - dy * sin,
        y: anchor.y + dx * sin + dy * cos,
    };
}
