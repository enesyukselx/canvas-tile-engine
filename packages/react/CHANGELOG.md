# Changelog

All notable changes to `@canvas-tile-engine/react` will be documented in this file.

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
