import type { Coords } from "../types";
import { cornerArc } from "./pathCorners";

/**
 * Minimal Canvas2D-shaped path sink. Both DOM and @napi-rs/canvas contexts
 * satisfy it structurally; Skia adapts via its own path builder.
 */
export interface PathTraceTarget {
    moveTo(x: number, y: number): void;
    lineTo(x: number, y: number): void;
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
    closePath(): void;
}

/**
 * Traces one path item's outline (screen-pixel points) into a Canvas2D-style
 * sink, applying corner rounding via {@link cornerArc} so every renderer
 * produces identical geometry. Open paths round interior vertices only;
 * closed paths round every vertex, including the joins of the closing
 * segment. Degenerate corners (collinear, fold-back, zero radius) fall back
 * to straight joins.
 */
export function traceRoundedPath(ctx: PathTraceTarget, pts: Coords[], closed: boolean, radiusPx: number): void {
    const n = pts.length;
    if (n < 2) return;

    if (closed && n >= 3 && radiusPx > 0) {
        // Every vertex is a corner (cyclic neighbors). Start on the exit
        // tangent of vertex 0 so the trace ends exactly where it began.
        const arcs = pts.map((v, i) => cornerArc(pts[(i - 1 + n) % n], v, pts[(i + 1) % n], radiusPx));
        const start = arcs[0] ? arcs[0].t2 : pts[0];
        ctx.moveTo(start.x, start.y);
        for (let k = 1; k <= n; k++) {
            const i = k % n;
            const arc = arcs[i];
            if (arc) {
                ctx.lineTo(arc.t1.x, arc.t1.y);
                ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, arc.sweep < 0);
            } else {
                ctx.lineTo(pts[i].x, pts[i].y);
            }
        }
        ctx.closePath();
        return;
    }

    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < n - 1; i++) {
        const arc = radiusPx > 0 ? cornerArc(pts[i - 1], pts[i], pts[i + 1], radiusPx) : null;
        if (arc) {
            ctx.lineTo(arc.t1.x, arc.t1.y);
            ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, arc.sweep < 0);
        } else {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    if (closed) ctx.closePath();
}
