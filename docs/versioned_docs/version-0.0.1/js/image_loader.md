---
sidebar_position: 7
---

# Image Loader

The engine includes a built-in `ImageLoader` utility to handle asynchronous image loading, caching, and deduplication. This ensures that if you try to load the same image URL multiple times, it only triggers a single network request.

## Features

- **In-Memory Caching**: Loaded images are stored in memory. Subsequent requests for the same URL return the cached image instantly.
- **Request Deduplication**: If multiple calls to `load()` are made for the same URL while it's still fetching, they all wait for the single ongoing request.
- **Automatic Retries**: Failed loads are automatically retried (default: 3 times).

## Usage

You can access the loader via `engine.images`.

### Loading a Single Image

```typescript
const img = await engine.images.load("/assets/tree.png");
// Now you can use 'img' in drawImage
```

### Preloading Multiple Images

For better performance, it's recommended to preload all necessary assets before the first render.

```typescript
const assets = [
    "/assets/grass.png",
    "/assets/water.png",
    "/assets/house.png"
];

// Load all in parallel
const loadedImages = await Promise.all(
    assets.map(url => engine.images.load(url))
);

console.log("All assets loaded!");
```

## Drawing Images

Once images are loaded, you can draw them using `engine.drawImage`.

### Example: Rendering a Map

Here is a complete example of loading data, fetching images, and rendering them on the map.

```typescript
// 1. Define your map data
const mapObjects = [
    { x: 5, y: 5, type: "tree", url: "/assets/tree.png" },
    { x: 8, y: 2, type: "rock", url: "/assets/rock.png" },
    { x: 10, y: 10, type: "house", url: "/assets/house.png" }
];

// 2. Load images and prepare draw items
const drawItems = async () => {
    // Load images in parallel
    const loadedItems = await Promise.all(
        mapObjects.map(async (item) => {
            const img = await engine.images.load(item.url);
            return {
                img: img,
                x: item.x,
                y: item.y,
                size: 1 // 1 grid unit size
            };
        })
    );

    // 3. Draw all items at once
    engine.drawImage(loadedItems, 2); // Draw on layer 2
    
    // 4. Render the frame
    engine.render();
};

// Start the process
drawItems();
```

:::tip
The `drawImage` method supports batch drawing. Passing an array of objects is much faster than calling `drawImage` inside a loop.
:::
