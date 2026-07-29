# Loading Tiled Maps

`@canvas-tile-engine/tiled` loads maps authored in [Tiled](https://www.mapeditor.org/) — the JSON export, `.tmj` — into the engine. Tile layers become cached image draws, object layers become hit-testable shapes carrying each object's Tiled identity, and animated tiles play themselves.

```bash
npm install @canvas-tile-engine/tiled
```

The package has two halves you can use independently:

- **Parse** — `parseTiledMap(json)` turns Tiled's pixel-and-GID JSON into a normalized, engine-space model. No engine, no canvas, no DOM: it runs anywhere, including on a server or in a build step.
- **Mount** — `mountTiledMap(engine, map)` registers that model on an engine and hands back a `destroy()`.

## Quick Start

```typescript
import { parseTiledMap, mountTiledMap } from "@canvas-tile-engine/tiled";

const json = await (await fetch("/maps/world.tmj")).json();

const map = await parseTiledMap(json, {
    // Only needed when the map references external .tsj tilesets:
    resolveTileset: async (source) => (await fetch(`/maps/${source}`)).json(),
});

// Always look at this while developing - see "Warnings" below.
if (map.warnings.length > 0) {
    console.warn(map.warnings);
}

const mounted = await mountTiledMap(engine, map, {
    // Image paths as written in the map, resolved to real URLs:
    resolveImage: (source) => `/maps/${source}`,
});
engine.render();

// Later (level change, unmount):
mounted.destroy();
engine.render();
```

Tiled layers occupy engine layers `0, 1, 2, ...` in map order; shift them with `layerOffset` to leave room for your own draws underneath or above. Re-mounting the same map replaces the previous registrations rather than stacking a second copy — mounts use namespaced registration ids internally.

## Will My Map Work?

Everything below is decided at parse time, so you find out before a single pixel is drawn. Three outcomes: it comes through, it comes through with a caveat recorded in `map.warnings`, or `parseTiledMap` throws with a message naming what to change in Tiled.

### Comes through

| Feature | Notes |
| :--- | :--- |
| Orthogonal maps | The map grid must be square (`tilewidth === tileheight`) |
| Embedded and external tilesets | External `.tsj` files load through `resolveTileset` |
| Atlas tilesets | `margin` and `spacing` are applied per axis |
| Image-collection tilesets | Tilesets where every tile has its own image, no shared atlas |
| Tiles larger than the map grid | Trees, buildings, banners — anchored bottom-left of their cell, as Tiled draws them |
| Non-square tileset tiles | The sprite keeps its own aspect |
| `tileoffset` | The tileset's pixel shift is applied to every tile drawn from it |
| `objectalignment` | All nine anchors; orthogonal maps default to bottom-left |
| CSV and base64 layer data | Plain, `zlib`, or `gzip` |
| Tile, object, group and image layers | Groups flatten; `visible: false` layers are dropped |
| Layer pixel offsets | `offsetx`/`offsety`, accumulating down group trees |
| Layer opacity | Tile layers, image layers, and tile objects |
| GID flip flags | All eight orientations, including the diagonal ones |
| Tile animations | One animator per distinct animated tile, however many cells use it |
| Custom properties | On the map, layers, tileset tiles, and objects |
| Objects | Rectangle, polygon, polyline, ellipse, point, tile, and text |
| Object rotation | Rectangles, polygons, polylines, tile objects, and labels |
| `backgroundcolor` | Surfaced as `map.backgroundColor` for your engine config |

### Comes through with a caveat

Each of these lands in `map.warnings` with the reason and what happens instead.

| Feature | What happens |
| :--- | :--- |
| `tintcolor` | Ignored — the engine has no tint stage |
| `parallaxx` / `parallaxy` | Ignored — parallax needs per-frame repositioning against the camera |
| `renderorder` other than `right-down` | Tiles draw right-down; only visible where oversized tiles overlap |
| Object-layer opacity | Applies to tile objects; shapes, markers and labels stay opaque (use an `rgba()` style color) |
| Ellipse rotation | The ellipse draws unrotated |
| Non-uniformly scaled tile objects | Drawn at the tile's own aspect — the renderers fit a sprite, never stretch it |
| Bold, italic, underline, strikeout, word wrap | The label draws as one plain line |
| Justified text | Left-aligned |
| Repeated image layers (`repeatx`/`repeaty`) | The image draws once |
| Uneven animation frame durations | Every frame uses the first frame's duration |
| Animations across per-tile images | The tile draws unanimated — an animator swaps rects inside one image |
| `transparentcolor` | Ignored; export the image with real alpha instead |
| Unknown layer types | Skipped |

### Rejected

`parseTiledMap` throws, because guessing would be worse than stopping.

| Case | Fix |
| :--- | :--- |
| Isometric, hexagonal, or staggered maps | Re-author as orthogonal |
| Infinite maps | Tiled → Map → Resize Map |
| Non-square map grid | Make `tilewidth` and `tileheight` equal |
| `zstd` layer compression | Re-export with zlib, gzip, or CSV |
| External tileset with no `resolveTileset` | Pass the hook |
| Atlas tileset with no usable `columns` | Re-save the tileset in Tiled |
| A placed tile with no image at all | Give the tile or its tileset an image |

## Coordinates

Tiled measures in pixels from the map's top-left corner. The engine's item space measures in world units where **integers are cell centers**. The package converts everything, so you rarely think about it:

- A tile at column `c`, row `r` lands at `{ x: c, y: r }`.
- Object geometry converts with the half-cell shift: `px / tileSize - 0.5`. `tiledPxToWorld(px, tileSize)` is exported if you store pixel coordinates in custom properties and need the same conversion.

Two Tiled behaviors the package reproduces so your map looks like it does in the editor: a tile sits on the **bottom-left** of its cell (which is why oversized tiles grow upward), and object rotation spins around the object's own anchor, not its center.

## Camera Setup

`tiledMapBounds(map)` returns the map's extents in **raw corner space** — the space the bounds APIs use, where cell `k` spans `[k, k + 1]`, so a map is `[0, columns] x [0, rows]`. (Item space, with its cell-centered integers, is for item coordinates only.)

```typescript
import { gridToSize } from "@canvas-tile-engine/core";
import { tiledMapBounds } from "@canvas-tile-engine/tiled";

const CELL = 32; // screen pixels per cell at 1x zoom
const { center, ...size } = gridToSize({ columns: map.columns, rows: map.rows, cellSize: CELL });

const config = {
    ...size,
    bounds: tiledMapBounds(map), // the camera cannot leave the map
    backgroundColor: map.backgroundColor ?? "#000000",
    minScale: CELL,
    maxScale: CELL * 4,
};
```

If your viewport is smaller than the whole map, derive the zoom-out limit from the content instead of guessing:

```typescript
import { fitScale } from "@canvas-tile-engine/core";

const fit = fitScale(tiledMapBounds(map), viewportSize, { paddingPx: 16 });
engine.setScaleLimits(fit, fit * 8); // never zoom out past the whole map
engine.fitBounds(tiledMapBounds(map)); // and a "show everything" action
```

## Objects and Hit Testing

Every rectangle, polygon, polyline and ellipse becomes a `PathItem` whose `data` carries the Tiled object's identity, so hit testing works with no extra wiring:

```typescript
import type { TiledObjectData } from "@canvas-tile-engine/tiled";

engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<TiledObjectData>(coords.raw);
    if (hit) {
        const { id, name, type, properties } = hit.item.data!;
        console.log(name, type, properties);
    }
};
```

`type` is the Tiled class (the field Tiled called `type` before 1.9 — both are read). `properties` is the object's custom properties as a plain record.

The other object kinds map like this, all carrying the same `data`:

| Tiled object | Engine item |
| :--- | :--- |
| Rectangle, polygon | Closed `Path` |
| Polyline | Open `Path` |
| Ellipse | `Path` — a native arc when circular, four beziers otherwise |
| Point | `Circle` with a fixed pixel size (`markerSizePx`, default 8) |
| Tile | `Image`, flips and rotation included |
| Text | `Text` — note that text never hit-tests, engine-wide |

Tiled shapes carry no styling of their own, so the package applies a default blue and lets you override per object — usually by class:

```typescript
await mountTiledMap(engine, map, {
    pathStyle: (data) =>
        data.type === "water"
            ? { fillStyle: "rgba(56, 189, 248, 0.3)", strokeStyle: "#0ea5e9" }
            : undefined, // undefined -> the package default
    markerStyle: { fillStyle: "#f59e0b" },
    markerSizePx: 10,
});
```

Labels need no such option: a Tiled text object already carries its color, font and size, and the package uses them.

## Tile Animations

Cells whose tileset tile defines an animation are split out of the static cache and drawn dynamically. One `SpriteAnimator` drives every cell that shares an animated tile — a hundred animated water tiles cost one animator, not a hundred.

Playback speed comes from the first frame's duration, so uneven per-frame durations warn. Under the server renderer, where there is no animation loop, animated tiles render their first frame.

## Static Caching and the `dynamic` Option

Tile layers and image layers register through `drawStaticImage` by default: the layer is rendered once into an offscreen bitmap and blitted per frame, which is what makes large maps cheap. Pass `dynamic: true` to draw them item-by-item instead — the right choice only if you intend to mutate the items the mount produced.

## React Usage

The package is framework-agnostic; in React, mount inside an effect and return the mount's `destroy` as the cleanup:

```tsx
const engine = useCanvasTileEngine();

useEffect(() => {
    if (!engine.isReady) {
        return;
    }
    let mounted: Awaited<ReturnType<typeof mountTiledMap>> | undefined;
    let cancelled = false;

    mountTiledMap(engine.instance!, map).then((m) => {
        if (cancelled) {
            m.destroy();
            return;
        }
        mounted = m;
        engine.instance!.render();
    });

    return () => {
        cancelled = true;
        mounted?.destroy();
    };
}, [engine.instance, map]);
```

Parse once outside the component (or in a `useMemo`) so a re-render never re-parses the JSON.

## Warnings

`map.warnings` is a plain `string[]`, filled during parsing. Every entry names the layer, tileset or object it came from, says what is not supported, and says what happened instead — they are written to be read by whoever authored the map, not just the developer:

```
layer "clouds": parallax factors are not supported (they need per-frame
repositioning); the layer draws at its normal position.
```

An empty array means the map came through exactly as authored. Log it in development; it is the fastest way to find out that a map relies on something the engine cannot draw.

## Advanced: the Pure Mappers

`mountTiledMap` is a convenience over three exported transforms. Reach for them when you need to route layers yourself — separate engines for a map and its minimap, server-side rendering, custom draw ordering:

```typescript
import { tileLayerToItems, objectLayerToItems, imageLayerToItem } from "@canvas-tile-engine/tiled";

// Loaded images are keyed by the source string the map file uses.
const images = new Map(await Promise.all(map.images.map(async (i) => [i.source, await load(i.source)] as const)));

for (const layer of map.layers) {
    if (layer.kind === "tiles") {
        const { staticItems, animated } = tileLayerToItems(layer, images);
        engine.drawStaticImage(staticItems, layer.name, 0);
        // `animated` groups cells by shared animation - drive them yourself
    } else if (layer.kind === "image") {
        const item = imageLayerToItem(layer, images, map.tileSize);
    } else {
        const { paths, markers, tiles, texts } = objectLayerToItems(layer, images);
    }
}
```

`map.images` lists every distinct image the map actually references, in draw order — including per-tile images of image-collection tilesets, and excluding tiles the map never places.
