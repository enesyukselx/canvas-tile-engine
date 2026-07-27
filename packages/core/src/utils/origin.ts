import type { Coords } from "../types";

/** Normalized origin: `mode` defaults to "cell", `x`/`y` default to 0.5 (center). */
export interface Origin {
    mode: "cell" | "self";
    x: number;
    y: number;
}

/** Raw `origin` as authored on a draw item — every field optional. */
export type RawOrigin = { mode?: "cell" | "self"; x?: number; y?: number };

/** Fills in the "cell"/0.5/0.5 defaults for an item's `origin` field. */
export function resolveOrigin(origin?: RawOrigin): Origin {
    return {
        mode: origin?.mode === "self" ? "self" : "cell",
        x: origin?.x ?? 0.5,
        y: origin?.y ?? 0.5,
    };
}

/**
 * Top-left offset of a `w`x`h` box anchored at `pos`.
 * - "cell": nudges the box from the cell center by `origin.x`/`origin.y`
 *   (0 to 1) across a `cellSize`-wide cell, independent of the box's own size.
 * - "self": anchors within the box's own `w`/`h`; `cellSize` is unused.
 *
 * `pos`, `w`, `h`, and `cellSize` must share the same unit — screen pixels
 * for renderers (`cellSize` = `camera.scale`), or world units for hit
 * testing (`cellSize` = 1, a cell is exactly one world unit wide).
 */
export function computeOriginOffset(pos: Coords, w: number, h: number, origin: Origin, cellSize: number): Coords {
    if (origin.mode === "cell") {
        return {
            x: pos.x - cellSize / 2 + origin.x * cellSize - w / 2,
            y: pos.y - cellSize / 2 + origin.y * cellSize - h / 2,
        };
    }

    return {
        x: pos.x - origin.x * w,
        y: pos.y - origin.y * h,
    };
}
