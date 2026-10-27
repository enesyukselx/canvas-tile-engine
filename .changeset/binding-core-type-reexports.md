---
"@canvas-tile-engine/react": patch
"@canvas-tile-engine/react-native": patch
---

Re-export the rest of core's app-facing types, so binding code no longer needs a second import from `@canvas-tile-engine/core` to name them: `Bounds`, `FitBoundsOptions`, `DrawTransform`, `LinearGradient`, `Paint`, `ColorStop`, `TextAlign`, `TextBaseline`, `FontWeight`, `HitResult`, `HitKind`, `HitTestOptions`, `HitTestRectOptions`, `ClickInfo`, `ZoomMode`, `KeyboardConfig`, `AccessibilityConfig`, `AccessibilityRole`, `ReducedMotionSetting`, `StyleOf`, `VisibleOf`, `InteractiveOf`, the `*DrawOptions` types (`DrawOptions`, `StaticDrawOptions`, `RectDrawOptions`, `CircleDrawOptions`, `TextDrawOptions`, `LineDrawOptions`, `PathDrawOptions`, `ImageDrawOptions`) and the `*DecorationStyle` types. The re-exports are type-only, so bundles do not change. Only `normalizeConfig` and the renderer-author APIs (`IRenderer`, `IDrawAPI`, ...) remain core-only.
