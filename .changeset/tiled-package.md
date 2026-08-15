---
"@canvas-tile-engine/tiled": minor
---

feat: new package — load Tiled (.tmj) maps into the engine

Two halves, usable independently. `parseTiledMap(json, { resolveTileset? })` normalizes Tiled's pixel-and-GID JSON into an engine-space model with no engine, canvas or DOM involved; `mountTiledMap(engine, map, options?)` registers that model and returns a `destroy()`.

**What comes through**

- Orthogonal maps with a square grid; embedded and external (`.tsj`) tilesets; CSV and base64 layer data, plain or zlib/gzip compressed.
- Atlas tilesets (`margin`/`spacing`, stepped per axis) **and image-collection tilesets**, where every tile carries its own image — the engine handles those natively because each item holds its own `img`.
- **Tiles larger than the map grid** and non-square tileset tiles: anchored bottom-left of their cell the way Tiled draws them, with the sprite keeping its own aspect inside the square box the renderers fit it into. Tileset `tileoffset` is applied, and `objectalignment` decides where a tile object's anchor sits (all nine values; orthogonal defaults to bottom-left).
- Tile, object, group and image layers — groups flatten, `visible: false` is dropped, opacity multiplies and **pixel offsets accumulate** down the tree. Layer opacity reaches tile layers, image layers and tile objects. All four `renderorder` values are honored: the cell sequence is the draw order, which is what decides the winner where oversized tiles overlap.
- All eight GID flip orientations mapped to `flipX`/`flipY`/`rotate`; tile animations driven by one `SpriteAnimator` per distinct animated tile however many cells share it; custom properties from the map, layers, tileset tiles and objects.
- Every object kind as an item carrying the object's `id`/`name`/`type`/`properties` in `data`: rectangle and polygon as closed Paths, polyline open, ellipse as a native arc or four beziers, point as a fixed-pixel Circle marker, tile objects as images, and **text objects as Text items** (Tiled sizes text in map pixels, so labels scale with the map). Rotation is applied around the Tiled anchor throughout.
- `map.backgroundColor` for the engine's `config.backgroundColor`, and `map.images` listing every distinct image the map actually references, in draw order.

**What is honest about its limits**

Anything the engine cannot draw is either recorded in `map.warnings` — with the reason and what happened instead — or rejected by `parseTiledMap` with a message naming what to change in Tiled. Warnings cover `tintcolor`, parallax factors, object-layer opacity on non-tile shapes, ellipse rotation, non-uniformly scaled tile objects, bold/italic/underline/strikeout/wrapped and justified text, repeated image layers, uneven animation durations, animations spanning per-tile images, `transparentcolor`, and unknown layer types or render orders. Rejections cover isometric/hexagonal/staggered maps, infinite maps, a non-square map grid, `zstd`, a missing `resolveTileset`, an atlas tileset with no usable `columns`, and a placed tile with no image at all.

**Other exports**

`tiledMapBounds(map)` gives the map's raw corner-space extents (`[0, columns] x [0, rows]`, the space the bounds APIs use) for `config.bounds`/`setBounds` and `fitBounds`. The pure mappers `tileLayerToItems`, `objectLayerToItems` and `imageLayerToItem` are exported for custom pipelines, taking loaded images keyed by source string. Per-object styling goes through `pathStyle` (a value or a function of the object data) and `markerStyle`/`markerSizePx`; labels need none, since a Tiled text object already carries its color, family and size.
