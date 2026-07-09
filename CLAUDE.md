# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Canvas Tile Engine is a pnpm/Turborepo monorepo for building zoomable 2D grid surfaces: maps, game boards, minimaps, editors, pixel tools, and data-heavy spatial UIs.

The engine is renderer-agnostic. `@canvas-tile-engine/core` owns camera state, coordinate transforms, event callback plumbing, draw APIs, sprites, viewport culling, static caches, and spatial indexing. Platform packages inject renderers for Canvas2D, WebGL, React Native Skia, and headless Node.js image output.

## Commands

```bash
# Install dependencies
pnpm install

# Build published packages
pnpm build

# Build docs
pnpm build:docs

# Run package watch mode plus the default vanilla example
pnpm dev

# Watch library packages only
pnpm dev:lib

# Run a specific example
pnpm dev:example --example=<example-name>

# Lint all packages
pnpm lint

# Type check all packages
pnpm typecheck

# Format all packages
pnpm format

# Check formatting
pnpm format:check

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage
```

### Package-Specific Commands

```bash
# Core
pnpm --filter @canvas-tile-engine/core dev
pnpm --filter @canvas-tile-engine/core build
pnpm --filter @canvas-tile-engine/core test
pnpm --filter @canvas-tile-engine/core typecheck

# React
pnpm --filter @canvas-tile-engine/react dev
pnpm --filter @canvas-tile-engine/react build
pnpm --filter @canvas-tile-engine/react typecheck

# React Native
pnpm --filter @canvas-tile-engine/react-native dev
pnpm --filter @canvas-tile-engine/react-native build
pnpm --filter @canvas-tile-engine/react-native typecheck

# Renderers
pnpm --filter @canvas-tile-engine/renderer-canvas test
pnpm --filter @canvas-tile-engine/renderer-webgl test
pnpm --filter @canvas-tile-engine/renderer-skia test
pnpm --filter @canvas-tile-engine/renderer-server test
```

### Examples

```bash
pnpm --filter vanilla-js-game-map dev
pnpm --filter vanilla-js-spritesheet dev
pnpm --filter react-game-map dev
pnpm --filter react-responsive-game-map dev
pnpm --filter react-pixel-paint dev
pnpm --filter react-spritesheet dev
pnpm --filter renderer-server-game-map start
```

For example development against local package changes, run `pnpm dev:lib` in one terminal and the example command in another.

## Architecture

### Monorepo Structure

- `packages/core/` - `@canvas-tile-engine/core`: renderer-agnostic engine, config, camera, gestures, draw API contracts, sprites, and spatial indexing.
- `packages/react/` - `@canvas-tile-engine/react`: React bindings with `useCanvasTileEngine` and compound draw components.
- `packages/react-native/` - `@canvas-tile-engine/react-native`: React Native bindings with the same component API, mounted through Skia.
- `packages/renderer-canvas/` - `@canvas-tile-engine/renderer-canvas`: HTML Canvas2D renderer.
- `packages/renderer-webgl/` - `@canvas-tile-engine/renderer-webgl`: WebGL renderer with a Canvas2D overlay.
- `packages/renderer-skia/` - `@canvas-tile-engine/renderer-skia`: React Native Skia renderer.
- `packages/renderer-server/` - `@canvas-tile-engine/renderer-server`: headless Node.js renderer for PNG/JPEG/WebP buffers.
- `examples/` - Vite, React, React Native, spritesheet, and server-rendering examples.
- `docs/` - Docusaurus documentation site.

### Core Package

Main entry: `packages/core/src/CanvasTileEngine.ts`.

Important modules:

- `Camera.ts` - pan, zoom, bounds, and center management.
- `Config.ts` - config normalization and defaults.
- `ViewportState.ts` - viewport dimensions and DPR tracking.
- `CoordinateTransformer.ts` - world/screen coordinate conversion.
- `GestureProcessor.ts` - normalized pointer/touch/wheel input handling.
- `AnimationController.ts` - smooth move, zoom, and resize animation support.
- `SpatialIndex.ts` - RBush-backed viewport culling for large item sets.
- `SpriteSheet.ts` and `SpriteAnimator.ts` - spritesheet frame calculation and animation scheduling.

Key public contracts:

- `IRenderer<TMount, TImage>` - renderer lifecycle and callback contract.
- `IDrawAPI<TImage>` - drawing primitive interface implemented by renderers.
- `IImageLoader<TImage>` - renderer-specific image loading.

### Renderer Packages

`renderer-canvas`:

