/**
 * Positions must be finite. An item whose `x`/`y`, line endpoint or path point
 * is `NaN` or ±Infinity paints nothing and never hits, on every renderer: the
 * renderers' culling, the static caches, the hit tester, `SpatialIndex` and
 * `itemsBounds` all reject it through this one check. (Without it the
 * renderers disagreed: Canvas2D silently dropped the point, `@napi-rs/canvas`
 * aborted the process on an arc, and one bad item emptied a Skia picture or
 * blanked a spatial index.)
 *
 * Two `Number.isFinite` calls and no allocation, so it is cheap enough for
 * per-item, per-frame use.
 */
export function isFinitePoint(point: { x: number; y: number }): boolean {
    return Number.isFinite(point.x) && Number.isFinite(point.y);
}
