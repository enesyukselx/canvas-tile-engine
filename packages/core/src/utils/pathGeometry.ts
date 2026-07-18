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

/** Axis-aligned world rectangle used by region queries. */
export interface RectRegion {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
}

export function pointInRect(p: Coords, r: RectRegion): boolean {
    return p.x >= r.minX && p.x <= r.maxX && p.y >= r.minY && p.y <= r.maxY;
}

/** Whether the segment `a`-`b` touches the rectangle (endpoints included). */
export function segmentIntersectsRect(a: Coords, b: Coords, r: RectRegion): boolean {
    if (pointInRect(a, r) || pointInRect(b, r)) return true;
    // Liang-Barsky style clipping: track the parameter window [t0, t1] of the
    // segment against each slab; the window surviving all four means overlap.
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    let t0 = 0;
    let t1 = 1;
    const clip = (p: number, q: number): boolean => {
        if (p === 0) return q >= 0;
        const t = q / p;
        if (p < 0) {
            if (t > t1) return false;
            if (t > t0) t0 = t;
        } else {
            if (t < t0) return false;
            if (t < t1) t1 = t;
        }
        return true;
    };
    return clip(-dx, a.x - r.minX) && clip(dx, r.maxX - a.x) && clip(-dy, a.y - r.minY) && clip(dy, r.maxY - a.y);
}

/**
 * Whether the (implicitly closed) ring's OUTLINE touches the rectangle.
 * Interior overlap is the caller's concern: pair with `pointInRing(s)` on a
 * rect corner for filled shapes, so holes stay excluded correctly.
 */
export function ringIntersectsRect(ring: Coords[], r: RectRegion, closed: boolean = true): boolean {
    if (ring.length === 1) return pointInRect(ring[0], r);
    const last = closed ? ring.length : ring.length - 1;
    for (let i = 0; i < last; i++) {
        if (segmentIntersectsRect(ring[i], ring[(i + 1) % ring.length], r)) return true;
    }
    return false;
}
