# @canvas-tile-engine/tiled

Load [Tiled](https://www.mapeditor.org/) map exports (`.tmj`) into
[Canvas Tile Engine](https://canvastileengine.dev): tile layers become
static-cached image draws, object layers become hit-testable Paths carrying
the Tiled object's `id`/`name`/`type`/`properties`, GID flip flags map to
`flipX`/`flipY`/`rotate`, and animated tiles play through `SpriteAnimator`.

```ts
import { parseTiledMap, mountTiledMap } from "@canvas-tile-engine/tiled";

const map = await parseTiledMap(await (await fetch("/maps/world.tmj")).json());
const mounted = await mountTiledMap(engine, map);
engine.render();
```

Supported subset (v1): orthogonal maps, square tiles, embedded + external
tilesets, CSV/base64(+zlib/gzip) layer data, tile/object/group layers, flip
flags, custom properties, tile animations. See the docs for the full support
table and design notes.

- Documentation: https://canvastileengine.dev
- License: MIT
