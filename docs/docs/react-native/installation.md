---
sidebar_position: 1
---

# React Native

`@canvas-tile-engine/react-native` mirrors the React web API, but renders through `@shopify/react-native-skia`.

Use this package for native maps, game boards, minimaps, and touch-driven grid UIs.

## Install

Expo:

```bash
npx expo install @shopify/react-native-skia react-native-gesture-handler
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia
```

Bare React Native:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia @shopify/react-native-skia react-native-gesture-handler
cd ios && pod install
```

`@shopify/react-native-skia` and `react-native-gesture-handler` must be installed directly in the app because they are native modules.

Touch input runs through `react-native-gesture-handler`, so the app root (or any ancestor of the map) must be wrapped in `GestureHandlerRootView`:

```tsx
import { GestureHandlerRootView } from "react-native-gesture-handler";

export default function App() {
    return <GestureHandlerRootView style={{ flex: 1 }}>{/* your app */}</GestureHandlerRootView>;
}
```

## Basic Setup

```tsx
import { CanvasTileEngine, useCanvasTileEngine } from "@canvas-tile-engine/react-native";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";

export function NativeMap() {
    const engine = useCanvasTileEngine();

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererSkia()}
            config={{
                scale: 32,
                minScale: 8,
                maxScale: 96,
                size: { width: 0, height: 0 },
                backgroundColor: "#0f172a",
                eventHandlers: { drag: true, zoom: true, click: true },
            }}
            style={{ flex: 1 }}
            onClick={(coords) => console.log("Tapped", coords.snapped)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
            <CanvasTileEngine.Circle items={{ x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }} layer={1} />
        </CanvasTileEngine>
    );
}
```

The native component measures its wrapping `View` with `onLayout`. `config.size` is used as an initial placeholder and is overridden by the measured layout size.

## Grid-Sized Boards

On the web, `gridToSize` computes a pixel `size` for the config and the canvas is created at exactly that size. On native the measured layout wins instead — so put the computed pixels into `style`, and derive the cell size from the screen so the board fills the width on every device:

```tsx
import { useWindowDimensions } from "react-native";
import { gridToSize } from "@canvas-tile-engine/react-native";

const COLUMNS = 8;
const ROWS = 8;

export function Board() {
    const engine = useCanvasTileEngine();
    const { width } = useWindowDimensions();
    // Full-width board; subtract any horizontal padding your layout adds.
    // Math.floor keeps 1px grid lines crisp on non-integer cell sizes.
    const cellSize = Math.floor(width / COLUMNS);

    const { size, scale, center } = gridToSize({ columns: COLUMNS, rows: ROWS, cellSize });

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererSkia()}
            // The layout size is what the engine actually measures.
            style={{ width: size.width, height: size.height }}
            config={{ ...baseConfig, scale, size }}
            center={center}
        />
    );
}
```

Two things to know:

- `config` and `center` are read once when the engine is created. If the window size can change while the board is mounted (rotation, foldables), remount with `key={width}` so the new cell size applies — or skip fixed sizing entirely and use the fit approach below.
- Prefer `useWindowDimensions` over `Dimensions.get`: the hook re-renders on window changes, `Dimensions.get` reads once.

**Alternative: fit the board to whatever space you have.** Keep the layout fluid (`style={{ flex: 1 }}`) and let [`fitBounds`](../js/camera_and_viewport.md) size the camera instead — better when the map area is dynamic:

```tsx
useEffect(() => {
    if (!engine.isReady) return;
    // Cells 0..7 span -0.5..7.5 in corner space
    engine.fitBounds({ minX: -0.5, maxX: 7.5, minY: -0.5, maxY: 7.5 }, { durationMs: 0 });
}, [engine.isReady]);
```

Re-run it in `onResize` and the fit survives layout changes. Note `fitBounds` is a uniform-scale contain fit: if the viewport's aspect ratio differs from the board's, the loose axis shows extra world beyond the rectangle.

## Draw Components

The same compound components are available:

| Component                                  | Draws                                                   |
| :----------------------------------------- | :------------------------------------------------------ |
| `CanvasTileEngine.Rect` / `StaticRect`     | Dynamic or cached rectangles.                           |
| `CanvasTileEngine.Circle` / `StaticCircle` | Dynamic or cached circles.                              |
| `CanvasTileEngine.Image` / `StaticImage`   | `SkImage` draw items and spritesheet source rectangles. |
| `CanvasTileEngine.Sprite`                  | Animated spritesheet frames.                            |
| `CanvasTileEngine.GridLines`               | Infinite grid lines.                                    |
| `CanvasTileEngine.Line`                    | Line segments.                                          |
| `CanvasTileEngine.Path`                    | Free-form paths: polylines, closed/filled shapes.       |
| `CanvasTileEngine.Text`                    | Text in world space.                                    |
| `CanvasTileEngine.DrawFunction`            | Custom Skia drawing.                                    |

Keep large `items` arrays stable with `useMemo` or state. New array identities re-register draw callbacks and can rebuild spatial indexes.

## Images And Sprites

`engine.loadImage(uri)` resolves to a Skia `SkImage`.

```tsx
import { useEffect, useMemo, useState } from "react";
import { CanvasTileEngine, SpriteSheet, type EngineHandle, type SkImage } from "@canvas-tile-engine/react-native";

