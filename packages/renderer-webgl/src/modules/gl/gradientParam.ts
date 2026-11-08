import { gradientT } from "@canvas-tile-engine/core";

/**
 * Axis length, in pixels, at or below which a gradient is degenerate: Skia's
 * `kDegenerateThreshold` (1 / 2^15). Canvas2D in a browser, the server and
 * React Native all paint through Skia, which fills such a gradient with its
 * last stop instead of a step, so WebGL does the same. A zero-length axis is
 * the exception: Canvas2D paints nothing for it.
 * @internal
 */
export const DEGENERATE_AXIS_PX = 1 / 32768;

/**
 * Largest gradient parameter a vertex may carry, from the GPU's `mediump`
 * float range: `rangeMax` is what `getShaderPrecisionFormat` reports for it,
 * log2 of the largest magnitude. Half of that range leaves headroom.
 *
 * The fragment shaders read `v_gradT` at mediump. Desktop GPUs report 127 (a
 * full float, so nothing is ever bounded), but many mobile GPUs store mediump
 * varyings as half floats (15). Past that range a value overflows to
 * infinity, and an infinity interpolated against its opposite is NaN. An
 * unknown range falls back to the minimum GLSL ES guarantees, 14.
 * @internal
 */
export function maxVertexGradientT(rangeMax: number | undefined): number {
    const exponent = rangeMax !== undefined && rangeMax >= 14 ? rangeMax : 14;
    return 2 ** (exponent - 1);
}

/**
 * The gradient parameter at each vertex of one primitive, kept within
 * `limit` (see {@link maxVertexGradientT}).
 *
 * `t` grows with distance over axis length, so a short axis or a large shape
 * can push it past a half-float range. `t` is affine across the primitive, so
 * it can be rescaled about the middle of the ramp, `0.5 + (t - 0.5) * k`, and
 * still interpolates exactly. That keeps the ramp centered where it was and
 * only widens it, to `distance / limit` pixels at most, where `distance` is
 * how far the farthest vertex lies from the axis midpoint along the axis. For
 * a short axis, whose ramp is meant to be a hard step, that stays within a
 * pixel while every vertex is within `limit` pixels of it. A primitive whose
 * values already fit is left exactly as it was.
 * @internal
 */
export function boundedGradientT(
    axis: { x0: number; y0: number; x1: number; y1: number },
    points: ReadonlyArray<readonly number[]>,
    limit: number,
): number[] {
    const ts = points.map(([x, y]) => gradientT(axis, x, y));
    let reach = 0;
    for (const t of ts) {
        reach = Math.max(reach, Math.abs(t - 0.5));
    }
    if (reach <= limit) {
        return ts;
    }
    const k = limit / reach;
    return ts.map((t) => 0.5 + (t - 0.5) * k);
}
