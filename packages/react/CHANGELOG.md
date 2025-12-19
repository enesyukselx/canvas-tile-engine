# Changelog

All notable changes to `@canvas-tile-engine/react` will be documented in this file.

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
