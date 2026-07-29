# @canvas-tile-engine/react-shared

Internal package. Not published to npm.

Shared implementation modules for the React binding packages
(`@canvas-tile-engine/react` and `@canvas-tile-engine/react-native`).
Consumers depend on this package via `devDependencies` and bundle its
TypeScript source directly into their own `dist` with tsup (`noExternal`), so
it needs no build step and never appears in published `package.json`
dependencies.

## Contents

- `useEngineHandle` / `EngineHandleBase` - the engine handle hook shared by
  both `useCanvasTileEngine` implementations: stable handle identity,
  ready-state tracking, safe no-op forwarding before mount, and the
  remount-counter re-render fix. Generic over the mount, image, and custom
  draw context types; platform packages pin those and layer platform-only
  members (`_containerRef`, `resize`) on top via the `buildExtras` parameter.
- `EngineContext` / `useEngineContext` - the context that connects draw
  components to the engine handle.
- `draw/` - all compound draw components (`Rect`, `Circle`, `Image`,
  `Sprite`, `GridLines`, `Line`, `Text`, `Path`, `StaticRect`,
  `StaticCircle`, `StaticImage`, `DrawFunction`). Image- and context-typed
  components are generic; platform packages re-export them pinned to
  `HTMLImageElement` / `SkImage` and `SkCanvas`.
- `CanvasTileEngineBaseProps` - the platform-agnostic slice of the main
  component's props (engine, config, center, children, event callbacks).

The platform-specific mount components (DOM wrapper div vs React Native
`View` + Skia `Canvas` + gesture handling) stay in their own packages.

Do not import from this package in application code; its API can change
without semver guarantees.
