# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Canvas Tile Engine is a monorepo containing a lightweight library for building interactive 2D grid-based maps and visualizations using HTML Canvas. It provides camera controls, coordinate transformations, rendering, and user interactions.

The architecture follows a modular renderer pattern with dependency injection, separating core calculations from platform-specific rendering implementations.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (core must build before react, renderer-canvas is standalone)
pnpm build

# Build renderer-canvas separately
pnpm --filter @canvas-tile-engine/renderer-canvas build

# Run development mode (core + vanilla example)
pnpm dev

# Run specific example
pnpm dev:example --example=<example-name>

# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck

# Run tests (core package only)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run a single test file
pnpm --filter @canvas-tile-engine/core test -- <test-file-pattern>

# Watch mode for tests
pnpm --filter @canvas-tile-engine/core test -- --watch
```

### Package-specific commands

```bash
# Core package
pnpm --filter @canvas-tile-engine/core dev       # Watch mode
pnpm --filter @canvas-tile-engine/core test      # Run tests
pnpm --filter @canvas-tile-engine/core typecheck # Type check

# React package
pnpm --filter @canvas-tile-engine/react dev      # Watch mode
pnpm --filter @canvas-tile-engine/react typecheck

# Renderer Canvas package
pnpm --filter @canvas-tile-engine/renderer-canvas build
pnpm --filter @canvas-tile-engine/renderer-canvas dev
```

## Architecture

### Monorepo Structure

-   `packages/core/` - `@canvas-tile-engine/core`: Framework-agnostic engine (DOM-agnostic calculations)
-   `packages/renderer-canvas/` - `@canvas-tile-engine/renderer-canvas`: Canvas2D renderer implementation
-   `packages/react/` - `@canvas-tile-engine/react`: React bindings (depends on core)
-   `examples/` - Example projects (vanilla-js-examples/, react/)
-   `docs/` - Docusaurus documentation site

### Core Package (`packages/core/src/`)

The main class is `CanvasTileEngine.ts` which orchestrates these modules:

**Core Modules (DOM-agnostic):**

-   **Camera.ts** - Pan, zoom, and position management
-   **Config.ts** - Configuration validation and defaults
-   **ViewportState.ts** - Viewport dimensions and DPR tracking
-   **CoordinateTransformer.ts** - World-to-screen coordinate conversion
-   **GestureProcessor.ts** - Normalized pointer/touch input handling
-   **AnimationController.ts** - Smooth camera animations (pan, zoom, resize)
-   **SpatialIndex.ts** - R-Tree (rbush) for viewport culling on large datasets

**Key Interfaces:**

-   **IRenderer** - Renderer contract (init, render, destroy, getDrawAPI, etc.)
-   **IDrawAPI** - Drawing primitives interface
-   **IImageLoader** - Image loading interface

### Renderer Canvas Package (`packages/renderer-canvas/src/`)

Canvas2D implementation of IRenderer:

-   **RendererCanvas.ts** - Main IRenderer implementation
-   **CanvasDraw.ts** - Drawing primitives (rect, image, gridlines, text, circle, line, path)
-   **Layer.ts** - Layer-based rendering with draw order
-   **EventBinder.ts** - DOM event attachment
-   **ResizeWatcher.ts** - ResizeObserver handling
-   **ResponsiveWatcher.ts** - Responsive mode handling
-   **ImageLoader.ts** - Image loading and caching
-   **SizeController.ts** - Animated canvas resize logic
-   **CoordinateOverlayRenderer.ts** - Coordinate grid overlay
-   **CanvasDebug.ts** - Debug HUD rendering

### React Package (`packages/react/src/`)

-   **components/CanvasTileEngine.tsx** - Main component with compound pattern
-   **components/draw/** - Declarative draw components (Rect, GridLines, Image, DrawFunction, etc.)
-   **hooks/** - `useCanvasTileEngine` for engine instance management
-   **context/** - React context for engine access

### Key Patterns

1. **Dependency Injection**: Renderer is injected via constructor

    ```ts
    import { CanvasTileEngine } from "@canvas-tile-engine/core";
    import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

    const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), center);
    ```

2. **Coordinate system**: World coordinates are grid-based; the engine transforms to screen pixels

3. **Draw handles**: Draw methods return `DrawHandle` for removing draw callbacks

4. **Static caching**: `drawStatic*` methods cache to offscreen canvas for performance

5. **Event callbacks**: Set via `engine.onClick`, `engine.onHover`, etc.

6. **React usage**:

    ```tsx
    import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
    import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

    const engine = useCanvasTileEngine();
    <CanvasTileEngine engine={engine} config={config} renderer={new RendererCanvas()} />;
    ```

## Commit Convention

Follow Conventional Commits: `<type>(<scope>): <description>`

Types: feat, fix, docs, style, refactor, test, chore
Scopes: core, react, r-canvas, docs, examples
