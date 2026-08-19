---
"@canvas-tile-engine/renderer-skia": patch
---

Internal: the renderer's animation controller now receives the engine's config as its motion policy, so `resizeWithAnimation` honors the reduced-motion preference like every other engine animation. No API change; the React Native binding supplies the platform signal.