- Uses one HTML canvas and a Canvas2D context.
- Supports DOM mouse/touch/wheel events, resize watchers, high-DPI sizing, coordinate overlay, debug HUD, and offscreen static caches.
- `addDrawFunction` registers layer-ordered custom drawing and receives `CanvasRenderingContext2D`.

`renderer-webgl`:

- Creates a WebGL canvas plus a transparent Canvas2D overlay.
- WebGL draws rects, circles, images, lines, paths, and grid lines.
- Overlay draws text, coordinate overlay, debug HUD, `addDrawFunction`, and `onDraw`.
- Static draw helpers delegate to dynamic drawing because WebGL already batches layer geometry.
- `invalidateTexture(source)` exists for advanced same-size image/canvas content mutation cases.

`renderer-skia`:

- Implements `IRenderer<SkiaMount, SkImage>`.
- Most app code should use `@canvas-tile-engine/react-native`, which wires layout, gestures, and Skia presentation.
- Static draw helpers record non-changing item sets into Skia pictures.

`renderer-server`:

- Uses `@napi-rs/canvas` with no DOM and no interaction/event loop.
- `renderToBuffer()` is the preferred one-shot API.
- Supports PNG/JPEG/WebP output, font registration, image loading from paths, static caches, and custom drawing via `SKRSContext2D`.

### React Packages

`@canvas-tile-engine/react`:

- Main component uses the compound pattern: `CanvasTileEngine.Rect`, `Circle`, `Image`, `Sprite`, `GridLines`, `Line`, `Text`, `Path`, `StaticRect`, `StaticCircle`, `StaticImage`, `DrawFunction`.
- `useCanvasTileEngine()` returns a stable handle; methods no-op before mount and `isReady` indicates the real engine is attached.
- `config`, `center`, and `renderer` are read on mount. Use runtime APIs for changes or remount with a new `key`.
- Keep large `items` arrays stable with `useMemo` or state to avoid re-registering draw callbacks and rebuilding indexes.

`@canvas-tile-engine/react-native`:

- Mirrors the React API and component names.
- Uses `RendererSkia`; styling is `ViewStyle`; image handles are `SkImage`.
- `config.size` is a placeholder because the native component measures its `View` with `onLayout`.
- Native touch input feeds the same callback names; do not document separate gesture event names unless the public API adds them.

## Key Patterns

### Renderer Injection

```ts
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = new CanvasTileEngine(wrapper, config, new RendererCanvas(), center);
```

### React Usage

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const engine = useCanvasTileEngine();

<CanvasTileEngine engine={engine} config={config} renderer={new RendererCanvas()}>
    <CanvasTileEngine.GridLines cellSize={1} layer={0} />
    <CanvasTileEngine.Rect items={tiles} layer={1} />
</CanvasTileEngine>;
```

### Server Rendering

```ts
import { renderToBuffer } from "@canvas-tile-engine/renderer-server";

const png = await renderToBuffer({
    config,
    pixelRatio: 2,
    draw: (engine) => {
        engine.drawGridLines(1, 1, "#334155", 0);
        engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }, 1);
    },
});
```

## Releases (Changesets)

Publishing is managed with Changesets (`.changeset/config.json`; private packages — docs and all examples — are excluded from versioning).

- Any PR that changes a published package's behavior or public artifact must include a changeset: run `pnpm changeset`, pick the affected packages and bump type, describe the change (this text becomes the CHANGELOG entry).
- On push to `master`, `.github/workflows/release.yml` (changesets/action) collects pending changesets into a "Version Packages" PR. Merging that PR bumps versions, updates CHANGELOGs, publishes to npm with `pnpm release`, and pushes git tags.
- Internal deps between published packages use `workspace:^` (published as `^x.y.z`). Do not use `workspace:*` — it publishes as an exact pin.
- Manual release (fallback): `pnpm changeset:version` then `pnpm release` (requires npm auth).

## Repository Conventions

- Use package scripts and root `turbo run` delegation. Do not add root scripts that manually chain package logic.
- Prefer existing renderer and draw API patterns over new abstractions.
- Use `apply_patch` for manual file edits.
- Do not revert unrelated user changes.
- Keep README/package docs consistent with `README.md` and package-level README files.
- Use ASCII in docs unless the surrounding file already requires otherwise.

## Commit Convention

Follow Conventional Commits: `<type>(<scope>): <description>`.

Common types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.

Common scopes: `core`, `react`, `react-native`, `r-canvas`, `r-webgl`, `r-skia`, `r-server`, `docs`, `examples`.
