---
sidebar_position: 7
---

# Examples

Example projects live in the repository under [`examples`](https://github.com/enesyukselx/canvas-tile-engine/tree/master/examples).

## Vanilla JavaScript

| Example | Command |
| :-- | :-- |
| Game map | `pnpm --filter vanilla-js-game-map dev` |
| Spritesheet | `pnpm --filter vanilla-js-spritesheet dev` |

## React

| Example | Command |
| :-- | :-- |
| Game map | `pnpm --filter react-game-map dev` |
| Responsive game map | `pnpm --filter react-responsive-game-map dev` |
| Pixel paint | `pnpm --filter react-pixel-paint dev` |
| Spritesheet | `pnpm --filter react-spritesheet dev` |

## React Native

| Example | Command |
| :-- | :-- |
| Responsive game map | See `examples/react-native/responsive-game-map` and run it with your React Native or Expo workflow. |

## Server Rendering

| Example | Command |
| :-- | :-- |
| Game map image generation | `pnpm --filter renderer-server-game-map start` |

## Workspace Setup

```bash
pnpm install
pnpm build
```

When changing package source locally, keep package watch mode running in another terminal:

```bash
pnpm dev:lib
```
