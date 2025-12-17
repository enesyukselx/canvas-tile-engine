# Changelog

All notable changes to `@canvas-tile-engine/core` will be documented in this file.

## [0.0.1] - 2024-12-18

### Added

- **Camera System** - Pan, zoom, drag with smooth animations
- **Coordinate System** - Grid-based world coordinates with automatic transformations
- **Layer-based Rendering**
  - `drawRect` - Rectangles with rotation and border-radius
  - `drawCircle` - Circles sized in world units
  - `drawImage` - Images with rotation support
  - `drawLine` - Line segments
  - `drawPath` - Polylines
  - `drawText` - Text at world positions
  - `drawGridLines` - Grid overlay
- **Performance Optimizations**
  - Spatial indexing with R-Tree (rbush) for 10k+ items
  - Viewport culling - skip off-screen work
  - Static cache (`drawStaticRect`, `drawStaticImage`, `drawStaticCircle`)
- **Event Handling** - click, hover, drag, zoom, resize
- **Animation Controller** - `goCoords()` with smooth transitions
- **Bounds System** - Restrict camera movement
- **Debug HUD** - Coordinate overlay, FPS counter, viewport info
- **ImageLoader** - Async image loading with caching
