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
export type { EngineHandle, SkiaEngine } from "./hooks/useCanvasTileEngine";

// Re-export the Skia surface (via renderer-skia) so app code never imports from
// @shopify/react-native-skia directly for custom draw functions or image types.
export { Skia } from "@canvas-tile-engine/renderer-skia";
export type {
    SkCanvas,
    SkImage,
    SkPaint,
    SkFont,
    SkPath,
    SkRect,
    SkPoint,
    SkRRect,
    SkiaImageItem,
} from "@canvas-tile-engine/renderer-skia";

// Re-export core class and utilities
// Portable scene documents (core >= 0.12).
export {
    SCENE_SCHEMA_VERSION,
    DEFAULT_SCENE_LIMITS,
    SceneValidationError,
    SceneAttachmentError,
    PreparedScene,
    createSceneDocument,
    validateSceneDocument,
    parseSceneDocument,
    stringifySceneDocument,
    prepareScene,
} from "@canvas-tile-engine/core";
export type {
    SceneJsonValue,
    SceneJsonObject,
    SceneKind,
    SceneAsset,
    SceneCamera,
    SceneRect,
    SceneCircle,
    SceneLine,
    SceneText,
    ScenePath,
    SceneImage,
    SceneItemMap,
    SceneRuntimeItemMap,
    SceneBatch,
    SceneLayer,
    SceneDocument,
    SceneDocumentInput,
    SceneLimits,
    SceneMigration,
    SceneMigrations,
    SceneReadOptions,
    PrepareSceneOptions,
    SceneCollection,
    SceneTarget,
    SceneAttachment,
    SceneAttachOptions,
} from "@canvas-tile-engine/core";

export {
    CanvasTileEngine as CanvasTileEngineCore,
    ConfigValidationError,
    ItemCollection,
    isItemCollection,
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
    ItemKey,
    ItemCollectionOptions,
    ItemCollectionChange,
    ReadonlyItemCollection,
    DrawItems,
} from "@canvas-tile-engine/core";

// Re-export the rest of core's app-facing types (everything but the
// renderer-author contracts), so a binding user never needs a second import
// from core just to name a type. Type-only: no runtime cost. Same list as
// @canvas-tile-engine/react. `KeyboardConfig` is inert here (React Native's
// View has no key events) but stays for parity with `EventHandlers`.
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
