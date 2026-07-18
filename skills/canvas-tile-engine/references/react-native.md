# React Native Reference

Package: `@canvas-tile-engine/react-native`, rendered through
`@canvas-tile-engine/renderer-skia` on `@shopify/react-native-skia`. The API
mirrors the React web package - same compound components, same
`useCanvasTileEngine` handle - with the platform differences below.

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

`@shopify/react-native-skia` and `react-native-gesture-handler` must be
installed directly in the app (native modules), but app CODE should import
Skia types/values from `@canvas-tile-engine/react-native` re-exports instead
(see below). The app root (or any ancestor of the map) MUST be wrapped in
`GestureHandlerRootView` from react-native-gesture-handler — touch input is
routed through it; without the root view the map receives no touches.

## Basic setup

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
                size: { width: 0, height: 0 },   // placeholder - see sizing note
                backgroundColor: "#0f172a",
                eventHandlers: { drag: true, zoom: true, click: true },
            }}
            style={{ flex: 1 }}                   // ViewStyle, not CSS
            onClick={(coords) => console.log("Tapped", coords.snapped)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
            <CanvasTileEngine.Circle items={{ x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }} layer={1} />
        </CanvasTileEngine>
    );
}
```

## Grid-sized boards (gridToSize on native)

On native the measured layout overrides `config.size`, so `gridToSize`'s
pixel output goes into `style` (the layout then measures to exactly that),
with the cell size derived from the screen:

```tsx
const { width } = useWindowDimensions(); // NOT Dimensions.get (no re-render)
const cellSize = Math.floor(width / COLUMNS); // floor keeps 1px lines crisp
const { size, scale, center } = gridToSize({ columns: COLUMNS, rows: ROWS, cellSize });

<CanvasTileEngine style={{ width: size.width, height: size.height }}
    config={{ ...baseConfig, scale, size }} center={center} ... />
```

`config`/`center` are read once at engine creation — remount with
`key={width}` if the window size can change while mounted. Alternative for
fluid layouts: `style={{ flex: 1 }}` + `engine.fitBounds(boardRect,
{ durationMs: 0 })` once ready (re-run in `onResize`); contain-fit shows
extra world on the loose axis when aspect ratios differ.

## Platform differences vs React web

| Concern | React Native behavior |
| :-- | :-- |
| Sizing | The component measures its `View` with `onLayout`. `config.size` is only an initial placeholder (`{ width: 0, height: 0 }` is fine); the measured layout wins. Size the surface with `style` (`flex: 1` etc.). `responsive` config is not used. |
| `style` prop | React Native `ViewStyle`, not CSSProperties. No `className`. |
| Images | `TImage` is Skia's `SkImage`. `engine.loadImage(uri)` resolves to `SkImage`. Remote URLs work. |
| Touch input | Taps -> `onClick` (a touch that moves beyond a small slop or lasts too long becomes a drag, not a tap). One-finger drag pans; two-finger pinch zooms. |
| Not available | `onRightClick` / `rightClick`, `hover`, mouse cursor styling. Do not build hover-dependent UX. |
| Custom drawing | `onDraw`, `<CanvasTileEngine.DrawFunction>`, and `addDrawFunction` receive a Skia `SkCanvas`, not a 2D context. |
| Coordinate overlay & debug HUD | Supported via the same `config.coordinates` / `config.debug` options. |

Everything else matches the web React reference ([react.md](react.md)):
mount-once `config`/`renderer`/`center`, `isReady` gating, referentially
stable `items`, the same 12 compound components with the same props, static
caching, layers.

## Skia re-exports (import from the RN package, not @shopify/react-native-skia)

```tsx
import {
    CanvasTileEngine, useCanvasTileEngine, useEngineContext,
    // core re-exports
    CanvasTileEngineCore, gridToSize, SpriteSheet, SpriteAnimator,
    // Skia surface
    Skia,
} from "@canvas-tile-engine/react-native";
import type {
    EngineHandle, SkiaEngine, CanvasTileEngineConfig, Coords, Rect, Circle,
    Text, Line, Path, PathItem, PathStyle, ImageItem, SpriteRect,
    SkCanvas, SkImage, SkPaint, SkFont, SkPath, SkRect, SkPoint, SkRRect, SkiaImageItem,
} from "@canvas-tile-engine/react-native";
```

`SkiaImageItem` is a convenience alias for `ImageItem<SkImage>`.

## Custom Skia drawing

```tsx
import { Skia } from "@canvas-tile-engine/react-native";
import type { SkCanvas } from "@canvas-tile-engine/react-native";

<CanvasTileEngine.DrawFunction layer={5}>
    {(ctx, topLeft, config) => {
        const canvas = ctx as SkCanvas;
        const paint = Skia.Paint();
        paint.setColor(Skia.Color("rgba(255,255,255,0.6)"));
        const sx = (0 - topLeft.x) * config.scale;
        const sy = (0 - topLeft.y) * config.scale;
        canvas.drawRect({ x: sx, y: sy, width: config.scale, height: config.scale }, paint);
    }}
</CanvasTileEngine.DrawFunction>
```

## Images and sprites on native

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

Sprite mechanics are identical across platforms: [sprites.md](sprites.md).

## Pitfalls checklist

- Importing from `@shopify/react-native-skia` in app code: use the RN
  package's re-exports so versions stay aligned.
- Treating `config.size` as authoritative: layout measurement overrides it;
  control size with `style`.
- Designing interactions around hover or right-click: not available on
  native.
- Forgetting `flex: 1` (or explicit dimensions) on `style`: a zero-sized
  `View` renders nothing.
- Writing 2D-context code in `DrawFunction`: the ctx is an `SkCanvas`; use
  `Skia.Paint()` and SkCanvas methods.
- Forgetting `GestureHandlerRootView` at the app root: the map silently
  receives no touch input. Maps inside a `ScrollView` ARE supported: touch
  runs through react-native-gesture-handler's native arbitration, so an
  interactive map claims the touch stream (page does not scroll under it)
  and a non-interactive one (no `eventHandlers`) yields so the page scrolls
  over it. Import the `ScrollView` from react-native-gesture-handler (not
  react-native) when embedding a map in one.
