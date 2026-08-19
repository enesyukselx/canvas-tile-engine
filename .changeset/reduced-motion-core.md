---
"@canvas-tile-engine/core": minor
---

Behavior change: engine-driven camera animation now honors the OS reduced-motion setting by default. `accessibility.reducedMotion` defaults to `"auto"`, so on upgrade every app whose users enable "reduce motion" silently loses animated `goCenter`, `goScale`, `fitBounds` and `resize` — they land instantly instead. That is the feature, but nobody opted into it: set `accessibility: { reducedMotion: false }` (or call `engine.setReducedMotion(false)`) to keep animating regardless of the OS.

Reduced motion **overrides an explicitly passed `durationMs`**. `goCenter(x, y, 800)` lands instantly when the preference is on; there is no per-call escape by design, because a hard-coded duration is exactly what the preference exists to suppress.

Scope is the engine's own camera animation only. `SpriteAnimator` and anything the app draws itself are untouched — call `animator.stop()` yourself if you need WCAG SC 2.2.2.

New API: `accessibility.reducedMotion` config, `engine.setReducedMotion(value)`, `engine.getReducedMotion()`, and the `ReducedMotionSetting` / `AccessibilityConfig` / `MotionPolicy` types. `getConfig().accessibility.reducedMotion` reports the preference as configured (possibly `"auto"`), so a persisted snapshot never turns "follow the OS" into a permanent choice; `getReducedMotion()` is the resolved value.

Breaking for direct `AnimationController` users: it is exported from this package and now takes a required 4th constructor parameter, the motion policy (pass the engine's `Config`, or any `{ getReducedMotion, effectiveDuration }`). Deliberate — the compile error is what keeps the engine and the three renderers consistent. `Required<CanvasTileEngineConfig>` also gains a required top-level `accessibility` key, which only affects code constructing that type by hand.
