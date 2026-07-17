import { cornerArc } from "@canvas-tile-engine/core";
import type { Coords } from "@canvas-tile-engine/core";

/** Max screen-pixel spacing between flattened arc samples. */
const ARC_SEGMENT_PX = 6;

/**
 * Replace each interior vertex of a screen-space polyline with its rounding
 * arc, flattened into short segments (WebGL has no native arcs). Uses core's
 * `cornerArc` for the exact same clamped geometry the Canvas2D/Skia
 * renderers feed to their native tangent-arc APIs. Because the result is a
 * plain (denser) polyline, dash tessellation runs over it unchanged and the
 * pattern flows through the corners.
 */
export function roundedPolyline(points: Coords[], radiusPx: number): Coords[] {
    if (radiusPx <= 0 || points.length < 3) return points;

    const out: Coords[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const arc = cornerArc(points[i - 1], points[i], points[i + 1], radiusPx);
        if (!arc) {
            out.push(points[i]);
            continue;
        }
        out.push(arc.t1);
        const steps = Math.max(2, Math.ceil((Math.abs(arc.sweep) * arc.radius) / ARC_SEGMENT_PX));
        for (let k = 1; k < steps; k++) {
            const angle = arc.startAngle + (arc.sweep * k) / steps;
            out.push({
                x: arc.center.x + Math.cos(angle) * arc.radius,
                y: arc.center.y + Math.sin(angle) * arc.radius,
            });
        }
        out.push(arc.t2);
    }
    out.push(points[points.length - 1]);
    return out;
}

/**
 * Closed-ring variant of {@link roundedPolyline}: every vertex is a corner
 * with cyclic neighbors, including the joins of the closing segment. The
 * result is still an implicit ring — consumers connect the last sample back
 * to the first.
 */
export function roundedRing(points: Coords[], radiusPx: number): Coords[] {
    if (radiusPx <= 0 || points.length < 3) return points;

    const n = points.length;
    const out: Coords[] = [];
    for (let i = 0; i < n; i++) {
        const arc = cornerArc(points[(i - 1 + n) % n], points[i], points[(i + 1) % n], radiusPx);
        if (!arc) {
            out.push(points[i]);
            continue;
        }
        out.push(arc.t1);
        const steps = Math.max(2, Math.ceil((Math.abs(arc.sweep) * arc.radius) / ARC_SEGMENT_PX));
        for (let k = 1; k < steps; k++) {
            const angle = arc.startAngle + (arc.sweep * k) / steps;
            out.push({
                x: arc.center.x + Math.cos(angle) * arc.radius,
                y: arc.center.y + Math.sin(angle) * arc.radius,
            });
        }
        out.push(arc.t2);
    }
    return out;
}
