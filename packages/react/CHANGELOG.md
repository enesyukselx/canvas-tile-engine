# Changelog

## 0.5.0

### Minor Changes

- ff94c7a: Expose `hitTest` / `hitTestFirst` on the `useCanvasTileEngine()` handle. Like the other handle methods they are safe before mount (empty array / `undefined`), so no null checks or `engine.instance` escape hatch needed. Results are typed with the platform image handle (`HTMLImageElement` / `SkImage`).
- 38a5d18: Remove the dead `config.cursor` option. It has not been applied by any renderer since the modular renderer architecture refactor - the engine never touches `canvas.style.cursor`, so the option silently did nothing while the docs claimed otherwise.

  Cursor styling is fully owned by the application: set `engine.canvas.style.cursor` from the event callbacks (`onMouseDown`/`onMouseUp`/`onMouseLeave`/`onHover`). See the new "Managing the Cursor" section in the events docs for the recommended pattern - in particular, always reset the cursor in `onMouseLeave` too, because releasing the mouse button outside the canvas never fires `onMouseUp`.

  Passing `cursor` in the config is now a type error; delete the field. Runtime behavior is unchanged (it was already ignored).

### Patch Changes

- Updated dependencies [ff94c7a]
- Updated dependencies [153eacc]
- Updated dependencies [fafe337]
- Updated dependencies [38a5d18]
- Updated dependencies [1be475c]
  - @canvas-tile-engine/core@0.7.0

## 0.4.3

### Patch Changes

