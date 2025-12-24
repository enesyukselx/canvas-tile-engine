# Changelog

All notable changes to `@canvas-tile-engine/core` will be documented in this file.

## [0.0.4] - 2025-12-24

-   fix: improve lineWidth rendering consistency across browsers

## [0.0.3] - 2025-12-21

-   feat: unify mouse event callback structures by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/24
-   feat: add onRightClick callback for right-click events by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/30
-   fix: ensure initial canvas top/left are set to 0 by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/25
-   feat: add gridAligned config option for pixel-perfect grid alignment by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/28
-   feat: add getVisibleBounds() to get visible viewport coordinates by @enesyukselx in https://github.com/enesyukselx/canvas-tile-engine/pull/29

## [0.0.2] - 2025-12-18

### Added

-   **onZoom** callback for zoom level changes

## [0.0.1] - 2024-12-18

### Added

-   **Camera System** - Pan, zoom, drag with smooth animations
-   **Coordinate System** - Grid-based world coordinates with automatic transformations
-   **Layer-based Rendering**
    -   `drawRect` - Rectangles with rotation and border-radius
    -   `drawCircle` - Circles sized in world units
    -   `drawImage` - Images with rotation support
    -   `drawLine` - Line segments
    -   `drawPath` - Polylines
    -   `drawText` - Text at world positions
    -   `drawGridLines` - Grid overlay
-   **Performance Optimizations**
    -   Spatial indexing with R-Tree (rbush) for 10k+ items
    -   Viewport culling - skip off-screen work
    -   Static cache (`drawStaticRect`, `drawStaticImage`, `drawStaticCircle`)
-   **Event Handling** - click, hover, drag, zoom, resize
-   **Animation Controller** - `goCoords()` with smooth transitions
-   **Bounds System** - Restrict camera movement
-   **Debug HUD** - Coordinate overlay, FPS counter, viewport info
-   **ImageLoader** - Async image loading with caching
