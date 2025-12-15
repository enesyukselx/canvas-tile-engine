// Main component
export { CanvasTileEngine } from "./components";

// Draw components
export {
    Rect,
    Circle,
    Image,
    GridLines,
    Line,
    Text,
    Path,
    StaticRect,
    StaticCircle,
    StaticImage,
    DrawFunction,
    type RectProps,
    type CircleProps,
    type ImageProps,
    type ImageItem,
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
export type { CanvasTileEngineProps, Coords, CanvasTileEngineConfig } from "./types";
export type { EngineHandle } from "./hooks/useCanvasTileEngine";

// Re-export core class with different name
export { CanvasTileEngine as CanvasTileEngineCore } from "@canvas-tile-engine/core";