- c9a1fe3: Fix imperative draw effects keyed on `engine.instance` never re-firing after a `key` remount.

  `_setInstance` drove re-renders through a boolean `isReady` state. A key remount calls it twice in one flush (`null`, then the new engine), so the boolean collapses back to `true` — React treats the update as a no-op, discards the re-render, and skips consumer effects entirely, **even ones whose deps (`engine.instance`) changed**. The new engine ended up with zero registered draws: a blank canvas at full fps. Declarative children were unaffected (fixed in #117); this completes the story for the imperative path the docs recommend.

  The hook now bumps a monotonically increasing counter per `_setInstance` call, so the post-remount render always commits and effects depending on `engine.instance` re-fire.

- c9a1fe3: Fix declarative children (notably `GridLines` and `DrawFunction`) disappearing after Fast Refresh.

  `useCanvasTileEngine` built its handle with `useMemo`, which React treats as a discardable cache — Fast Refresh invalidates it, producing a new handle identity. That remounted the engine instance, and because child effects run before parent effects, every child's draw registration landed on a not-yet-created engine and was dropped. Components whose props changed identity afterwards (e.g. `items` arrays re-set by app effects) silently re-registered; components with only primitive or ref-held props (`GridLines`, `DrawFunction`) stayed blank.

  The handle now lives in a `useRef`, guaranteeing one identity for the component's whole lifetime. As a side effect, editing app code no longer destroys and recreates the engine, so camera position and zoom survive Fast Refresh too.

## 0.4.2

### Patch Changes

- 7a61024: Fix declarative children silently drawing nothing after a `key` remount.

  The children gate used `engine.isReady`, which reads the shared handle. During a key-driven remount the old engine is still attached at render time, so children mounted immediately and their draw effects ran in the null-instance window between the old engine's destroy and the new engine's creation (child effects fire before parent effects) — every registration was dropped into a dummy handle and the new canvas stayed blank with no error. The gate is now component-local state that starts `false` on every mount, so children always mount after their own engine exists, exactly like the first-mount path.

  Draw calls that arrive while no engine is mounted now also log a dev-only `console.warn` instead of failing silently. For imperative setups that must survive remounts, depend on `engine.instance` (changes identity per engine) rather than `engine.isReady` (collapses back to `true` within the remount flush).

- Updated dependencies [79db244]
  - @canvas-tile-engine/core@0.6.0

## 0.4.1

### Patch Changes

- Updated dependencies [35f9532]
  - @canvas-tile-engine/core@0.5.0

## 0.4.0

### Minor Changes

- 2068dac: Catch-up release: everything merged since 0.3.0.

  **Features**

  - Declarative `<CanvasTileEngine.Sprite>` compound component for spritesheet animation (frames/fps/loop/playing/onComplete); re-exports `SpriteSheet`, `SpriteAnimator` and sprite types from core (#107)

  **Fixes**

  - Repaint canvas on draw component unmount and on `DrawFunction` updates (#99)

  **Compatibility**

  - Requires `@canvas-tile-engine/core` >= 0.4.0 (peer dependency raised)

### Patch Changes

- 2068dac: Publish internal `@canvas-tile-engine/core` dependency as a caret range (`^x.y.z`) instead of an exact pin, so core patch/minor updates flow to consumers without requiring a re-release of dependent packages.
- Updated dependencies [2068dac]
  - @canvas-tile-engine/core@0.4.0

All notable changes to `@canvas-tile-engine/react` will be documented in this file.

## [0.3.0] - 2026-01-08

- Add @canvas-tile-engine/renderer-canvas package with Canvas2D implementation ([#59](https://github.com/enesyukselx/canvas-tile-engine/pull/59))
- Refactor core package to be DOM-agnostic with IRenderer interface
- Renderer now injected via constructor (dependency injection pattern)
- Update React package to accept renderer as prop
- Update docs, examples, and CI workflows for new architecture

## [0.2.0] - 2026-01-02

- fix(core): prevent accidental click after pinch-to-zoom
- feat(core): add config and runtime validation (#55)
- feat(core): add rotation support to drawText (#54)
- feat(core): refactor drawText API for consistency (#52)
- fix(core): set wrapper height for preserve-scale responsive mode (#49)
- feat(react): add loadImage method (#51)
- fix(core): add touch tap support for click events (#48)

## [0.1.0] - 2025-12-27

- fix(core): correct gridAligned calculation for odd/even tile counts (#47)
- feat: add responsive mode with preserve-scale and preserve-viewport options (#46)
- feat: add gridToSize utility for grid-based configuration (#32)
- feat: add setScale method to public API (#45)
- fix(core): clamp static cache source rect to prevent mobile renderig issues (#34)
- fix(core): add touch event support for mouse callbacks (#33)

## [0.0.4] - 2025-12-21

- feat: unify mouse event callback structures by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/24
- feat: add onRightClick callback for right-click events by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/30
- fix: ensure initial canvas top/left are set to 0 by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/25
- feat: add gridAligned config option for pixel-perfect grid alignment by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/28
- feat: add getVisibleBounds() to get visible viewport coordinates by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/29

## [0.0.3] - 2025-12-18

### Added

- **onZoom** callback for zoom level changes

### Fixed

- **Fixed draw components cleanup issue**: Stabilized engine handle reference to prevent unexpected `useEffect` cleanup when [isReady] state changes.

## [0.0.2] - 2024-12-18

### Fixed

- **Dependency Issue** - Resolved an issue where the package was published with `workspace:*` version protocol, which is not supported by npm. It now correctly points to `@canvas-tile-engine/core@^0.0.1`.

## [0.0.1] - 2024-12-18

### Added

- **CanvasTileEngine Component** - Declarative wrapper for core engine
- **Compound Components**
  - `<CanvasTileEngine.Rect>` - Draw rectangles
  - `<CanvasTileEngine.Circle>` - Draw circles
  - `<CanvasTileEngine.Image>` - Draw images
  - `<CanvasTileEngine.GridLines>` - Draw grid overlay
  - `<CanvasTileEngine.Line>` - Draw line segments
  - `<CanvasTileEngine.Text>` - Draw text
  - `<CanvasTileEngine.Path>` - Draw polylines
  - `<CanvasTileEngine.StaticRect>` - Pre-rendered rectangles
  - `<CanvasTileEngine.StaticCircle>` - Pre-rendered circles
  - `<CanvasTileEngine.StaticImage>` - Pre-rendered images
  - `<CanvasTileEngine.DrawFunction>` - Custom canvas drawing
- **Hooks**
  - `useCanvasTileEngine()` - Engine handle with imperative API
- **Full TypeScript Support** - Complete type definitions
- **Automatic Render Batching** - Multiple draw calls → single render
