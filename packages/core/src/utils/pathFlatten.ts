import type { Coords } from "../types";
import { cornerArc, type CornerArc } from "./pathCorners";

/**
 * Default max spacing between flattened arc samples. Callers pass values in
 * the same unit as their points: renderers use it as screen pixels, the hit
 * tester divides by the camera scale to sample identically in world units.
 */
export const ARC_SEGMENT_LENGTH = 6;

function emitArc(out: Coords[], arc: CornerArc, maxSegment: number): void {
    out.push(arc.t1);
    const steps = Math.max(2, Math.ceil((Math.abs(arc.sweep) * arc.radius) / maxSegment));
    for (let k = 1; k < steps; k++) {
        const angle = arc.startAngle + (arc.sweep * k) / steps;
        out.push({
            x: arc.center.x + Math.cos(angle) * arc.radius,
            y: arc.center.y + Math.sin(angle) * arc.radius,
        });
    }
    out.push(arc.t2);
}

/**
 * Replace each interior vertex of a polyline with its rounding arc,
 * flattened into short segments. Uses {@link cornerArc} for the exact same
 * clamped geometry the Canvas2D/Skia renderers feed to their native
 * tangent-arc APIs, so flattened consumers (WebGL, hit testing) agree with
 * them. Because the result is a plain (denser) polyline, dash tessellation
 * and distance tests run over it unchanged. Radius, points, and
 * `maxSegment` share one unit (pixels or world).
 */
export function roundedPolyline(points: Coords[], radius: number, maxSegment: number = ARC_SEGMENT_LENGTH): Coords[] {
    if (radius <= 0 || points.length < 3) return points;

    const out: Coords[] = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const arc = cornerArc(points[i - 1], points[i], points[i + 1], radius);
        if (arc) emitArc(out, arc, maxSegment);
        else out.push(points[i]);
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
export function roundedRing(points: Coords[], radius: number, maxSegment: number = ARC_SEGMENT_LENGTH): Coords[] {
    if (radius <= 0 || points.length < 3) return points;

    const n = points.length;
    const out: Coords[] = [];
    for (let i = 0; i < n; i++) {
        const arc = cornerArc(points[(i - 1 + n) % n], points[i], points[(i + 1) % n], radius);
        if (arc) emitArc(out, arc, maxSegment);
        else out.push(points[i]);
    }
    return out;
}
