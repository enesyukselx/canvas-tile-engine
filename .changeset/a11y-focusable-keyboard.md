---
"@canvas-tile-engine/core": minor
---

Behavior change: an interactive surface is now a keyboard tab stop by default, and arrow keys pan it. `accessibility.focusable` defaults to `true` whenever any pointer interaction is enabled (or `eventHandlers.keyboard: true`) and to `false` when `eventHandlers.keyboard` is `false`, so on upgrade every map, board and editor gains a `tabindex` it did not have — tab order shifts, and an app with a global `outline: none` reset would show an invisible stop if the engine did not ship its own `:focus-visible` outline. Set `accessibility: { focusable: false }` to opt out.

Keyboard control MIRRORS the pointer gates rather than adding a third axis: arrows pan only if `eventHandlers.drag` is on, `+`/`-` zoom only if `zoom` is on, `Enter`/`Space` activate only if `click` is on. Every event handler defaults to `false`, so a deliberately static board is unaffected. `eventHandlers.keyboard: true` forces the bindings on, `false` off, and the object form sets the step sizes (`panPx` default 80, wins over `pan`; `zoomFactor` default 1.5).

`Enter`/`Space` fire the EXISTING `onClick` at the viewport center rather than a new callback — the coordinates are truthful, since the center is genuinely where the activation points. `onClickCallback` gains a trailing optional `info?: { source: "pointer" | "keyboard" }`; existing three-argument callbacks stay assignable, but a test asserting the exact call arity will see the new argument.

`preventDefault` runs only for a key the engine consumed. `Tab`, `Escape`, `Home`, `End`, `PageUp` and `PageDown` are never captured, so the surface can never become a keyboard trap, and Ctrl/Meta/Alt combinations are ignored so browser and screen-reader shortcuts keep working (Shift is honored only on the zoom keys, since `+` and `_` *are* Shift+`=` and Shift+`-`). Keyboard zoom reports through `onZoom` only, never `onWheel`.

New API: `accessibility.label` / `.description` / `.role` / `.focusable`, `eventHandlers.keyboard`, `engine.setAccessibility(patch)` / `engine.onAccessibilityChange(listener)`, and the `AccessibilityRole` / `KeyboardConfig` / `ClickInfo` types. `role` is a narrow union (`"region" | "image" | "application"`) rather than an ARIA passthrough, because widening a union later is free while narrowing a shipped string is a compile break. There is no default accessible name: with no `label`, neither `aria-label` nor `role` is written.
