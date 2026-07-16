import type { Coords } from "@canvas-tile-engine/core";

/**
 * Split the segment a→b into dash sub-segments in screen space.
 *
 * WebGL has no native dash support, so dashed lines are tessellated on the
 * CPU before batching. `pattern` must be even-length with a positive sum (as
 * produced by core's `resolveLineDashPx`); `phase` is the distance already
 * consumed within the repeating pattern, which lets the dash flow
 * continuously across the joints of a polyline.
 *
 * @returns The phase after consuming the segment, to be passed to the next
 * segment of the same polyline.
 */
export function appendDashedSegment(
    out: Array<{ a: Coords; b: Coords }>,
    a: Coords,
    b: Coords,
    pattern: number[],
    phase: number,
): number {
    const total = pattern.reduce((sum, v) => sum + v, 0);
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    if (length === 0 || total <= 0) return phase;

    const ux = (b.x - a.x) / length;
    const uy = (b.y - a.y) / length;

    // Locate the pattern interval the incoming phase falls into. Terminates
    // because p < total and every full cycle subtracts total.
    let p = phase % total;
    let i = 0;
    while (p >= pattern[i]) {
        p -= pattern[i];
        i = (i + 1) % pattern.length;
    }

    let dist = 0;
    while (dist < length) {
        const step = Math.min(Math.max(pattern[i] - p, 0), length - dist);
        // Even indices are "on" intervals, odd are gaps.
        if (i % 2 === 0 && step > 0) {
            out.push({
                a: { x: a.x + ux * dist, y: a.y + uy * dist },
                b: { x: a.x + ux * (dist + step), y: a.y + uy * (dist + step) },
            });
        }
        dist += step;
        p += step;
        // Interval exhausted (also covers zero-length intervals): move on.
        if (pattern[i] - p <= 1e-9) {
            p = 0;
            i = (i + 1) % pattern.length;
        }
    }

    return (phase + length) % total;
}
