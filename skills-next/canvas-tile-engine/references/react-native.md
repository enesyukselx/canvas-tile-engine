# React Native Reference

Package: `@canvas-tile-engine/react-native`, rendered through
`@canvas-tile-engine/renderer-skia` on `@shopify/react-native-skia`. The API
mirrors the React web package - same compound components, same
`useCanvasTileEngine` handle, same rules ([react.md](react.md): mount-once
props, effects keyed on `engine.instance` with an `id` or cleanup on every
draw, stable `items`, `styleOf`) - with the platform differences below.

Contents:

- [Install](#install)
- [Basic setup](#basic-setup)
- [Grid-sized boards (gridToSize on native)](#grid-sized-boards-gridtosize-on-native)
- [Platform differences vs React web](#platform-differences-vs-react-web)
- [Imports and types](#imports-and-types)
- [Custom Skia drawing](#custom-skia-drawing)
- [Images and sprites on native](#images-and-sprites-on-native)
- [Reduced motion and accessibility](#reduced-motion-and-accessibility)
- [Pitfalls checklist](#pitfalls-checklist)

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
Skia types/values from the `@canvas-tile-engine/react-native` re-exports
([Imports and types](#imports-and-types)). The app root (or any ancestor of
the map) MUST be wrapped in `GestureHandlerRootView` from
react-native-gesture-handler - touch input is routed through it; without it
the map receives no touches.

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
                size: { width: 0, height: 0 }, // placeholder: the measured layout wins
                backgroundColor: "#0f172a",
                eventHandlers: { drag: true, zoom: true, click: true },
            }}
            style={{ flex: 1 }} // ViewStyle, not CSS
            onClick={(coords) => console.log("Tapped", coords.snapped)}
        >
            <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
            <CanvasTileEngine.Circle items={DOT} layer={1} />
        </CanvasTileEngine>
    );
}

const DOT = { x: 0, y: 0, size: 0.8, style: { fillStyle: "#22d3ee" } }; // stable identity
```

## Grid-sized boards (gridToSize on native)

The measured layout overrides `config.size`, so put `gridToSize`'s pixel
size into `style` (the layout then measures exactly that) and derive the
cell size from the screen:

```tsx
import { useWindowDimensions } from "react-native";
import { CanvasTileEngine, gridToSize, useCanvasTileEngine } from "@canvas-tile-engine/react-native";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";

const COLUMNS = 8;
const ROWS = 8;

export function Board() {
    const engine = useCanvasTileEngine();
    const { width } = useWindowDimensions(); // NOT Dimensions.get (no re-render)
    const cellSize = Math.floor(width / COLUMNS); // whole px keep 1px lines crisp
    const { size, scale, center } = gridToSize({ columns: COLUMNS, rows: ROWS, cellSize });

    return (
        <CanvasTileEngine
            key={width} // config/center are read once: remount when the window changes
            engine={engine}
            renderer={new RendererSkia()}
            config={{ scale, size, eventHandlers: { click: true } }}
            center={center} // REQUIRED: cells 0..7 are centered at 3.5
            style={{ width: size.width, height: size.height }}
        />
    );
}
```

- Pass `center` and leave `gridAligned` off. `gridAligned` snaps the
  initial center from the MEASURED tile count (layout size / scale), once at
  creation; a board with a fractional margin (8 cells + gutters = 9 world
  units, an odd count) snaps half a cell off.
- Fluid alternative: `style={{ flex: 1 }}` + `engine.fitBounds(boardArea,
  { durationMs: 0 })` in an `engine.instance` effect (re-run in `onResize`),
  with `boardArea` in item space (`-0.5..N-0.5`,
  [core-api.md](core-api.md#coordinate-spaces)). Contain-fit shows extra
  world on the loose axis when aspect ratios differ.
- Board labels (a-h / 1-8): draw your own `Text` items. The coordinate
  overlay (`config.coordinates`) only shows integer item coordinates and its
  format is not customizable.

## Platform differences vs React web

| Concern | React Native behavior |
| :-- | :-- |
| Sizing | The component measures its `View` with `onLayout`; `config.size` is only a placeholder (`{ width: 0, height: 0 }` is fine). The `View` defaults to `flex: 1` (your `style` merges over it), so its parent must give it room. `responsive` is not used. |
| `style` prop | React Native `ViewStyle`, not CSSProperties. No `className`. |
| Handle | Same `EngineHandle` as the web, `isReady` and `instance` included (key effects on `engine.instance`). No `resize()`: layout sizes the view. |
| Images | `TImage` is Skia's `SkImage`. `engine.loadImage(uri)` takes a URI STRING ([Images and sprites](#images-and-sprites-on-native)). |
| Touch input | Taps -> `onClick` (a touch that moves beyond a small slop or lasts too long becomes a drag, not a tap). One-finger drag pans; two-finger pinch zooms. |
| Not available | `onRightClick` / `rightClick`, `hover`, cursor styling, keyboard camera control. Do not build hover-dependent UX. |
| Custom drawing | `onDraw`, `<CanvasTileEngine.DrawFunction>` and `addDrawFunction` receive a Skia `SkCanvas`, not a 2D context. |
| Coordinate overlay & debug HUD | Supported via `config.coordinates` / `config.debug`; overlay labels are not formattable. |
| Overlays (HUD, legend) | Non-draw children render AFTER the measured `View`, not over it: wrap `<CanvasTileEngine>` and the overlay in one parent `View`, position the overlay absolutely with `pointerEvents="none"` ([drawing.md](drawing.md#screen-fixed-overlays-hud-legend-labels-pinned-to-the-viewport)). |

For drawing/selection tools, end the active press in both `onMouseUp` and
`onMouseLeave`. A one-finger `onMouseDown` receives one `onMouseUp` at the
final lift even after multitouch suppresses the click; cancellation or
unmount uses `onMouseLeave` at that finger's last known position. A gesture
starting with multiple fingers does not emit a single-pointer down/release.
Passing `onMouseDown`/`onMouseUp` makes the view claim touches even when no
`eventHandlers` flag is on.

## Imports and types

Import from the RN package, not `@shopify/react-native-skia`, so versions
stay aligned:

```tsx
import {
    CanvasTileEngine, useCanvasTileEngine, useEngineContext,
    // core re-exports
    CanvasTileEngineCore, gridToSize, fitScale, itemsBounds, SpriteSheet, SpriteAnimator,
    ConfigValidationError, // core >= 0.12
    // Skia surface
    Skia,
} from "@canvas-tile-engine/react-native";
import type {
    EngineHandle, SkiaEngine, CanvasTileEngineConfig, Coords, Rect, Circle,
    Text as TextItem, // RN's own <Text> component has the same name
    Line, PathItem, PathStyle, ImageItem, SpriteRect, onClickCallback,
    SkCanvas, SkImage, SkPaint, SkFont, SkPath, SkRect, SkPoint, SkRRect, SkiaImageItem,
} from "@canvas-tile-engine/react-native";
import type { Bounds, LinearGradient, HitResult } from "@canvas-tile-engine/core"; // not re-exported
```

The binding/core split is the same as on the web
([react.md](react.md#types-binding-or-core)), plus the Skia types.
`SkiaImageItem` is an alias for `ImageItem<SkImage>`; `SkiaEngine` is the
core engine class typed for Skia (the type of `engine.instance`).

## Custom Skia drawing

```tsx
import { useMemo } from "react";
import { CanvasTileEngine, Skia } from "@canvas-tile-engine/react-native";

function CellHighlight() {
    const paint = useMemo(() => {
        const p = Skia.Paint(); // allocate once, not per frame
        p.setColor(Skia.Color("rgba(255,255,255,0.6)"));
        return p;
    }, []);

    return (
        <CanvasTileEngine.DrawFunction layer={5}>
            {(canvas, _topLeft, config, transform) => {
                // canvas is typed SkCanvas; worldToScreen takes item coords
                const p = transform.worldToScreen(0, 0); // center of cell (0, 0)
                const s = config.scale;
                canvas.drawRect({ x: p.x - s / 2, y: p.y - s / 2, width: s, height: s }, paint);
            }}
        </CanvasTileEngine.DrawFunction>
    );
}
```

`<DrawFunction>` children get a typed `SkCanvas`; `onDraw` and
`engine.addDrawFunction` pass `ctx: unknown` - cast it (`ctx as SkCanvas`).
Arguments and pixel rules: [drawing.md](drawing.md#custom-draw-functions).

## Images and sprites on native

`engine.loadImage(src)` decodes `src` with `Skia.Data.fromURI`, so it takes
a URI string: remote `https://...` URLs work directly. A bundled asset is a
`require()` module id, not a URI - resolve it first with
`Image.resolveAssetSource` (the same resolution react-native-skia's own
`useImage` uses):

```js
import { Image } from "react-native";

const UNIT_URI = Image.resolveAssetSource(require("./assets/unit.png")).uri;
```

```tsx
import { useEffect, useMemo, useState } from "react";
import { CanvasTileEngine, SpriteSheet, useEngineContext, type SkImage } from "@canvas-tile-engine/react-native";

// Render as a child of <CanvasTileEngine> (the engine exists at mount):
// <UnitLayer src={UNIT_URI} /> or <UnitLayer src="https://example.com/unit.png" />
function UnitLayer({ src }: { src: string }) {
    const { engine } = useEngineContext();
    const [img, setImg] = useState<SkImage | null>(null);
    const sheet = useMemo(() => new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 8 }), []);
    const walk = useMemo(() => sheet.framesInRow(0, 0, 5), [sheet]); // row 0, cols 0..5 inclusive

    useEffect(() => {
        let live = true;
        engine.loadImage(src).then((i) => live && setImg(i));
        return () => {
            live = false;
        };
    }, [engine, src]);

    const units = useMemo(() => (img ? [{ x: 4, y: 2, size: 1, img }] : []), [img]);
    return img ? <CanvasTileEngine.Sprite items={units} frames={walk} fps={8} layer={2} /> : null;
}
```

Sprite mechanics are identical across platforms: [sprites.md](sprites.md).

## Reduced motion and accessibility

Reduced motion is wired automatically - apps subscribe to nothing. The
binding reads `AccessibilityInfo.isReduceMotionEnabled()` on mount and
tracks `reduceMotionChanged`, feeding the `"auto"` preference: with the OS
setting on, `goCenter`/`goScale`/`fitBounds` land instantly, overriding any
`durationMs`. `engine.setReducedMotion(false)` forces animation on;
`engine.getReducedMotion()` is poll-only (no change event reaches app code,
`false` before mount) - read it when starting your own animation, since
`SpriteAnimator` and `DrawFunction` motion are yours to stop. Semantics:
[core-api.md](core-api.md#accessibility-and-reduced-motion).

`config.accessibility.label` / `.description` / `.role` (core >= 0.12) land
on the measured `View` (accessible / accessibilityLabel / accessibilityHint
/ accessibilityRole), never on the Skia `Canvas`. Only `role: "image"` has an
RN equivalent - `"region"` and `"application"` are dropped and the label
still announces. Config is read once: change them at runtime with
`engine.setAccessibility(patch)`.

LIMITATION to tell users: this makes the surface ANNOUNCED but not OPERABLE
on React Native. Keyboard camera control is DOM-only (RN's core View has no
key events) and `accessibilityActions` is not wired yet.

## Pitfalls checklist

- Importing from `@shopify/react-native-skia` in app code: use the RN
  package's re-exports so versions stay aligned.
- `import type { Text }` from the binding next to RN's `Text` component: a
  name clash. Alias it (`type Text as TextItem`).
- Treating `config.size` as authoritative: layout measurement overrides it;
  control size with `style`.
- `gridAligned` on a board: the measured size decides the snap. Pass
  `center` from `gridToSize` and leave it off.
- Designing interactions around hover, right-click or keys: not available
  on native.
- A parent with no height: the `View` defaults to `flex: 1`, which is zero
  inside an unsized parent - it renders nothing.
- Writing 2D-context code in `DrawFunction`: the ctx is an `SkCanvas`; use
  `Skia.Paint()` and SkCanvas methods.
- Passing a `require()` id to `loadImage`: it takes a URI string; resolve
  bundled assets with `Image.resolveAssetSource(...).uri`.
- Forgetting `GestureHandlerRootView` at the app root: the map silently
  receives no touch input.
- Maps inside a `ScrollView` ARE supported: touch runs through
  react-native-gesture-handler's native arbitration, so an interactive map
  claims the touch stream (the page does not scroll under it) and a
  non-interactive one (no `eventHandlers`, no `onMouseDown`/`onMouseUp`)
  yields so the page scrolls over it. Import the `ScrollView` from
  react-native-gesture-handler (not react-native) when embedding a map.
