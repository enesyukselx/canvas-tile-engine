---
sidebar_position: 1
---

# React Native

`@canvas-tile-engine/react-native` mirrors the React web API, but renders through `@shopify/react-native-skia`.

Use this package for native maps, game boards, minimaps, and touch-driven grid UIs.

## Install

Expo:

```bash
npx expo install @shopify/react-native-skia
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia
```

Bare React Native:

```bash
npm install @canvas-tile-engine/core @canvas-tile-engine/react-native @canvas-tile-engine/renderer-skia @shopify/react-native-skia
cd ios && pod install
```

`@shopify/react-native-skia` must be installed directly in the app because it is a native module.

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
            <CanvasTileEngine.Circle
                items={{ x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }}
                layer={1}
            />
        </CanvasTileEngine>
    );
}
```

The native component measures its wrapping `View` with `onLayout`. `config.size` is used as an initial placeholder and is overridden by the measured layout size.

## Draw Components

The same compound components are available:

| Component | Draws |
| :-- | :-- |
| `CanvasTileEngine.Rect` / `StaticRect` | Dynamic or cached rectangles. |
| `CanvasTileEngine.Circle` / `StaticCircle` | Dynamic or cached circles. |
| `CanvasTileEngine.Image` / `StaticImage` | `SkImage` draw items and spritesheet source rectangles. |
| `CanvasTileEngine.Sprite` | Animated spritesheet frames. |
| `CanvasTileEngine.GridLines` | Infinite grid lines. |
| `CanvasTileEngine.Line` | Line segments. |
| `CanvasTileEngine.Path` | Polylines. |
| `CanvasTileEngine.Text` | Text in world space. |
| `CanvasTileEngine.DrawFunction` | Custom Skia drawing. |

Keep large `items` arrays stable with `useMemo` or state. New array identities re-register draw callbacks and can rebuild spatial indexes.

## Images And Sprites

`engine.loadImage(uri)` resolves to a Skia `SkImage`.

```tsx
import { useEffect, useMemo, useState } from "react";
import {
    CanvasTileEngine,
    SpriteSheet,
    type EngineHandle,
    type SkImage,
} from "@canvas-tile-engine/react-native";

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
</CanvasTileEngine.DrawFunction>
```

## Runtime Notes

- `config`, `center`, and `renderer` are read when the native engine is created on first layout.
- Use `engine.setEventHandlers`, `engine.setBounds`, `engine.updateCoords`, `engine.goCoords`, `engine.setScale`, `zoomIn`, and `zoomOut` for runtime changes.
- Static helpers record and replay Skia pictures keyed by `cacheKey`.
- The React Native wrapper owns layout, gesture responder handling, tap detection, and presentation.

:::warning Maps inside a ScrollView
An interactive (drag/zoom-enabled) map inside a `ScrollView` is not supported: on React Native's New Architecture a JS responder cannot block the parent's native scroll gesture, so the map and the page end up panning at the same time — and app-level workarounds (`scrollEnabled` toggling, `canCancelContentTouches`) lose the race against the native recognizer. Use one of these layouts instead:

- Keep the map **outside** the scroll area (e.g. pinned above it) and let only the page content scroll.
- Embed a **non-interactive preview** (no `eventHandlers`): with interactions off the wrapper does not claim the gesture responder, so the page scrolls naturally over the map. Open a fullscreen interactive map on tap.
:::

## Web vs Native

| Concern | React web | React Native |
| :-- | :-- | :-- |
| Renderer | `RendererCanvas` or `RendererWebGL` | `RendererSkia` |
| Mount | Wrapper `<div>` with a `<canvas>` | Skia `<Canvas>` inside a `<View>` |
| Styling | `className` / `CSSProperties` | `ViewStyle` |
| Images | `HTMLImageElement` | `SkImage` |
| Custom draw context | Canvas2D or overlay context | `SkCanvas` |
| Input | DOM mouse/touch/wheel | Native touch responder |
