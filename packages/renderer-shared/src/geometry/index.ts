// Renderer-agnostic world-space geometry shared by every renderer's draw
// pipeline. Pure math only: no context, no platform types.
//
// Item-bounds helpers live in core instead (`itemsBounds`, `pathItemBounds`):
// app code needs those, so they are part of the public API.
export { getViewportBounds, isVisible } from "./culling";