function UnitLayer({ engine }: { engine: EngineHandle }) {
    const [img, setImg] = useState<SkImage | null>(null);
    const sheet = useMemo(() => new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 8 }), []);
    const frames = useMemo(() => sheet.framesInRow(0, 0, 5), [sheet]);

    useEffect(() => {
        if (!engine.isReady) return;
        engine.loadImage("https://example.com/unit.png").then(setImg);
    }, [engine, engine.isReady]);

    if (!img) return null;

    return <CanvasTileEngine.Sprite items={{ x: 4, y: 2, size: 1, img }} frames={frames} fps={8} layer={2} />;
}
```

## Custom Drawing

`onDraw` and `<CanvasTileEngine.DrawFunction>` receive a Skia `SkCanvas`.

```tsx
import { Skia } from "@canvas-tile-engine/react-native";

<CanvasTileEngine.DrawFunction layer={5}>
    {(canvas) => {
        const paint = Skia.Paint();
        paint.setColor(Skia.Color("#f97316"));
        canvas.drawRect(Skia.XYWHRect(12, 12, 80, 24), paint);
    }}
</CanvasTileEngine.DrawFunction>;
```

## Runtime Notes

- `config`, `center`, and `renderer` are read when the native engine is created on first layout.
- Use `engine.setEventHandlers`, `engine.setBounds`, `engine.setCenter`, `engine.goCenter`, `engine.setScale`, `engine.goScale`, `engine.setScaleLimits`, `zoomIn`, and `zoomOut` for runtime changes.
- Static helpers record and replay Skia pictures keyed by `cacheKey`.
- The React Native wrapper owns layout, touch handling (via react-native-gesture-handler), tap detection, and presentation.

:::info Maps inside a ScrollView
Because touch input participates in native gesture arbitration (react-native-gesture-handler), an interactive map inside a `ScrollView` works: while interactions are enabled the map claims the touch stream and the page does not scroll under it; with interactions off (no `eventHandlers`) the gesture yields and the page scrolls naturally over the map. For reliable arbitration, import the `ScrollView` from `react-native-gesture-handler` (not from `react-native`) when embedding a map in it.
:::

## Web vs Native

| Concern             | React web                           | React Native                      |
| :------------------ | :---------------------------------- | :-------------------------------- |
| Renderer            | `RendererCanvas` or `RendererWebGL` | `RendererSkia`                    |
| Mount               | Wrapper `<div>` with a `<canvas>`   | Skia `<Canvas>` inside a `<View>` |
| Styling             | `className` / `CSSProperties`       | `ViewStyle`                       |
| Images              | `HTMLImageElement`                  | `SkImage`                         |
| Custom draw context | Canvas2D or overlay context         | `SkCanvas`                        |
| Input               | DOM mouse/touch/wheel               | react-native-gesture-handler      |
