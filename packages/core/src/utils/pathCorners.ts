import type { Coords } from "../types";

/**
 * Geometry of one rounded polyline corner, in screen pixels. All renderers
 * derive their corner arcs from this single computation so the rounding is
 * identical everywhere: Canvas2D/Skia feed `radius` to their native tangent
 * arc APIs, WebGL flattens the arc from `center`/angles.
 */
export interface CornerArc {
    /** Arc radius after per-corner clamping. */
    radius: number;
    /** Tangent point on the incoming segment (arc start). */
    t1: Coords;
    /** Tangent point on the outgoing segment (arc end). */
    t2: Coords;
    /** Arc center. */
    center: Coords;
    /** Angle of `t1` around the center, radians. */
    startAngle: number;
    /** Angle of `t2` around the center, radians. */
    endAngle: number;
    /** Sweep from start to end, radians; negative = counterclockwise. */
    sweep: number;
}

const EPSILON = 1e-9;

/**
 * Compute the rounding arc for the corner `prev → v → next` with the desired
 * `radiusPx`. The radius is clamped so the arc's tangent points never pass
 * the midpoint of either adjacent segment (matching what `ctx.arcTo` would
 * need to stay well-formed on short segments). Returns `null` for degenerate
 * corners: zero-length segments, collinear continuation, or a fold-back.
 */
export function cornerArc(prev: Coords, v: Coords, next: Coords, radiusPx: number): CornerArc | null {
    if (radiusPx <= EPSILON) return null;

    const ax = prev.x - v.x;
    const ay = prev.y - v.y;
    const bx = next.x - v.x;
    const by = next.y - v.y;
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    if (la <= EPSILON || lb <= EPSILON) return null;

    const cos = Math.min(1, Math.max(-1, (ax * bx + ay * by) / (la * lb)));
    const theta = Math.acos(cos);
    // Straight continuation (no corner) or a fold-back (no room for an arc).
    if (theta >= Math.PI - 1e-6 || theta <= 1e-6) return null;

    const halfTan = Math.tan(theta / 2);
    // Tangent offset along each segment is r / tan(θ/2); cap it at half the
    // shorter segment so neighboring corners never overlap.
    const tMax = Math.min(la, lb) / 2;
    const radius = Math.min(radiusPx, tMax * halfTan);
    if (radius <= EPSILON) return null;

    const t = radius / halfTan;
    const t1 = { x: v.x + (ax / la) * t, y: v.y + (ay / la) * t };
    const t2 = { x: v.x + (bx / lb) * t, y: v.y + (by / lb) * t };

    // Center sits on the angle bisector, r / sin(θ/2) away from the vertex.
    let bisX = ax / la + bx / lb;
    let bisY = ay / la + by / lb;
    const bisLen = Math.hypot(bisX, bisY);
    if (bisLen <= EPSILON) return null;
    bisX /= bisLen;
    bisY /= bisLen;
    const center = {
        x: v.x + bisX * (radius / Math.sin(theta / 2)),
        y: v.y + bisY * (radius / Math.sin(theta / 2)),
    };

    const startAngle = Math.atan2(t1.y - center.y, t1.x - center.x);
    const endAngle = Math.atan2(t2.y - center.y, t2.x - center.x);
    // The arc always spans π - θ; the turn direction of the polyline picks
    // the sweep sign (positive = clockwise in the y-down screen space).
    const turn = ax * by - ay * bx;
    const magnitude = Math.PI - theta;
    const sweep = turn > 0 ? -magnitude : magnitude;

    return { radius, t1, t2, center, startAngle, endAngle, sweep };
}
