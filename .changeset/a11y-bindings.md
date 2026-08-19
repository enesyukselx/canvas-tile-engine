---
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

The engine handle gains `setAccessibility(patch)` for updating the accessible name, description, role and tab-stop behavior at runtime — needed because both bindings read `config` once on mount.

React Native applies `accessible`, `accessibilityLabel`, `accessibilityHint` and `accessibilityRole` to the measured `View`, never to the Skia `Canvas`. Only `role: "image"` has a React Native equivalent; `"region"` and `"application"` are dropped and the label still announces.

Known limitation, documented rather than implied: on React Native this makes the surface **announced** but not **operable**. Keyboard camera control is DOM-only because React Native's core `View` has no key events, and `accessibilityActions` is not wired yet.

On the web, behavior change: interactive surfaces become keyboard tab stops by default and arrow keys pan them. Opt out with `accessibility: { focusable: false }`.
