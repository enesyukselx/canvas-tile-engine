---
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
---

Behavior change: both renderers now watch `prefers-reduced-motion` and feed it to the engine, so on upgrade users with the OS setting enabled get instant camera movement instead of animation. The opt-out is `accessibility: { reducedMotion: false }` in the engine config.

The watcher starts unconditionally in `setupEvents()` — reduced motion is an accessibility preference, not one of the opt-in `eventHandlers` — and stops in `destroy()`. It only ever writes the platform slot, so an explicit app preference always wins.
