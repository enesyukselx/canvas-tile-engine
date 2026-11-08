---
"@canvas-tile-engine/react-native": patch
---

Fix: a `responsive` mode in the config no longer freezes the native map at its first layout size.

The component resizes the engine on every layout change, but core's `resize()` refuses to run while `responsive` is set, so with `"preserve-scale"`, `"preserve-viewport"` or `"fill"` (often from a config shared with a web build) the viewport kept its first non-zero size. After a rotation, split view, or a container that changed size, part of the view stayed unpainted or clipped, culling, grid lines and camera bounds kept the old size, `getSize()` went stale, `onResize` never fired, and every layout change logged a "resize() is disabled" warning.

React Native has no responsive modes, so the component now builds the engine with `responsive` turned off and warns once in development when the config sets it. The view follows every layout change again (center kept, scale unchanged) and `onResize` fires. `getConfig().responsive` reports `false` on native, which matches the pre-mount snapshot.
