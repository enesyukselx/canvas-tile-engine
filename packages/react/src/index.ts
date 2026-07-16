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
    type PolygonProps,
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
    onHoverCallback,
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
    onDrawCallback,
    Rect,
    Line,
    Circle,
    Text,
    Path,
    Polygon,
    ImageItem,
} from "./types";
export type { EngineHandle } from "./hooks/useCanvasTileEngine";

// Re-export core class and utilities
export {
    CanvasTileEngine as CanvasTileEngineCore,
    gridToSize,
    SpriteSheet,
    SpriteAnimator,
} from "@canvas-tile-engine/core";
export type { SpriteRect, SpriteSheetOptions, SpriteAnimation } from "@canvas-tile-engine/core";
