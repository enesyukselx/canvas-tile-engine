# Tiled Maps Reference (@canvas-tile-engine/tiled)

Loads Tiled JSON exports (`.tmj`) into the engine. Framework-agnostic; works
with every renderer including the headless server one.

## Core flow

```ts
import { parseTiledMap, mountTiledMap } from "@canvas-tile-engine/tiled";

const map = await parseTiledMap(json, {
    resolveTileset: async (source) => (await fetch(`/maps/${source}`)).json(), // only for external .tsj
});
const mounted = await mountTiledMap(engine, map, {
    resolveImage: (source) => `/maps/${source}`, // tileset image path -> URL
});
engine.render();
// cleanup (level change / React effect): mounted.destroy(); engine.render();
```

- Tiled layers land on engine layers `layerOffset + index` in map order
  (default offset 0).
- Mount uses `tiled:`-namespaced registration ids: re-mounting REPLACES, it
  never accumulates.
- Tile layers draw through static caches (pass `dynamic: true` to opt out);
  animated cells split out automatically, one `SpriteAnimator` per distinct
  animated tile (not per cell).

## Supported subset — reject vs skip

Rejects (parseTiledMap throws, message says the fix): non-orthogonal maps,
infinite maps, non-square tiles, tileset tile size ≠ map grid, zstd
compression, layer pixel offsets (offsetx/offsety), missing resolveTileset
for external tilesets. Supported data encodings: CSV array, base64, base64 +
zlib/gzip (fflate).

Skips with a `map.warnings` entry (map still loads): image layers, text
objects, tintcolor, object-layer opacity, uneven animation frame durations
(fps derives from the FIRST frame's duration). ALWAYS surface `map.warnings`
during development.

Handled internally (do not re-implement): pixel→world conversion (integers
are cell centers: `px / tileSize - 0.5`), tile-object BOTTOM-left anchoring,
object rotation around the Tiled anchor, GID flip bits → `flipX`/`flipY`/
`rotate` (all 8 orientations), group flattening with opacity multiplication,
`visible: false` layers dropped.

## Objects → hit-testable items

rect/polygon → closed Path; polyline → open Path; ellipse → Path commands
(native arc when circular, bezier otherwise); point → `sizePx` Circle marker
(default 8px); tile object (gid) → image item. Every produced item carries
`TiledObjectData` in `data`:

```ts
engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<TiledObjectData>(coords.raw);
    if (hit?.item.data) use(hit.item.data.name, hit.item.data.type, hit.item.data.properties);
};
```

Per-object styling: `pathStyle` option — a `PathStyle` or
`(data: TiledObjectData) => PathStyle | undefined` (undefined → package
default, a soft blue). `markerStyle`/`markerSizePx` for points.

## Pure mappers (no engine required)

`tileLayerToItems(layer, images)` → `{ staticItems, animated }` and
`objectLayerToItems(layer, images, options?)` → `{ paths, markers, tiles }`
for custom pipelines; `images` is a `Map<TiledTileset, TImage>` keyed by the
tileset objects from `map.tilesets`. Also exported: `decodeGid`,
`tilesetSpriteRect`, `tiledPxToWorld`.

## React

No component wrapper — mount in an effect keyed on `[engine.instance, map]`,
gate on `engine.isReady`, return `mounted.destroy()` as cleanup (handle the
async resolution racing unmount).
