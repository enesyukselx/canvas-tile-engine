/**
 * Convert grid-based dimensions to pixel-based config.
 * @param options Grid configuration with columns, rows, and cell size.
 * @returns Config object with size and scale properties.
 * @example
 * ```ts
 * const config = {
 *     ...gridToSize({ columns: 12, rows: 12, cellSize: 50 }),
 *     backgroundColor: "#337426",
 * };
 * // config.size = { width: 600, height: 600 }
 * // config.scale = 50
 * ```
 */
export function gridToSize(options: { columns: number; rows: number; cellSize: number }) {
    return {
        size: {
            width: options.columns * options.cellSize,
            height: options.rows * options.cellSize,
        },
        scale: options.cellSize,
    };
}
