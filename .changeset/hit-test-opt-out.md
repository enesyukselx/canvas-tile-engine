---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
"@canvas-tile-engine/react-native": minor
---

feat: hitTest: false — per-registration hit-testing opt-out

- Every engine draw method's options (and a new `options` parameter on the static draw helpers) accept `hitTest: false`, keeping that registration out of `hitTest`/`hitTestFirst`/`hitTestRect` — the `pointer-events: none` of the draw API. Decorative content (floor tiles, background images, zone overlays) is declared once at registration instead of being filtered at every query site, so a marquee over the board selects units, not the floor.
- Opted-out registrations skip hit-registry bookkeeping entirely: large decorative sets stop paying the hit-side spatial-index cost. Re-registering under the same `id`/`cacheKey` with the flag changed toggles participation atomically.
- React and React Native: all draw components that participate in hit testing (`Rect`, `Circle`, `Image`, `Sprite`, `Line`, `Path`, `StaticRect`, `StaticCircle`, `StaticImage`) accept a `hitTest` prop, and the imperative handle's `drawImage`/`drawStatic*` signatures take the new options parameter.
- Purely core-side mechanics — no renderer package is involved. Text and custom draw functions never entered hit testing and are unaffected.
