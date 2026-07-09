---
"@canvas-tile-engine/core": minor
---

Catch-up release: everything merged since 0.3.0.

**Features**

- Spritesheet & animation support: `ImageItem.sprite` (`SpriteRect`), `SpriteSheet` frame calculator (margin/spacing, `frame`/`frameByIndex`/`framesInRow`), and `SpriteAnimator` rAF loop that only re-renders on frame change (#107)
- Zoom anchor modes for `eventHandlers.zoom` ("pointer" / "center") (#104)
- Engine and renderer interfaces (`IRenderer`, `IDrawAPI`, `IImageLoader`) are now generic over mount/image types, enabling non-DOM renderers (server, React Native Skia)

**Fixes**

- Keep camera fixed during pinch zoom in "center" anchor mode (#105)
- Fire `onZoom` for programmatic zoom changes; notify `onCoordsChange` when `setBounds` moves the camera; guard pinch zoom against near-zero start distance; validate `scale` against `minScale`/`maxScale`; complete animations instantly when duration is 0 (#100)

**Breaking notes** (0.x minor)

- The unused optional `renderer` property was removed from the config type — remove it from your config object if you passed it
- `Config.get()` now returns a frozen snapshot — mutate config via the engine API instead of mutating the returned object (#100)
