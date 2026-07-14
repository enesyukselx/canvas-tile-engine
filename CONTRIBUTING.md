# Contributing to Canvas Tile Engine

Thank you for your interest in contributing to Canvas Tile Engine! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Project Structure](#-project-structure)
- [Prerequisites](#-prerequisites)
- [Development Setup](#-development-setup)
- [Development Workflow](#-development-workflow)
- [Coding Standards](#-coding-standards)
- [Commit Guidelines](#-commit-guidelines)
- [Changesets & Releases](#-changesets--releases)
- [Pull Request Process](#-pull-request-process)
- [Testing](#-testing)
- [Documentation](#-documentation)

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to build something great together.

## 📁 Project Structure

This is a monorepo managed with pnpm workspaces and [Turborepo](https://turbo.build/):

```
canvas-tile-engine/
├── packages/
│   ├── core/                 # @canvas-tile-engine/core - renderer-agnostic engine:
│   │   ├── src/              #   camera, config, gestures, coordinate transforms,
│   │   │   ├── CanvasTileEngine.ts    # sprites, spatial indexing, draw API contracts
│   │   │   ├── modules/               # Camera, Config, GestureProcessor, SpatialIndex, ...
│   │   │   ├── types/                 # Public types (config, draw objects, callbacks)
│   │   │   └── utils/
│   │   └── tests/
│   ├── renderer-canvas/      # @canvas-tile-engine/renderer-canvas - HTML Canvas2D renderer
│   ├── renderer-webgl/       # @canvas-tile-engine/renderer-webgl - WebGL renderer + 2D overlay
│   ├── renderer-skia/        # @canvas-tile-engine/renderer-skia - React Native Skia renderer
│   ├── renderer-server/      # @canvas-tile-engine/renderer-server - headless Node.js renderer
│   ├── react/                # @canvas-tile-engine/react - React bindings (hook + components)
│   └── react-native/         # @canvas-tile-engine/react-native - React Native bindings
│
├── examples/
│   ├── vanilla-js-examples/  # game-map, map-editor, spritesheet
│   ├── react/                # game-map, responsive-game-map, pixel-paint, spritesheet
│   ├── react-native/         # responsive-game-map (Expo)
│   └── renderer-server/      # game-map (Node.js image output)
│
├── docs/                     # Docusaurus documentation site (versioned)
├── skills/                   # AI agent skill (published packages) + Claude Code plugin manifest
├── skills-next/              # Upcoming copy of the skill - edit this one in feature PRs
├── .claude-plugin/           # Plugin marketplace catalog
└── .changeset/               # Changesets release management
```

Renderer packages implement the `IRenderer`/`IDrawAPI`/`IImageLoader` contracts from core. Each renderer package is self-contained by design: shared-looking DOM modules (EventBinder, ImageLoader, watchers, Layer) are intentionally copied per renderer rather than extracted into a shared package - do not add cross-package imports of internal modules.

## 🔧 Prerequisites

- **Node.js >= 20.19** (see `.nvmrc`, which pins 22)
- **pnpm 10.x** (see `packageManager` in `package.json`; `corepack enable` handles this automatically)

## 🚀 Development Setup

1. **Fork and clone the repository**

    ```bash
    git clone https://github.com/YOUR_USERNAME/canvas-tile-engine.git
    cd canvas-tile-engine
    ```

2. **Install dependencies**

    ```bash
    pnpm install
    ```

3. **Build packages**

    ```bash
    pnpm build
    ```

4. **Verify setup**

    ```bash
    pnpm lint
    pnpm typecheck
    pnpm test
    ```

Root scripts delegate to `turbo run`, so tasks are cached and only affected packages rebuild.

## 💻 Development Workflow

### Working on a single package

Every package has the same script set - swap the filter name as needed:

```bash
# Watch mode
pnpm --filter @canvas-tile-engine/core dev

# Tests (vitest, watch mode by default)
pnpm --filter @canvas-tile-engine/core test

# Coverage
pnpm --filter @canvas-tile-engine/core test:coverage

# Type check
pnpm --filter @canvas-tile-engine/core typecheck
```

Package names: `core`, `react`, `react-native`, `renderer-canvas`, `renderer-webgl`, `renderer-skia`, `renderer-server` (all under the `@canvas-tile-engine/` scope).

> **Note:** Packages resolve their workspace dependencies from built `dist/` output. If you change core and work on a dependent package, keep `pnpm dev:lib` running (or rebuild core) so the dependent picks up your changes.

### Running examples

```bash
# Run a specific example by name
pnpm dev:example --example=vanilla-js-game-map

# Or filter directly
pnpm --filter vanilla-js-game-map dev
pnpm --filter vanilla-js-spritesheet dev
pnpm --filter react-game-map dev
pnpm --filter react-responsive-game-map dev
pnpm --filter react-pixel-paint dev
pnpm --filter react-spritesheet dev
pnpm --filter renderer-server-game-map start
```

For example development against local package changes, run `pnpm dev:lib` (library watch mode) in one terminal and the example in another.

### Full development mode

```bash
pnpm dev
```

This runs all library packages in watch mode along with the default vanilla JS example.

## 📝 Coding Standards

### TypeScript

- `strict: true` everywhere; no `any` in source
- Export public types from `src/types/` (core) or the package's `src/index.ts`
- Use JSDoc comments with `@param`/`@example` for public APIs

```typescript
/**
 * Draw one or many rectangles in world space.
 * @param items Rectangle definitions.
 * @param layer Layer order (lower draws first).
 * @returns Handle to remove this draw callback.
 */
drawRect(items: Rect | Array<Rect>, layer: number = 1): DrawHandle
```

### Linting and formatting

- **Linting**: [oxlint](https://oxc.rs/docs/guide/usage/linter) with a single root config (`.oxlintrc.json`). Run `pnpm lint`.
- **Formatting**: oxfmt (`.oxfmtrc.json`). Run `pnpm format` to write, `pnpm format:check` to verify.
- oxlint is not type-aware; type-level issues are caught by `pnpm typecheck` (tsc `--noEmit`).

### File organization

**Core package (platform-agnostic):**

- One module per file under `src/modules/`
- Public API exported from `src/index.ts`
- No DOM, Canvas, or platform dependencies - core must run everywhere

**Renderer packages:**

- Implement the `IRenderer` / `IDrawAPI` / `IImageLoader` interfaces from core
- Keep rendering logic in dedicated modules under `src/modules/`
- Prefer the existing renderer and draw API patterns over new abstractions

**React / React Native packages:**

- One component per file; draw components in `src/components/draw/`
- Both packages mirror the same compound-component API - keep them in sync when changing one

## 📌 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type       | Description                           |
| ---------- | ------------------------------------- |
| `feat`     | New feature                           |
| `fix`      | Bug fix                               |
| `docs`     | Documentation changes                 |
| `style`    | Code style changes (formatting, etc.) |
| `refactor` | Code refactoring                      |
| `test`     | Adding or updating tests              |
| `chore`    | Maintenance tasks                     |

### Scopes

| Scope          | Description                                     |
| -------------- | ----------------------------------------------- |
| `core`         | Changes to @canvas-tile-engine/core             |
| `react`        | Changes to @canvas-tile-engine/react            |
| `react-native` | Changes to @canvas-tile-engine/react-native     |
| `r-canvas`     | Changes to @canvas-tile-engine/renderer-canvas  |
| `r-webgl`      | Changes to @canvas-tile-engine/renderer-webgl   |
| `r-skia`       | Changes to @canvas-tile-engine/renderer-skia    |
| `r-server`     | Changes to @canvas-tile-engine/renderer-server  |
| `docs`         | Documentation changes                           |
| `examples`     | Example projects                                |

## 🦋 Changesets & Releases

Publishing is managed with [Changesets](https://github.com/changesets/changesets).

**Any PR that changes a published package's behavior or public artifact must include a changeset:**

```bash
pnpm changeset
```

Pick the affected packages and bump type (patch/minor/major), then describe the change - this text becomes the CHANGELOG entry. Commit the generated file under `.changeset/` with your PR.

PRs that only touch docs, examples, CI, or internal tooling do not need a changeset.

**Adding a changeset does not publish anything.** It is only a pending note. On push to `master`, the release workflow collects pending changesets into a single "Version Packages" PR, where they accumulate across merged PRs. Nothing reaches npm until a maintainer merges that PR - only then are versions bumped, CHANGELOGs updated, packages published, and git tags pushed. Release timing is entirely up to the maintainer.

> **Note:** Internal dependencies between published packages use `workspace:^` (published as `^x.y.z`). Do not use `workspace:*` - it publishes as an exact pin.

## 🔄 Pull Request Process

1. **Fork & clone** the repository, create a feature branch

2. **Make changes**, run `pnpm lint && pnpm typecheck && pnpm test`

3. **Add a changeset** if the PR changes a published package (`pnpm changeset`)

4. **Update docs and the AI skill** if the change affects usage or the public API: `docs/docs/` (the upcoming docs version) and `skills-next/canvas-tile-engine/` (SKILL.md + references). Do not edit `docs/versioned_docs/` or `skills/canvas-tile-engine/` for unreleased changes - both describe the published packages and are synced from their upcoming copies at release time.

5. **Push to your fork** and open a Pull Request

### PR Checklist

- [ ] Code follows the project's coding standards
- [ ] All tests pass
- [ ] New code is covered by tests
- [ ] Changeset added (if a published package changed)
- [ ] `docs/docs/` updated (if usage or the public API changed)
- [ ] AI skill (`skills-next/canvas-tile-engine/`) updated (if usage or the public API changed)
- [ ] Commit messages follow conventional commits
- [ ] PR description clearly explains the changes

## 🧪 Testing

### Running tests

```bash
# Run all tests (via turbo, affected packages only in CI)
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run a single package's tests (vitest watch mode)
pnpm --filter @canvas-tile-engine/core test
```

### Writing tests

Tests are written using [Vitest](https://vitest.dev/). Place test files in the package's `tests/` directory, mirroring the `src/` layout.

```typescript
// tests/modules/Camera.test.ts
import { describe, it, expect } from "vitest";
import { Camera } from "../../src/modules/Camera";

describe("Camera", () => {
    it("should initialize with correct position", () => {
        const camera = new Camera({ x: 10, y: 20 }, 1);
        expect(camera.x).toBeCloseTo(10.5);
        expect(camera.y).toBeCloseTo(20.5);
    });
});
```

Renderer packages currently have thin test coverage - tests accompanying renderer changes are especially welcome.

## 📚 Documentation

Documentation is built with [Docusaurus](https://docusaurus.io/) and lives in the `docs/` directory (its own npm project, not part of the pnpm workspace).

### Running docs locally

```bash
cd docs
npm install
npm start
```

Build check from the repo root: `pnpm build:docs`.

### Updating docs

- **Guides**: `docs/docs/introduction/`
- **API docs**: `docs/docs/js/`, `docs/docs/react/`, `docs/docs/react-native/`, `docs/docs/server/`

The docs site is versioned. `docs/docs/` is the upcoming version; `docs/versioned_docs/version-0.x.x/` is the published one. Unreleased changes go to `docs/docs/` only - the maintainer carries them into `versioned_docs` when cutting a release. Only edit `versioned_docs` directly to fix documentation of already-published behavior.

The AI agent skill follows the same model: `skills/canvas-tile-engine/` describes the published packages and is installed straight from `master` (skills CLI, plugin marketplace), so feature PRs must not touch it. Edit `skills-next/canvas-tile-engine/` instead; it is copied over `skills/` at release time.

When changing a public API, also keep these in sync:

- Root `README.md` and the affected package's `README.md`
- The AI agent skill under `skills-next/canvas-tile-engine/` (SKILL.md + references)

## 🙋 Questions?

If you have questions or need help:

1. Check existing [issues](https://github.com/enesyukselx/canvas-tile-engine/issues)
2. Open a new issue with the `question` label
3. Join discussions in the repository

---

Thank you for contributing! 🎉
