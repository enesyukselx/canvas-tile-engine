import type { CanvasTileEngineConfig, Coords } from "../types";

/**
 * Convert grid-based dimensions to pixel-based config plus the board center.
 *
 * Integers are cell centers (cell k spans [k-0.5, k+0.5]), so a board of
 * cells 0..N-1 is centered at (N-1)/2 on each axis. Pass the returned
 * `center` to the engine so the board exactly fills the viewport.
 * @param options Grid configuration with columns, rows, and cell size.
 * @returns Config `size`/`scale` plus the `center` of a 0-based board.
 * @example
 * ```ts
 * const { center, ...board } = gridToSize({ columns: 8, rows: 8, cellSize: 60 });
 * // board.size = { width: 480, height: 480 }, board.scale = 60
 * // center = { x: 3.5, y: 3.5 }
 *
 * const engine = new CanvasTileEngine(
 *     wrapper,
 *     { ...board, gridAligned: true },
 *     new RendererCanvas(),
 *     center,
 * );
 * ```
 */
export function gridToSize(options: {
    columns: number;
    rows: number;
    cellSize: number;
}): Pick<CanvasTileEngineConfig, "size" | "scale"> & { center: Coords } {
    return {
        size: {
            width: options.columns * options.cellSize,
            height: options.rows * options.cellSize,
        },
        scale: options.cellSize,
        center: {
            x: (options.columns - 1) / 2,
            y: (options.rows - 1) / 2,
        },
    };
}
