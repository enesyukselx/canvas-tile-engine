---
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
---

Behavior change: the wrapper element now carries the accessible identity — `tabindex`, `role`, `aria-label`, `aria-describedby` — and every canvas the renderer manages gets `aria-hidden="true"`. Interactive surfaces become keyboard tab stops on upgrade; opt out with `accessibility: { focusable: false }`.

The wrapper, not a canvas, because `initStyles` gives the wrapper `overflow: hidden` (a focus ring on a canvas would be clipped away), both renderers can adopt an app-authored canvas so "the canvas" is ambiguous, and the WebGL renderer has two of them.

An attribute you set yourself on the wrapper is **never** overwritten, and teardown removes only what the renderer wrote. A canvas with fallback child content keeps it — that content is your own accessible alternative. A `:focus-visible` outline ships scoped to an engine class, so a global `outline: none` reset cannot produce an invisible tab stop.

Keyboard events bind to the wrapper (it carries the tab stop) while pointer events stay on the canvas (the coordinate math needs its bounding rect). Attributes re-apply when `engine.setAccessibility` runs.
