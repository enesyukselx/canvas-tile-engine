import type { Coords, PathCommand } from "../types";
import { pathCommandsDrawable } from "./flattenPath";
import { cornerArc, type CornerArc } from "./pathCorners";

/**
 * Can `ctx.arc` take these screen-space values? Browsers throw
 * `IndexSizeError` on a negative radius, which aborts the frame, and
 * `@napi-rs/canvas` aborts the Node process on a non-finite center, so no
 * value reaches `arc()` without passing this.
 */
function arcDrawable(x: number, y: number, radius: number, startAngle: number, endAngle: number): boolean {
    return (
        Number.isFinite(x) &&
        Number.isFinite(y) &&
        Number.isFinite(radius) &&
        radius >= 0 &&
        Number.isFinite(startAngle) &&
        Number.isFinite(endAngle)
    );
}

/**
 * {@link cornerArc}, or null when its arc cannot reach `ctx.arc` (a corner
 * next to a non-finite vertex), so that corner falls back to a straight join
 * like any other degenerate one.
 */
function drawableCornerArc(prev: Coords, v: Coords, next: Coords, radiusPx: number): CornerArc | null {
    const arc = cornerArc(prev, v, next, radiusPx);
    return arc && arcDrawable(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle) ? arc : null;
}

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
    if (n < 2) {
        return;
    }

    if (closed && n >= 3 && radiusPx > 0) {
        // Every vertex is a corner (cyclic neighbors). Start on the exit
        // tangent of vertex 0 so the trace ends exactly where it began.
        const arcs = pts.map((v, i) => drawableCornerArc(pts[(i - 1 + n) % n], v, pts[(i + 1) % n], radiusPx));
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
        const arc = radiusPx > 0 ? drawableCornerArc(pts[i - 1], pts[i], pts[i + 1], radiusPx) : null;
        if (arc) {
            ctx.lineTo(arc.t1.x, arc.t1.y);
            ctx.arc(arc.center.x, arc.center.y, arc.radius, arc.startAngle, arc.endAngle, arc.sweep < 0);
        } else {
            ctx.lineTo(pts[i].x, pts[i].y);
        }
    }
    ctx.lineTo(pts[n - 1].x, pts[n - 1].y);
    if (closed) {
        ctx.closePath();
    }
}

/**
 * Full Canvas2D-shaped sink for command replay: {@link PathTraceTarget}
 * plus the curve methods. DOM and @napi-rs/canvas contexts satisfy it
 * structurally; Skia adapts via its path builder.
 */
export interface CommandTraceTarget extends PathTraceTarget {
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
}

/**
 * Replays a PathCommand list into a Canvas2D-style sink, converting world
 * coordinates to screen pixels and degrees to radians at this one boundary
 * so every renderer traces identical geometry. The world→screen transform
 * is uniform (one scale for both axes), so curves and arcs map exactly.
 *
 * A list that cannot be drawn (a negative arc radius or a non-finite number,
 * see {@link pathCommandsDrawable}) traces nothing, matching the renderers,
 * which skip such a path, and hit testing, which never matches it. The check
 * runs on every call rather than only at registration, so a command edited
 * in place after registration is caught too.
 */
export function traceCommands(
    ctx: CommandTraceTarget,
    commands: PathCommand[],
    worldToScreen: (x: number, y: number) => Coords,
    scale: number,
): void {
    if (!pathCommandsDrawable(commands)) {
        return;
    }
    const DEG = Math.PI / 180;
    for (const cmd of commands) {
        switch (cmd.type) {
            case "moveTo": {
                const p = worldToScreen(cmd.x, cmd.y);
                ctx.moveTo(p.x, p.y);
                break;
            }
            case "lineTo": {
                const p = worldToScreen(cmd.x, cmd.y);
                ctx.lineTo(p.x, p.y);
                break;
            }
            case "arc": {
                const c = worldToScreen(cmd.x, cmd.y);
                const radius = cmd.radius * scale;
                const start = cmd.startAngle * DEG;
                const end = cmd.endAngle * DEG;
                // The list is valid, but the projection can still overflow
                // (a huge coordinate times the scale is Infinity). Skip the
                // arc then, as Canvas2D skips any call with a non-finite value.
                if (arcDrawable(c.x, c.y, radius, start, end)) {
                    ctx.arc(c.x, c.y, radius, start, end, cmd.ccw === true);
                }
                break;
            }
            case "quadraticCurveTo": {
                const cp = worldToScreen(cmd.cpx, cmd.cpy);
                const p = worldToScreen(cmd.x, cmd.y);
                ctx.quadraticCurveTo(cp.x, cp.y, p.x, p.y);
                break;
            }
            case "bezierCurveTo": {
                const cp1 = worldToScreen(cmd.cp1x, cmd.cp1y);
                const cp2 = worldToScreen(cmd.cp2x, cmd.cp2y);
                const p = worldToScreen(cmd.x, cmd.y);
                ctx.bezierCurveTo(cp1.x, cp1.y, cp2.x, cp2.y, p.x, p.y);
                break;
            }
            case "closePath": {
                ctx.closePath();
                break;
            }
        }
    }
}
