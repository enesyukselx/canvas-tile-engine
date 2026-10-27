/**
 * Closest two adjacent grid lines may be drawn, in screen pixels. Below this a
 * grid reads as a solid fill anyway, so drawing every line only costs time.
 */
export const MIN_GRID_LINE_SPACING_PX = 2;

/**
 * Doublings that carry any positive double to Infinity (2^-1074 up past
 * 2^1023). Positive inputs always settle within it; the cap only stops a
 * degenerate scale (zero or negative) from looping forever.
 */
const MAX_DOUBLINGS = 2100;

/**
 * World-space distance between the grid lines actually drawn for a requested
 * `cellSize` at `scale` (pixels per world unit): `cellSize * 2^k` for the
 * smallest integer k >= 0 that keeps lines at least
 * {@link MIN_GRID_LINE_SPACING_PX} apart on screen.
 *
 * k is 0 whenever the requested spacing is already wide enough, so normal
 * zoom levels draw every line. Zoomed out further, every 2nd, 4th, ... line is
 * kept. Lines snapped to multiples of the returned step are therefore a subset
 * of the requested lattice, and stay put while panning.
 */
export function gridLineStep(cellSize: number, scale: number): number {
    // Doubling is exact in binary floating point, so the result is exactly
    // cellSize * 2^k and the threshold test is the definition itself.
    let step = cellSize;
    for (let k = 0; k < MAX_DOUBLINGS && step * scale < MIN_GRID_LINE_SPACING_PX; k++) {
        step *= 2;
    }
    return step;
}
