# Tiled Maps Reference (@canvas-tile-engine/tiled)

Loads Tiled JSON exports (`.tmj`) into the engine. Framework-agnostic; works
with every renderer including the headless server one. Two halves: `parse`
(pure, no engine/DOM - runs on a server or in a build step) and `mount`.

## Core flow

```ts
import { parseTiledMap, mountTiledMap } from "@canvas-tile-engine/tiled";

const map = await parseTiledMap(json, {
    resolveTileset: async (source) => (await fetch(`/maps/${source}`)).json(), // only for external .tsj
});
if (map.warnings.length > 0) {
    console.warn(map.warnings); // ALWAYS surface these in development
}
const mounted = await mountTiledMap(engine, map, {
    resolveImage: (source) => `/maps/${source}`, // image path as written -> URL
});
engine.render();
// cleanup (level change / React effect): mounted.destroy(); engine.render();
```

- Tiled layers land on engine layers `layerOffset + index` in map order
  (default offset 0).
- Mount uses `tiled:`-namespaced registration ids: re-mounting REPLACES, it
  never accumulates.
- Tile layers and image layers draw through static caches (pass
  `dynamic: true` to opt out); animated cells split out automatically, one
  `SpriteAnimator` per distinct animated tile (not per cell).
- `resolveImage(source, image)` is called once per distinct source in
  `map.images` - that list covers tileset atlases, per-tile images of
  image-collection tilesets, and image layers.

## Camera wiring

`tiledMapBounds(map)` returns RAW corner-space extents
(`[0, columns] x [0, rows]` - the space bounds APIs and `coords.raw` use; do
NOT use item-space -0.5 values, they shift the clamp by half a cell). Feed it
to `config.bounds`/`setBounds` (no panning off the map) and `fitBounds`
(zoom-to-fit). For zoom limits use core's `fitScale(tiledMapBounds(map),
size, opts)` as the zoomed-out floor rather than hand-computing it.
`map.backgroundColor` (present when the map sets `backgroundcolor`) goes
straight into `config.backgroundColor`.

## What comes through

Orthogonal maps with a square grid. Embedded + external tilesets. Atlas
tilesets (margin/spacing, stepped per axis) AND image-collection tilesets
(per-tile images - each item carries its own `img`). Tiles LARGER than the
grid and non-square tileset tiles (anchored bottom-left of their cell, sprite
keeps its aspect inside a square box). Tileset `tileoffset` and
`objectalignment` (all nine anchors; orthogonal default bottom-left). CSV +
base64 (+zlib/gzip via fflate). Tile / object / group / image layers (groups
flatten, `visible: false` dropped). Layer pixel offsets
(`offsetx`/`offsety`, accumulating down group trees). Layer opacity (tile
layers, image layers, tile objects). All 8 GID flip orientations. Tile
animations. Custom properties (map, layer, tileset tile, object). Objects:
rect, polygon, polyline, ellipse, point, tile, text. Object rotation.

## Warns (map still loads; entry in `map.warnings`)

`tintcolor` (no tint stage), `parallaxx`/`parallaxy` (needs per-frame
repositioning), `renderorder` != right-down (only differs where oversized
tiles overlap), object-layer opacity for non-tile shapes (`PathStyle` and
`Circle.style` carry no alpha - use an `rgba()` color), ellipse rotation,
non-uniformly scaled tile objects (renderers fit, never stretch), text
bold/italic/underline/strikeout/wrap and justified alignment (font string is
size + family; one unbroken line per item), repeated image layers,
uneven animation frame durations (fps from the FIRST frame), animations whose
frames live in different per-tile images, `transparentcolor`, unknown layer
types.

## Rejects (parseTiledMap throws, message names the fix)

Non-orthogonal (iso/hex/staggered), infinite maps (Map > Resize Map),
non-square MAP grid, zstd compression, external tileset with no
`resolveTileset`, atlas tileset with no usable `columns`, a placed tile with
no image at all, GID belonging to no tileset, layer data length != width*height.

## Handled internally (do not re-implement)

Pixel→world conversion (integers are cell centers: `px / tileSize - 0.5`;
`tiledPxToWorld` is exported for pixel values kept in custom properties),
tile bottom-left anchoring, object rotation around the Tiled anchor, GID flip
bits → `flipX`/`flipY`/`rotate`, group flattening with opacity multiplication
and offset accumulation, per-tile image resolution (`tilesetTile(tileset,
localId)` if you need it directly).

## Objects → items (all carry `TiledObjectData` in `data`)

rect/polygon → closed Path; polyline → open Path; ellipse → Path commands
(native arc when circular, 4 beziers otherwise); point → `sizePx` Circle
marker (default 8px); tile object (gid) → image item; text → Text item.

```ts
engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<TiledObjectData>(coords.raw);
    if (hit?.item.data) use(hit.item.data.name, hit.item.data.type, hit.item.data.properties);
};
```

`data.type` reads Tiled >=1.9 `class` and older `type`. NOTE: text items never
hit-test - that is an engine-wide rule for `drawText`, not a package gap.

Per-object styling: `pathStyle` option - a `PathStyle` or
`(data: TiledObjectData) => PathStyle | undefined` (undefined → package
default, a soft blue). `markerStyle`/`markerSizePx` for points. Labels take no
style option: a Tiled text object already carries color, family and size.

Text mapping detail: Tiled sizes text in map PIXELS, so `pixelsize` becomes a
world-unit `size` (labels scale with the map, unlike `fontPx`).
`halign`/`valign` collapse the text box into one anchor plus
`textAlign`/`textBaseline`.

## Pure mappers (no engine required)

`tileLayerToItems(layer, images)` → `{ staticItems, animated }`,
`objectLayerToItems(layer, images, options?)` → `{ paths, markers, tiles,
texts }`, `imageLayerToItem(layer, images, map.tileSize)` → `ImageItem | null`
(null when no pixel size can be resolved). `images` is keyed by IMAGE SOURCE
STRING (`Map<string, TImage>`), not by tileset - build it from `map.images`.
Also exported: `decodeGid`, `tilesetSpriteRect`, `tilesetTile`,
`tiledPxToWorld`, `tiledMapBounds`.

Layer discrimination: `layer.kind` is `"tiles" | "objects" | "image"`.

## React

No component wrapper - mount in an effect keyed on `[engine.instance, map]`,
gate on `engine.isReady`, return `mounted.destroy()` as cleanup (handle the
async resolution racing unmount). Parse OUTSIDE the component or in a
`useMemo` so re-renders never re-parse.
