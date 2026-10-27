// Renderer-agnostic world-space geometry shared by every renderer's draw
// pipeline. Pure math only: no context, no platform types.
//
// Item-bounds helpers live in core instead (`itemsBounds`, `pathItemBounds`):
// app code needs those, so they are part of the public API.
export { getViewportBounds, isVisible } from "./culling";
export { gridLineStep, MIN_GRID_LINE_SPACING_PX } from "./gridStep";
export {
    staticCacheBounds,
    staticRectPaintBounds,
    staticCirclePaintBounds,
    staticImagePaintBounds,
} from "./staticBounds";
export {
    boxPaintBounds,
    boxPixelPadding,
    linePaintBounds,
    pathPaintBounds,
    textPaintBounds,
    intersectsBounds,
    PaintedCuller,
    UNBOUNDED,
} from "./paintedBounds";
