---
sidebar_position: 6
---

# Performance

Canvas Tile Engine is designed for large grid scenes, but the best strategy depends on whether your content is dynamic, static, visible all at once, or spread across a large world.

## Automatic Optimizations

### Viewport Culling

Draw methods skip items outside the visible viewport plus a small buffer. This applies to rectangles, circles, text, images, lines, and paths.

### Spatial Indexing

For arrays larger than 500 items, dynamic rect, circle, text, and image layers build an RBush spatial index. Viewport queries then avoid scanning the whole list each frame.

```ts
engine.drawRect(largeArrayOfTiles, 1);
```

Use one draw call with an array instead of thousands of draw calls.

### Renderer Batching

- Canvas2D reduces repeated style changes while iterating visible items.
- WebGL batches geometry into GPU draw calls.
- Skia caches parsed colors and fonts and records frames as pictures.

## Static Drawing

Static helpers are best for large non-changing layers.

```ts
engine.drawStaticRect(items, "terrain", 0);
engine.drawStaticCircle(markers, "markers", 1);
engine.drawStaticImage(images, "decorations", 1);
```

Renderer behavior differs:

| Renderer | Static helper behavior |
| :-- | :-- |
| Canvas2D | Pre-renders to an offscreen canvas and blits visible portions. |
| WebGL | Delegates to dynamic batched drawing; no offscreen cache is kept. |
| Skia | Records a reusable `SkPicture`. |
| Server | Uses an offscreen `@napi-rs/canvas` cache. |

Clear caches when underlying static data changes:

```ts
engine.clearStaticCache("terrain");
engine.clearStaticCache();
```

## React Stability

React draw components compare `items` by reference. Keep large arrays stable with `useMemo`, `useState`, or external state.

```tsx
const terrainItems = useMemo(() => buildTerrain(terrain), [terrain]);

<CanvasTileEngine.StaticRect items={terrainItems} cacheKey="terrain" layer={0} />;
```

Avoid inline arrays for large layers:

```tsx
// Avoid for large data: new array identity on every render.
<CanvasTileEngine.Rect items={data.map(toRect)} layer={1} />;
```

## Practical Rules

- Batch items: `drawRect(items)` is better than calling `drawRect(item)` in a loop.
- Use dynamic draw calls for frequently changing layers.
- Use static draw calls for large, non-changing terrain or minimap layers.
- Keep sprite animation frame lists stable.
- In WebGL, call `renderer.invalidateTexture(source)` after mutating an image/canvas source without changing its dimensions.
- Prefer server `renderer.encode()` over `toBuffer()` in request handlers to avoid blocking.
