# Contributing to Canvas Tile Engine

Thank you for your interest in contributing to Canvas Tile Engine! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Project Structure](#project-structure)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Documentation](#documentation)

## Code of Conduct

Please be respectful and constructive in all interactions. We're all here to build something great together.

## 📁 Project Structure

This is a monorepo managed with pnpm workspaces:

```
canvas-tile-engine/
├── packages/
│   ├── core/                 # @canvas-tile-engine/core (DOM-agnostic)
│   │   ├── src/
│   │   │   ├── CanvasTileEngine.ts    # Main engine class
│   │   │   ├── modules/               # Internal modules
│   │   │   │   ├── Camera.ts
│   │   │   │   ├── CoordinateTransformer.ts
│   │   │   │   ├── GestureProcessor.ts
│   │   │   │   ├── AnimationController.ts
│   │   │   │   ├── SpatialIndex.ts
│   │   │   │   └── ...
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   └── tests/
│   │
│   ├── renderer-canvas/      # @canvas-tile-engine/renderer-canvas
│   │   └── src/
│   │       ├── RendererCanvas.ts      # IRenderer implementation
│   │       ├── CanvasDraw.ts          # Drawing primitives
│   │       ├── Layer.ts               # Layer-based rendering
│   │       ├── EventBinder.ts         # DOM event attachment
│   │       ├── ImageLoader.ts         # Image loading/caching
│   │       └── index.ts
│   │
│   └── react/                # @canvas-tile-engine/react
│       └── src/
│           ├── components/           # React components
│           │   ├── CanvasTileEngine.tsx
│           │   └── draw/             # Draw components
│           ├── hooks/
│           ├── context/
│           └── index.ts
│
├── examples/
│   ├── vanilla-js-examples/  # Vanilla JS examples
│   └── react/                # React examples
│
└── docs/                     # Docusaurus documentation
```

## 🚀 Development Setup

### Installation

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

## 💻 Development Workflow

### Working on Core Package (`@canvas-tile-engine/core`)

```bash
# Start development mode with watch
pnpm --filter @canvas-tile-engine/core dev

# Run tests
pnpm --filter @canvas-tile-engine/core test

# Run tests with coverage
pnpm --filter @canvas-tile-engine/core test:coverage

# Type check
pnpm --filter @canvas-tile-engine/core typecheck
```

### Working on Renderer Canvas Package (`@canvas-tile-engine/renderer-canvas`)

```bash
# Build the package
pnpm --filter @canvas-tile-engine/renderer-canvas build

# Start development mode with watch
pnpm --filter @canvas-tile-engine/renderer-canvas dev
```

### Working on React Package (`@canvas-tile-engine/react`)

```bash
# Start development mode with watch
pnpm --filter @canvas-tile-engine/react dev

# Type check
pnpm --filter @canvas-tile-engine/react typecheck
```

> **Note:** The React package depends on Core and Renderer Canvas packages. Make sure to build them first if you've made changes.

### Running Examples

```bash
# Run a specific example
pnpm dev:example --example=example-project-name

# Or run vanilla JS game-map example directly
pnpm --filter vanilla-js-game-map dev

# Or run React game-map example
pnpm --filter react-game-map dev
```

### Full Development Mode

To develop both packages simultaneously with an example:

```bash
pnpm dev
```

This runs the core package in watch mode along with the vanilla JS example.

## 📝 Coding Standards

### TypeScript

- Use `strict: true` mode
- Export types explicitly from `types.ts`
- Use JSDoc comments for public APIs

```typescript
/**
 * Draw one or many rectangles in world space.
 * @param items Rectangle definitions.
 * @param layer Layer order (lower draws first).
 * @returns Handle to remove this draw callback.
 */
drawRect(items: DrawObject | Array<DrawObject>, layer: number = 1): LayerHandle
```

### Code Style

- Use Prettier for formatting (config in `.prettierrc`)
- Follow ESLint rules (config in `eslint.config.mjs`)
- Use meaningful variable and function names
- Keep functions focused and small

### File Organization

**Core Package (DOM-agnostic):**
- One module per file
- Keep modules in `src/modules/`
- Export public API from `src/index.ts`
- No DOM or Canvas dependencies

**Renderer Canvas Package:**
- Implements `IRenderer` interface from core
- Keep rendering logic in dedicated modules
- Export from `src/index.ts`

**React Package:**
- One component per file
- Keep draw components in `src/components/draw/`
- Export from `src/index.ts`

## 📌 Commit Guidelines

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]
```

### Types

| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation changes |
| `style` | Code style changes (formatting, etc.) |
| `refactor` | Code refactoring |
| `test` | Adding or updating tests |
| `chore` | Maintenance tasks |

### Scopes

| Scope | Description |
|-------|-------------|
| `core` | Changes to @canvas-tile-engine/core |
| `r-canvas` | Changes to @canvas-tile-engine/renderer-canvas |
| `react` | Changes to @canvas-tile-engine/react |
| `docs` | Documentation changes |
| `examples` | Example projects |


## 🔄 Pull Request Process

1. **Fork & clone** the repository, create a feature branch

2. **Make changes**, run `pnpm lint && pnpm typecheck && pnpm test`

3. **Push to your fork** and open a Pull Request

### PR Checklist

- [ ] Code follows the project's coding standards
- [ ] All tests pass
- [ ] New code is covered by tests
- [ ] Documentation is updated (if applicable)
- [ ] Commit messages follow conventional commits
- [ ] PR description clearly explains the changes

## 🧪 Testing

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests in watch mode
pnpm --filter @canvas-tile-engine/core test -- --watch
```

### Writing Tests

Tests are written using [Vitest](https://vitest.dev/). Place test files in the `tests/` directory.

```typescript
// tests/modules/Camera.test.ts
import { describe, it, expect } from 'vitest';
import { Camera } from '../../src/modules/Camera';

describe('Camera', () => {
    it('should initialize with correct position', () => {
        const camera = new Camera({ x: 10, y: 20 }, 1);
        expect(camera.x).toBeCloseTo(10.5);
        expect(camera.y).toBeCloseTo(20.5);
    });
});
```

## 📚 Documentation

Documentation is built with [Docusaurus](https://docusaurus.io/) and lives in the `docs/` directory.

### Running Docs Locally

```bash
cd docs
npm install
npm start
```

### Updating Docs

- **API docs**: `docs/docs/js/` and `docs/docs/react/`
- **Guides**: `docs/docs/introduction/`

When adding new features, please update the relevant documentation.

## 🙋 Questions?

If you have questions or need help:

1. Check existing [issues](https://github.com/enesyukselx/canvas-tile-engine/issues)
2. Open a new issue with the `question` label
3. Join discussions in the repository

---

Thank you for contributing! 🎉
