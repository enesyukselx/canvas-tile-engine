export { CanvasTileEngine } from "./CanvasTileEngine";
// Types export
export type * from "./types";
// Constants export
export * from "./constants";
// Utilities
export { gridToSize } from "./utils/gridToSize";
export { fitScale, type FitScaleOptions } from "./utils/fitScale";
export { resolveLineWidthPx, resolveLineDashPx, resolveRadiusPx, resolveCornerRadiusPx } from "./utils/strokeStyle";
export { cornerArc } from "./utils/pathCorners";
export { traceRoundedPath, traceCommands, type PathTraceTarget, type CommandTraceTarget } from "./utils/tracePath";
export { roundedPolyline, roundedRing, ARC_SEGMENT_LENGTH } from "./utils/pathFlatten";
export { resolveSizePx, resolveSizeWorld } from "./utils/itemSize";
export { flattenPathCommands, pathCommandsBounds, type Subpath } from "./utils/flattenPath";
export type { CornerArc } from "./utils/pathCorners";
// Additional core modules
export { Config } from "./modules/Config";
export { ViewportState } from "./modules/ViewportState";
export { CoordinateTransformer } from "./modules/CoordinateTransformer";
export { SpatialIndex } from "./modules/SpatialIndex";
export type { HitResult, HitTestOptions, HitTestRectOptions, HitKind } from "./modules/HitTester";
export { GestureProcessor } from "./modules/GestureProcessor";
export type { NormalizedPointer, NormalizedPinch, ProcessedCoords, CanvasBounds } from "./modules/GestureProcessor";
export { AnimationController } from "./modules/AnimationController";
export { SpriteSheet } from "./modules/SpriteSheet";
export type { SpriteSheetOptions } from "./modules/SpriteSheet";
export { SpriteAnimator } from "./modules/SpriteAnimator";
export type { SpriteAnimation } from "./modules/SpriteAnimator";
