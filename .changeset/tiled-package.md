---
"@canvas-tile-engine/tiled": minor
---

feat: new package — load Tiled (.tmj) maps into the engine

- `parseTiledMap(json, { resolveTileset? })` normalizes the supported subset (orthogonal maps, square grid-matching tiles, embedded + external tilesets, CSV/base64(+zlib/gzip) layer data, tile/object/group layers, GID flip flags, custom properties, tile animations) into an engine-space model: cells at cell-centered coordinates with atlas sprite rects, flips/rotations mapped to `flipX`/`flipY`/`rotate`, objects converted from Tiled's pixel/top-left space (tile objects from their bottom-left anchor, rotation applied around the Tiled anchor). Unsupported maps (isometric/hex, infinite, zstd, layer offsets, oversized tilesets) reject with actionable messages; skipped content (image layers, text objects, tint) is recorded in `map.warnings`.
- `mountTiledMap(engine, map, options?)` loads tileset atlases through `engine.images`, draws tile layers as static caches (animated cells split out and driven by one `SpriteAnimator` per distinct animated tile), and object layers as hit-testable Paths carrying the object's `id`/`name`/`type`/`properties` in `data`, plus `sizePx` markers for points and image items for tile objects. Registrations use namespaced ids (re-mounting replaces), and the returned `destroy()` tears everything down — the React-effect cleanup story.
- Pure mappers (`tileLayerToItems`, `objectLayerToItems`) are exported for custom pipelines; per-object styling via `pathStyle` (value or function of the object data).
- `tiledMapBounds(map)` returns the map's raw corner-space extents (`[0, columns] x [0, rows]` — the space the bounds APIs use) for wiring the camera: `config.bounds`/`engine.setBounds` (no panning off the map) and `engine.fitBounds` (zoom-to-fit).
