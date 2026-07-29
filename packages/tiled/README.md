# @canvas-tile-engine/tiled

Load [Tiled](https://www.mapeditor.org/) map exports (`.tmj`) into
[Canvas Tile Engine](https://canvastileengine.dev).

```ts
import { parseTiledMap, mountTiledMap } from "@canvas-tile-engine/tiled";

const map = await parseTiledMap(await (await fetch("/maps/world.tmj")).json());
const mounted = await mountTiledMap(engine, map);
engine.render();
```

Two halves, usable independently: `parseTiledMap` turns Tiled's pixel-and-GID
JSON into a normalized engine-space model with no engine, canvas or DOM
involved, and `mountTiledMap` registers that model on an engine and hands back
a `destroy()`.

What comes through: orthogonal maps, embedded and external tilesets, atlas and
image-collection tilesets, tiles larger than the grid, CSV and
base64(+zlib/gzip) layer data, tile/object/group/image layers, layer offsets
and opacity, all eight GID flip orientations, tile animations, custom
properties, and every object kind — rectangle, polygon, polyline, ellipse,
point, tile and text — as hit-testable items carrying the Tiled object's
`id`/`name`/`type`/`properties`.

Anything the engine cannot draw is either recorded in `map.warnings` with what
happened instead, or rejected by `parseTiledMap` with a message naming what to
change in Tiled. Nothing is silently wrong.

- Documentation: https://canvastileengine.dev
- License: MIT
