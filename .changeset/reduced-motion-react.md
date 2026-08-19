---
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

The engine handle gains `setReducedMotion(value)` and `getReducedMotion()`. `getReducedMotion()` returns `false` before mount, matching the handle's neutral-default convention.

Behavior change: engine-driven camera animation now follows the platform reduced-motion setting by default. On the web that signal comes from the renderer's `prefers-reduced-motion` watcher; on React Native the binding subscribes to `AccessibilityInfo` itself, so apps wire nothing. When in effect it overrides an explicitly passed `durationMs`; the opt-out is `accessibility: { reducedMotion: false }` or `engine.setReducedMotion(false)`.
