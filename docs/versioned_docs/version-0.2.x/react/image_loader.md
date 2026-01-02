---
sidebar_position: 7
---

# Image Loader

The engine includes a built-in `ImageLoader` utility for asynchronous image loading, caching, and deduplication. Access it through `engine.images`.

## Features

-   **In-Memory Caching**: Loaded images are stored in memory. Subsequent requests return instantly.
-   **Request Deduplication**: Multiple calls for the same URL share a single network request.
-   **Automatic Retries**: Failed loads are automatically retried (default: 3 times).

## Loading Images

Use `engine.loadImage()` when `engine.isReady` is `true`:

```tsx
function MapWithImages() {
    const engine = useCanvasTileEngine();
    const [images, setImages] = useState<Record<string, HTMLImageElement>>({});

    useEffect(() => {
        if (!engine.isReady) return;

        const loadImages = async () => {
            const tree = await engine.loadImage("/assets/tree.png");
            const rock = await engine.loadImage("/assets/rock.png");
            setImages({ tree, rock });
        };

        loadImages();
    }, [engine.isReady]);

    const imageItems = useMemo(
        () =>
            [
                { x: 5, y: 5, size: 1, img: images.tree },
                { x: 8, y: 3, size: 0.8, img: images.rock },
            ].filter((item) => item.img),
        [images]
    );

    return (
        <CanvasTileEngine engine={engine} config={config}>
            <CanvasTileEngine.GridLines cellSize={1} />
            {imageItems.length > 0 && <CanvasTileEngine.Image items={imageItems} layer={2} />}
        </CanvasTileEngine>
    );
}
```

## Preloading Multiple Images

Load all assets in parallel before rendering:

```tsx
function MapWithPreloadedAssets() {
    const engine = useCanvasTileEngine();
    const [loaded, setLoaded] = useState(false);
    const [assets, setAssets] = useState<Record<string, HTMLImageElement>>({});

    useEffect(() => {
        if (!engine.isReady) return;

        const preload = async () => {
            const urls = {
                grass: "/assets/grass.png",
                water: "/assets/water.png",
                tree: "/assets/tree.png",
                house: "/assets/house.png",
            };

            const entries = await Promise.all(
                Object.entries(urls).map(async ([key, url]) => {
                    const img = await engine.loadImage(url);
                    return [key, img] as const;
                })
            );

            setAssets(Object.fromEntries(entries));
            setLoaded(true);
        };

        preload();
    }, [engine.isReady]);

    if (!loaded) {
        return <div>Loading assets...</div>;
    }

    return (
        <CanvasTileEngine engine={engine} config={config}>
            {/* Use assets.grass, assets.water, etc. */}
        </CanvasTileEngine>
    );
}
```

## Custom Hook for Image Loading

Create a reusable hook for image loading:

```tsx
function useLoadedImage(engine: EngineHandle, url: string) {
    const [image, setImage] = useState<HTMLImageElement | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);

    useEffect(() => {
        if (!engine.isReady) return;

        setLoading(true);
        setError(null);

        engine
            .loadImage(url)
            .then(setImage)
            .catch(setError)
            .finally(() => setLoading(false));
    }, [engine.isReady, url]);

    return { image, loading, error };
}

// Usage - component must be rendered inside CanvasTileEngine
function TreeMarker({ engine, x, y }: { engine: EngineHandle; x: number; y: number }) {
    const { image, loading } = useLoadedImage(engine, "/assets/tree.png");

    if (loading || !image) return null;

    return <CanvasTileEngine.Image items={{ x, y, size: 1, img: image }} layer={2} />;
}

// In parent component:
function App() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine engine={engine} config={config}>
            <TreeMarker engine={engine} x={5} y={10} />
        </CanvasTileEngine>
    );
}
```

## Complete Example: Rendering a Map

```tsx
interface MapObject {
    id: string;
    x: number;
    y: number;
    type: "tree" | "rock" | "house";
}

const ASSET_URLS: Record<string, string> = {
    tree: "/assets/tree.png",
    rock: "/assets/rock.png",
    house: "/assets/house.png",
};

function GameMap({ objects }: { objects: MapObject[] }) {
    const engine = useCanvasTileEngine();
    const [assets, setAssets] = useState<Record<string, HTMLImageElement>>({});
    const [ready, setReady] = useState(false);

    // Load all required assets
    useEffect(() => {
        if (!engine.isReady) return;

        const requiredTypes = [...new Set(objects.map((o) => o.type))];

        Promise.all(
            requiredTypes.map(async (type) => {
                const img = await engine.loadImage(ASSET_URLS[type]);
                return [type, img] as const;
            })
        ).then((entries) => {
            setAssets(Object.fromEntries(entries));
            setReady(true);
        });
    }, [engine.isReady, objects]);

    // Build image items
    const imageItems = useMemo(() => {
        if (!ready) return [];

        return objects.map((obj) => ({
            x: obj.x,
            y: obj.y,
            size: 1,
            img: assets[obj.type],
        }));
    }, [objects, assets, ready]);

    const config = {
        scale: 50,
        size: { width: 800, height: 600 },
        eventHandlers: { drag: true, zoom: true },
    };

    return (
        <CanvasTileEngine engine={engine} config={config}>
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="rgba(0,0,0,0.1)" />
            {ready && <CanvasTileEngine.Image items={imageItems} layer={2} />}
        </CanvasTileEngine>
    );
}
```

## With Static Caching

For static terrain or decorations, combine with `<StaticImage>`:

```tsx
function TerrainMap({ tiles }: { tiles: TileData[] }) {
    const engine = useCanvasTileEngine();
    const [tileImages, setTileImages] = useState<Record<string, HTMLImageElement>>({});
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!engine.isReady) return;

        const types = [...new Set(tiles.map((t) => t.type))];

        Promise.all(
            types.map(async (type) => {
                const img = await engine.loadImage(`/assets/terrain/${type}.png`);
                return [type, img] as const;
            })
        ).then((entries) => {
            setTileImages(Object.fromEntries(entries));
            setReady(true);
        });
    }, [engine.isReady, tiles]);

    const terrainItems = useMemo(() => {
        if (!ready) return [];

        return tiles.map((tile) => ({
            x: tile.x,
            y: tile.y,
            size: 1,
            img: tileImages[tile.type],
        }));
    }, [tiles, tileImages, ready]);

    return (
        <CanvasTileEngine engine={engine} config={config}>
            {ready && <CanvasTileEngine.StaticImage items={terrainItems} cacheKey="terrain" layer={0} />}
        </CanvasTileEngine>
    );
}
```

:::tip Performance Tips

-   **Preload assets**: Load all images before first render to avoid flicker
-   **Use `useMemo`**: Memoize image item arrays to prevent unnecessary re-renders
-   **Batch similar images**: Group items by image type for better cache utilization
-   **Static for terrain**: Use `<StaticImage>` for non-changing terrain tiles
    :::
