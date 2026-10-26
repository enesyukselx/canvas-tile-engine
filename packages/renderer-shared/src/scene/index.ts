// Platform-free per-frame plumbing shared by every renderer: layer ordering,
// FPS sampling, and the debug HUD / coordinate overlay layout. Nothing here
// touches a drawing context — renderers paint what these modules compute.
export { Layer, type ClipAdapter, type DrawContext, type DrawCallback, type LayerContext } from "./Layer";
export { FpsSampler } from "./FpsSampler";
export { computeHudLayout, HUD_STYLE, type HudCamera, type HudLayout, type HudTextLine } from "./hudLayout";
export {
    coordinateOverlayBorders,
    coordinateOverlayFontSize,
    forEachCoordinateLabel,
    shouldDrawCoordinateOverlay,
    COORDINATE_OVERLAY_STYLE,
    type CoordinateOverlayBorders,
    type OverlayCamera,
} from "./coordinateOverlayLayout";
export type { ScreenRect, ScreenSize } from "./types";
export { clipRectPx } from "./clip";
