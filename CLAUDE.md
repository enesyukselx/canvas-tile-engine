# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Canvas Tile Engine is a monorepo containing a lightweight library for building interactive 2D grid-based maps and visualizations using HTML Canvas. It provides camera controls, coordinate transformations, rendering, and user interactions.

## Commands

```bash
# Install dependencies
pnpm install

# Build all packages (core must build before react)
pnpm build

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
```

## Architecture

### Monorepo Structure

- `packages/core/` - `@canvas-tile-engine/core`: Framework-agnostic engine
- `packages/react/` - `@canvas-tile-engine/react`: React bindings (depends on core)
- `examples/` - Example projects (vanilla-js-examples/, react/)
- `docs/` - Docusaurus documentation site

### Core Package (`packages/core/src/`)

The main class is `CanvasTileEngine.ts` which orchestrates these modules:

- **Camera.ts** - Pan, zoom, and position management
- **CanvasDraw.ts** - Drawing primitives (rect, image, gridlines, text, circle, line, path)
- **SpatialIndex.ts** - R-Tree (rbush) for viewport culling on large datasets
- **Layer.ts** - Layer-based rendering with draw order
- **EventManager/** - Mouse/touch event handling (click, hover, drag, zoom)
- **AnimationController.ts** - Smooth camera animations
- **Config.ts** - Configuration validation and defaults
- **CoordinateTransformer.ts** - World-to-screen coordinate conversion
- **SizeController.ts** - Canvas resize handling

### React Package (`packages/react/src/`)

- **components/CanvasTileEngine.tsx** - Main component with compound pattern
- **components/draw/** - Declarative draw components (Rect, GridLines, Image, etc.)
- **hooks/** - `useCanvasTileEngine` for engine instance management
- **context/** - React context for engine access

### Key Patterns

1. **Coordinate system**: World coordinates are grid-based; the engine transforms to screen pixels
2. **Layer handles**: Draw methods return `LayerHandle` for removing draw callbacks
3. **Static caching**: `drawStatic*` methods cache to offscreen canvas for performance
4. **Event callbacks**: Set via `engine.onClick`, `engine.onHover`, etc.

## Commit Convention

Follow Conventional Commits: `<type>(<scope>): <description>`

Types: feat, fix, docs, style, refactor, test, chore
Scopes: core, react, docs, examples
