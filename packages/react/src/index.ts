// Main component
export { CanvasTileEngine } from "./components";

// Draw components
export {
    type RectProps,
    type CircleProps,
    type ImageProps,
    type SpriteProps,
    type GridLinesProps,
    type LineProps,
    type TextProps,
    type PathProps,
    type StaticRectProps,
    type StaticCircleProps,
    type StaticImageProps,
    type DrawFunctionProps,
} from "./components";

// Hooks
export { useCanvasTileEngine } from "./hooks";

// Context
export { useEngineContext, type EngineContextValue } from "./context";

// Types
export type {
    CanvasTileEngineProps,
    CanvasTileEngineConfig,
    Coords,
    DrawObject,
    EventHandlers,
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
    onWheelCallback,
    onZoomCallback,
    onDrawCallback,
    WheelInfo,
    Rect,
    Line,
    LineStyle,
    Circle,
    Text,
    PathItem,
    PathStyle,
    PathCommand,
    ImageItem,
    DrawHandle,
} from "./types";
export type { EngineHandle } from "./hooks/useCanvasTileEngine";

// Re-export core class and utilities
export {
    CanvasTileEngine as CanvasTileEngineCore,
    gridToSize,
    fitScale,
    itemsBounds,
    pathItemBounds,
    pathCommandsBounds,
    SpriteSheet,
    SpriteAnimator,
} from "@canvas-tile-engine/core";
export type {
    BoundedItem,
    FitScaleOptions,
    FitBoundsResult,
    SpriteRect,
    SpriteSheetOptions,
    SpriteAnimation,
} from "@canvas-tile-engine/core";

// Re-export the rest of core's app-facing types (everything but the
// renderer-author contracts), so a binding user never needs a second import
// from core just to name a type. Type-only: no runtime cost.
export type {
    // Config
    ZoomMode,
    KeyboardConfig,
    AccessibilityConfig,
    AccessibilityRole,
    ReducedMotionSetting,
    // Geometry and camera
    Bounds,
    FitBoundsOptions,
    DrawTransform,
    // Paint and text style
    Paint,
    LinearGradient,
    ColorStop,
    TextAlign,
    TextBaseline,
    FontWeight,
    // Draw options and paint-time callbacks
    DrawOptions,
    StaticDrawOptions,
    RectDrawOptions,
    CircleDrawOptions,
    TextDrawOptions,
    LineDrawOptions,
    PathDrawOptions,
    ImageDrawOptions,
    StyleOf,
    VisibleOf,
    InteractiveOf,
    ShapeDecorationStyle,
    TextDecorationStyle,
    LineDecorationStyle,
    PathDecorationStyle,
    // Hit testing
    HitResult,
    HitKind,
    HitTestOptions,
    HitTestRectOptions,
    // Callbacks
    ClickInfo,
} from "@canvas-tile-engine/core";
