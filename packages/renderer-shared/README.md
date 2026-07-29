# @canvas-tile-engine/renderer-shared

Internal package. Not published to npm.

Shared implementation modules for the renderer packages. Consumers depend on
this package via `devDependencies` and bundle its TypeScript source directly
into their own `dist` with tsup (`noExternal`), so it needs no build step and
never appears in published `package.json` dependencies.

## Entry points

- `@canvas-tile-engine/renderer-shared/canvas2d` - the Canvas2D drawing
  pipeline shared by `renderer-canvas` (browser) and `renderer-server`
  (`@napi-rs/canvas`): draw modules, coordinate overlay, debug HUD, layer
  management, and canvas utils, generic over the 2D context and image types.
  `renderer-webgl`'s stacked 2D overlay consumes the Layer,
  CoordinateOverlayRenderer, and DebugOverlay modules too.
- `@canvas-tile-engine/renderer-shared/dom` - browser plumbing shared by
  `renderer-canvas` and `renderer-webgl`: event binding, resize/responsive
  watchers, size control, and image loading. Sizing modules take a list of
  canvases so the WebGL renderer can drive its overlay canvas with the same
  code.

Do not import from this package in application code; its API can change
without semver guarantees.
