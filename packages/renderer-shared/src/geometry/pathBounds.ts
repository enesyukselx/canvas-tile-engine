import { pathCommandsBounds } from "@canvas-tile-engine/core";
import type { Bounds, PathItem } from "@canvas-tile-engine/core";

/**
 * Conservative world bounds of one path item, computed once per registration
 * and reused every frame for culling: the control-point hull for command
 * paths (via core's `pathCommandsBounds`), the vertex box for polylines.
 *
 * Null means "no drawable geometry" — an empty command list, or fewer than
 * two points — and the renderers skip such items entirely.
 */
export function pathItemBounds(item: PathItem): Bounds | null {
    if (item.commands !== undefined) {
        return pathCommandsBounds(item.commands);
    }

    const points = item.points;
    if (!points || points.length < 2) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) {
            minX = p.x;
        }
        if (p.y < minY) {
            minY = p.y;
        }
        if (p.x > maxX) {
            maxX = p.x;
        }
        if (p.y > maxY) {
            maxY = p.y;
        }
    }
    return { minX, maxX, minY, maxY };
}
