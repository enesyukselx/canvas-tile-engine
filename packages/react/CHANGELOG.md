# Changelog

All notable changes to `@canvas-tile-engine/react` will be documented in this file.

## [0.3.0] - 2026-01-08

-   Add @canvas-tile-engine/renderer-canvas package with Canvas2D implementation ([#59](https://github.com/enesyukselx/canvas-tile-engine/pull/59))
-   Refactor core package to be DOM-agnostic with IRenderer interface
-   Renderer now injected via constructor (dependency injection pattern)
-   Update React package to accept renderer as prop
-   Update docs, examples, and CI workflows for new architecture

## [0.2.0] - 2026-01-02

-   fix(core): prevent accidental click after pinch-to-zoom
-   feat(core): add config and runtime validation (#55)
-   feat(core): add rotation support to drawText (#54)
-   feat(core): refactor drawText API for consistency (#52)
-   fix(core): set wrapper height for preserve-scale responsive mode (#49)
-   feat(react): add loadImage method (#51)
-   fix(core): add touch tap support for click events (#48)

## [0.1.0] - 2025-12-27

-   fix(core): correct gridAligned calculation for odd/even tile counts (#47)
-   feat: add responsive mode with preserve-scale and preserve-viewport options (#46)
-   feat: add gridToSize utility for grid-based configuration (#32)
-   feat: add setScale method to public API (#45)
-   fix(core): clamp static cache source rect to prevent mobile renderig issues (#34)
-   fix(core): add touch event support for mouse callbacks (#33)

## [0.0.4] - 2025-12-21

-   feat: unify mouse event callback structures by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/24
-   feat: add onRightClick callback for right-click events by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/30
-   fix: ensure initial canvas top/left are set to 0 by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/25
-   feat: add gridAligned config option for pixel-perfect grid alignment by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/28
-   feat: add getVisibleBounds() to get visible viewport coordinates by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/29

## [0.0.3] - 2025-12-18

### Added

-   **onZoom** callback for zoom level changes

### Fixed

-   **Fixed draw components cleanup issue**: Stabilized engine handle reference to prevent unexpected `useEffect` cleanup when [isReady] state changes.

## [0.0.2] - 2024-12-18

### Fixed

-   **Dependency Issue** - Resolved an issue where the package was published with `workspace:*` version protocol, which is not supported by npm. It now correctly points to `@canvas-tile-engine/core@^0.0.1`.

## [0.0.1] - 2024-12-18

### Added

-   **CanvasTileEngine Component** - Declarative wrapper for core engine
-   **Compound Components**
    -   `<CanvasTileEngine.Rect>` - Draw rectangles
    -   `<CanvasTileEngine.Circle>` - Draw circles
    -   `<CanvasTileEngine.Image>` - Draw images
    -   `<CanvasTileEngine.GridLines>` - Draw grid overlay
    -   `<CanvasTileEngine.Line>` - Draw line segments
    -   `<CanvasTileEngine.Text>` - Draw text
    -   `<CanvasTileEngine.Path>` - Draw polylines
    -   `<CanvasTileEngine.StaticRect>` - Pre-rendered rectangles
    -   `<CanvasTileEngine.StaticCircle>` - Pre-rendered circles
    -   `<CanvasTileEngine.StaticImage>` - Pre-rendered images
    -   `<CanvasTileEngine.DrawFunction>` - Custom canvas drawing
-   **Hooks**
    -   `useCanvasTileEngine()` - Engine handle with imperative API
-   **Full TypeScript Support** - Complete type definitions
-   **Automatic Render Batching** - Multiple draw calls → single render
