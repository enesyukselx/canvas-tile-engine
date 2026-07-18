import type { Coords } from "../types";

/**
 * World-space geometry predicates shared by path/line hit testing. All inputs
 * and outputs are world units; scale-dependent thresholds (stroke widths) are
 * resolved by the caller.
 */

/** Squared distance from `p` to the segment `a`-`b`. */
export function distToSegmentSq(p: Coords, a: Coords, b: Coords): number {
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const apx = p.x - a.x;
    const apy = p.y - a.y;
    const lenSq = abx * abx + aby * aby;
    // Degenerate segment: distance to the point itself.
    const t = lenSq > 0 ? Math.min(1, Math.max(0, (apx * abx + apy * aby) / lenSq)) : 0;
    const dx = apx - t * abx;
    const dy = apy - t * aby;
    return dx * dx + dy * dy;
}

/**
 * Distance from `p` to the nearest segment of the polyline `points`.
 * `closed` includes the segment joining the last point back to the first.
 * Returns `Infinity` for fewer than 2 points.
 */
export function distanceToPolyline(p: Coords, points: Coords[], closed: boolean): number {
    if (points.length < 2) return Infinity;
    let best = Infinity;
    const last = closed ? points.length : points.length - 1;
    for (let i = 0; i < last; i++) {
        const d = distToSegmentSq(p, points[i], points[(i + 1) % points.length]);
        if (d < best) best = d;
    }
    return Math.sqrt(best);
}

/** Signed winding and raw crossing count of a rightward ray from `p`
 * against the ring `points` (implicitly closed). */
function ringCrossings(p: Coords, points: Coords[]): { winding: number; crossings: number } {
    let winding = 0;
    let crossings = 0;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j];
        const b = points[i];
        // Half-open y-interval test so a vertex on the ray counts once.
        if (b.y > p.y !== a.y > p.y) {
            const cross = ((a.x - b.x) * (p.y - b.y)) / (a.y - b.y) + b.x;
            if (p.x < cross) {
                crossings++;
                winding += a.y > b.y ? 1 : -1;
            }
        }
    }
    return { winding, crossings };
}

/**
 * Whether `p` lies inside the ring `points` (implicitly closed) under the
 * given fill rule, mirroring Canvas2D `isPointInPath`: `"nonzero"` counts
 * signed edge crossings of a rightward ray, `"evenodd"` alternates on each
 * crossing. Points exactly on an edge may land on either side; callers pair
 * this with a stroke-distance test so boundaries stay hittable.
 */
export function pointInRing(p: Coords, points: Coords[], fillRule: "nonzero" | "evenodd" = "nonzero"): boolean {
    if (points.length < 3) return false;
    const { winding, crossings } = ringCrossings(p, points);
    return fillRule === "evenodd" ? crossings % 2 === 1 : winding !== 0;
}

/**
 * Multi-ring variant of {@link pointInRing}: winding/crossings accumulate
 * across ALL rings before the rule applies, so holes behave like Canvas2D
 * fill — an evenodd overlap punches a hole, and a nonzero hole requires the
 * inner ring to wind opposite its outer ring. Rings close implicitly (open
 * subpaths close for filling, like Canvas2D `fill()`).
 */
export function pointInRings(p: Coords, rings: Coords[][], fillRule: "nonzero" | "evenodd" = "nonzero"): boolean {
    let winding = 0;
    let crossings = 0;
    for (const ring of rings) {
        if (ring.length < 3) continue;
        const c = ringCrossings(p, ring);
        winding += c.winding;
        crossings += c.crossings;
    }
    return fillRule === "evenodd" ? crossings % 2 === 1 : winding !== 0;
}
