# Loading Tiled Maps

`@canvas-tile-engine/tiled` loads maps authored in [Tiled](https://www.mapeditor.org/) (the JSON export, `.tmj`) into the engine: tile layers become static-cached image draws, object layers become hit-testable Paths, GID flips map to `flipX`/`flipY`/`rotate`, and animated tiles play through `SpriteAnimator`.

```bash
npm install @canvas-tile-engine/tiled
```

## Quick Start

```typescript
import { parseTiledMap, mountTiledMap } from "@canvas-tile-engine/tiled";

const json = await (await fetch("/maps/world.tmj")).json();
const map = await parseTiledMap(json, {
    // Only needed when the map references external .tsj tilesets:
    resolveTileset: async (source) => (await fetch(`/maps/${source}`)).json(),
});

const mounted = await mountTiledMap(engine, map, {
    // Tileset image paths as written in the map, resolved to real URLs:
    resolveImage: (source) => `/maps/${source}`,
});
engine.render();

// Later (e.g. level change):
mounted.destroy();
engine.render();
```

Tiled layers occupy engine layers `0, 1, 2, ...` in map order (shift with `layerOffset`). Re-mounting the same map replaces the previous registrations — mounts use namespaced registration ids internally.

## Camera Setup

`tiledMapBounds(map)` returns the map's extents in **raw corner space** — the space the bounds APIs use, where cell `k` spans `[k, k + 1]`, so the map is `[0, columns] x [0, rows]`. (Item space with its cell-centered integers is for item coordinates only.) Wire it into the camera so users cannot pan off the map, and derive zoom limits from your cell size:

```typescript
import { tiledMapBounds } from "@canvas-tile-engine/tiled";

const CELL = 32;
const { center, ...size } = gridToSize({ columns: map.columns, rows: map.rows, cellSize: CELL });

const config = {
    ...size,
    bounds: tiledMapBounds(map), // camera stays on the map
    minScale: CELL,              // when the viewport shows the whole map at CELL px/cell,
    maxScale: CELL * 4,          // CELL is the fit scale; allow up to 4x zoom-in
    // ...
};
```

If your viewport is smaller than the full map, pick `minScale` as the fit scale instead: `Math.min(viewportWidth / map.columns, viewportHeight / map.rows)`. The same bounds also work with `engine.fitBounds(tiledMapBounds(map))` for a zoom-to-fit action, and `engine.setBounds(...)` if you mount a different map at runtime.

## What Maps Are Supported

| Feature | Supported | Notes |
| :--------------------------------------- | :-------- | :------------------------------------------------------------------- |
| Orthogonal maps, square tiles            | ✅        | tile size must equal the map grid size                               |
| Embedded and external (`.tsj`) tilesets  | ✅        | external ones load through `resolveTileset`                          |
| CSV / base64 / base64+zlib / base64+gzip | ✅        | zstd is rejected — re-export with another setting                    |
| Tile, object, and group layers           | ✅        | groups flatten; `visible: false` layers are skipped                  |
| GID flip flags (H/V/D)                   | ✅        | all 8 orientations map to `flipX`/`flipY`/`rotate`                   |
| Tile animations                          | ✅        | one `SpriteAnimator` per distinct animated tile                      |
| Custom properties                        | ✅        | on maps, layers, tileset tiles, and objects                          |
| Layer opacity (tile layers)              | ✅        | applied per item; group opacities multiply                           |
| Isometric / hexagonal, infinite maps     | ❌ reject | convert or re-author in Tiled                                        |
| Image layers, text objects               | ⚠️ skip   | recorded in `map.warnings`                                           |
| Layer pixel offsets                      | ❌ reject | remove the offset in Tiled                                           |
| `tintcolor`, object-layer opacity        | ⚠️ ignore | recorded in `map.warnings`                                           |

Rejections throw from `parseTiledMap` with messages that say what to change in Tiled. Always check `map.warnings` in development — it lists everything that was skipped.

## Coordinates

Tiled measures in pixels from the map's top-left corner; the engine's item space measures in world units where integers are cell centers. The package converts everything for you — tile at column `c`, row `r` lands at `{ x: c, y: r }`, and object geometry converts with the half-cell shift (`px / tileSize - 0.5`). Two Tiled quirks are handled internally: tile objects anchor at their **bottom-left** corner, and object rotation spins around the object's anchor (not its center).

## Object Layers and Hit Testing

Every rect/polygon/polyline/ellipse object becomes a `PathItem` whose `data` carries the Tiled object's identity — so `hitTest` works immediately:

```typescript
import type { TiledObjectData } from "@canvas-tile-engine/tiled";

engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<TiledObjectData>(coords.raw);
    if (hit?.item.data) {
        console.log(hit.item.data.name, hit.item.data.type, hit.item.data.properties);
    }
};
```

Point objects become fixed-pixel `Circle` markers (`markerSizePx`, default 8) and tile objects become image items — both also carrying `TiledObjectData`.

Style objects per Tiled `class` via `pathStyle`:

```typescript
await mountTiledMap(engine, map, {
    pathStyle: (data) =>
        data.type === "water"
            ? { fillStyle: "rgba(56, 189, 248, 0.3)" }
            : undefined, // undefined -> package default style
});
```

## Tile Animations

Cells whose tileset tile defines an animation are split out of the static cache and drawn dynamically; one `SpriteAnimator` per distinct animated tile mutates every cell's `sprite` and repaints at the animation's fps. Playback speed derives from the first frame's duration — uneven per-frame durations land in `map.warnings`. Under the server renderer (no `requestAnimationFrame`), animated tiles render their first frame.

## React Usage

The package is framework-agnostic; in React, mount inside an effect:

```tsx
const engine = useCanvasTileEngine();

useEffect(() => {
    if (!engine.isReady) return;
    let mounted;
    let cancelled = false;
    mountTiledMap(engine.instance, map).then((m) => {
        if (cancelled) return m.destroy();
        mounted = m;
        engine.instance.render();
    });
    return () => {
        cancelled = true;
        mounted?.destroy();
    };
}, [engine.instance, map]);
```

## Advanced: Pure Mappers

`mountTiledMap` is convenience; the underlying transforms are exported for custom pipelines (e.g. server rendering, custom layer routing):

```typescript
import { tileLayerToItems, objectLayerToItems } from "@canvas-tile-engine/tiled";

const images = new Map([[map.tilesets[0], myLoadedImage]]);
const { staticItems, animated } = tileLayerToItems(map.layers[0], images);
engine.drawStaticImage(staticItems, "terrain", 0);
```
