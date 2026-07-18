import type { Coords, PathCommand } from "../types";

/** One flattened subpath: a polyline plus whether it closes back to its start. */
export interface Subpath {
    points: Coords[];
    closed: boolean;
}

const TWO_PI = Math.PI * 2;
const DEG = Math.PI / 180;

/**
 * Canvas2D-compatible arc sweep: from `start` towards `end` in the chosen
 * direction, clamped to a full circle, in radians.
 */
function arcSweep(startRad: number, endRad: number, ccw: boolean): number {
    let sweep = endRad - startRad;
    if (!ccw) {
        if (sweep <= 0) sweep = (sweep % TWO_PI) + TWO_PI;
        else if (sweep > TWO_PI) sweep = TWO_PI;
    } else {
        if (sweep >= 0) sweep = (sweep % TWO_PI) - TWO_PI;
        else if (sweep < -TWO_PI) sweep = -TWO_PI;
    }
    return sweep;
}

/**
 * Flattens a Canvas2D-style command list into polyline subpaths, following
 * Canvas2D path semantics: each `moveTo` starts a new subpath; `lineTo`/
 * curves with no open subpath implicitly move first; `arc` draws a
 * connecting line from the current point to the arc start; after
 * `closePath` the current point is the closed subpath's start.
 *
 * All consumers of flattened geometry (hit testing, WebGL, culling) share
 * this one implementation so they agree exactly. `maxSegment` is the max
 * spacing between samples, in the same unit as the coordinates — callers
 * flatten in world units with `ARC_SEGMENT_LENGTH / scale` to sample at the
 * renderers' screen-pixel density.
 */
export function flattenPathCommands(commands: PathCommand[], maxSegment: number): Subpath[] {
    const subpaths: Subpath[] = [];
    let current: Coords[] = [];
    let closed = false;

    const flush = () => {
        if (current.length > 1 || (current.length === 1 && closed)) {
            subpaths.push({ points: current, closed });
        }
        current = [];
        closed = false;
    };

    const point = (x: number, y: number) => {
        current.push({ x, y });
    };

    const steps = (length: number) => Math.min(256, Math.max(2, Math.ceil(length / Math.max(1e-9, maxSegment))));

    for (const cmd of commands) {
        switch (cmd.type) {
            case "moveTo": {
                flush();
                point(cmd.x, cmd.y);
                break;
            }
            case "lineTo": {
                point(cmd.x, cmd.y);
                break;
            }
            case "arc": {
                const start = cmd.startAngle * DEG;
                const sweep = arcSweep(start, cmd.endAngle * DEG, cmd.ccw === true);
                const startPt = {
                    x: cmd.x + Math.cos(start) * cmd.radius,
                    y: cmd.y + Math.sin(start) * cmd.radius,
                };
                // Connecting line (or implicit move) to the arc start
                point(startPt.x, startPt.y);
                const n = steps(Math.abs(sweep) * cmd.radius);
                for (let k = 1; k <= n; k++) {
                    const angle = start + (sweep * k) / n;
                    point(cmd.x + Math.cos(angle) * cmd.radius, cmd.y + Math.sin(angle) * cmd.radius);
                }
                break;
            }
            case "quadraticCurveTo": {
                const from = current[current.length - 1] ?? { x: cmd.cpx, y: cmd.cpy };
                if (current.length === 0) point(from.x, from.y);
                const hull =
                    Math.hypot(cmd.cpx - from.x, cmd.cpy - from.y) + Math.hypot(cmd.x - cmd.cpx, cmd.y - cmd.cpy);
                const n = steps(hull);
                for (let k = 1; k <= n; k++) {
                    const t = k / n;
                    const u = 1 - t;
                    point(
                        u * u * from.x + 2 * u * t * cmd.cpx + t * t * cmd.x,
                        u * u * from.y + 2 * u * t * cmd.cpy + t * t * cmd.y,
                    );
                }
                break;
            }
            case "bezierCurveTo": {
                const from = current[current.length - 1] ?? { x: cmd.cp1x, y: cmd.cp1y };
                if (current.length === 0) point(from.x, from.y);
                const hull =
                    Math.hypot(cmd.cp1x - from.x, cmd.cp1y - from.y) +
                    Math.hypot(cmd.cp2x - cmd.cp1x, cmd.cp2y - cmd.cp1y) +
                    Math.hypot(cmd.x - cmd.cp2x, cmd.y - cmd.cp2y);
                const n = steps(hull);
                for (let k = 1; k <= n; k++) {
                    const t = k / n;
                    const u = 1 - t;
                    point(
                        u * u * u * from.x + 3 * u * u * t * cmd.cp1x + 3 * u * t * t * cmd.cp2x + t * t * t * cmd.x,
                        u * u * u * from.y + 3 * u * u * t * cmd.cp1y + 3 * u * t * t * cmd.cp2y + t * t * t * cmd.y,
                    );
                }
                break;
            }
            case "closePath": {
                if (current.length > 0) {
                    const start = current[0];
                    closed = true;
                    flush();
                    // Canvas2D: the current point becomes the subpath start;
                    // a following draw command continues from there.
                    current = [{ x: start.x, y: start.y }];
                }
                break;
            }
        }
    }
    flush();
    return subpaths;
}

/**
 * Conservative world-space bounds of a command list from its control-point
 * hull: every endpoint and control point, and each arc's full center±radius
 * box. Curves never leave their control hull, so this over-approximates —
 * cheap, camera-independent, and safe for culling. Returns null for an
 * empty list.
 */
export function pathCommandsBounds(
    commands: PathCommand[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const add = (x: number, y: number) => {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
    };
    for (const cmd of commands) {
        switch (cmd.type) {
            case "moveTo":
            case "lineTo":
                add(cmd.x, cmd.y);
                break;
            case "arc":
                add(cmd.x - cmd.radius, cmd.y - cmd.radius);
                add(cmd.x + cmd.radius, cmd.y + cmd.radius);
                break;
            case "quadraticCurveTo":
                add(cmd.cpx, cmd.cpy);
                add(cmd.x, cmd.y);
                break;
            case "bezierCurveTo":
                add(cmd.cp1x, cmd.cp1y);
                add(cmd.cp2x, cmd.cp2y);
                add(cmd.x, cmd.y);
                break;
            case "closePath":
                break;
        }
    }
    if (minX === Infinity) return null;
    return { minX, minY, maxX, maxY };
}
