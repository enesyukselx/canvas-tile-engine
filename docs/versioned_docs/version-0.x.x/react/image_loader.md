---
sidebar_position: 7
---

# Image Loader

The React hook exposes the active renderer's image loader through `engine.loadImage()` and `engine.images`.

Canvas2D and WebGL resolve `HTMLImageElement`. React Native resolves `SkImage`; see [React Native](../react-native/installation.md).

## Load Images

```tsx
import { useEffect, useMemo, useState } from "react";
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

function MapWithImages() {
    const engine = useCanvasTileEngine();
    const [tree, setTree] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        if (!engine.isReady) return;
        engine.loadImage("/assets/tree.png").then(setTree);
    }, [engine, engine.isReady]);

    const item = useMemo(() => tree && { x: 2, y: 3, size: 1.5, img: tree }, [tree]);

    return (
        <CanvasTileEngine engine={engine} renderer={new RendererCanvas()} config={config}>
            <CanvasTileEngine.GridLines cellSize={1} />
            {item && <CanvasTileEngine.Image items={item} layer={2} />}
        </CanvasTileEngine>
    );
}
```

`engine.loadImage(src, retry = 1)` rejects if the engine is not ready. Check `engine.isReady` before calling it.

## Preload Multiple Assets

```tsx
const [assets, setAssets] = useState<Record<string, HTMLImageElement>>({});

useEffect(() => {
    if (!engine.isReady) return;

    const urls = {
        grass: "/assets/grass.png",
        water: "/assets/water.png",
        house: "/assets/house.png",
    };

    Promise.all(
        Object.entries(urls).map(async ([key, url]) => {
            const image = await engine.loadImage(url);
            return [key, image] as const;
        }),
    ).then((entries) => setAssets(Object.fromEntries(entries)));
}, [engine, engine.isReady]);
```

## Stable Image Items

Keep item arrays stable for large layers:

```tsx
const terrainItems = useMemo(
    () =>
        tiles.map((tile) => ({
            x: tile.x,
            y: tile.y,
            size: 1,
            img: assets[tile.type],
        })),
    [tiles, assets],
);

return <CanvasTileEngine.StaticImage items={terrainItems} cacheKey="terrain" layer={0} />;
```

## Loader API

After mount, `engine.images` exposes the renderer image loader:

```tsx
engine.images?.has("/assets/tree.png");
engine.images?.get("/assets/tree.png");
engine.images?.clear();

const unsubscribe = engine.images?.onLoad(() => engine.render());
unsubscribe?.();
```

## Spritesheets

```tsx
import { CanvasTileEngine, SpriteSheet } from "@canvas-tile-engine/react";

const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 8 });

<CanvasTileEngine.Image
    items={{ x: 4, y: 2, size: 1, img: unitImage, sprite: sheet.frame(0, 0) }}
    layer={2}
/>;
```

Use [`<Sprite>`](./spritesheet.md) for animation.
