// Renderer-agnostic world-space geometry shared by every renderer's draw
// pipeline. Pure math only: no context, no platform types.
export { getViewportBounds, isVisible } from "./culling";
export { pathItemBounds } from "./pathBounds";
