---
sidebar_position: 4
---

# Configuration

`CanvasTileEngineConfig` defines the initial engine state. It is normalized by the core `Config` module, so omitted optional values get safe defaults.

```ts
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";

const config: CanvasTileEngineConfig = {
    scale: 48,
    minScale: 12,
    maxScale: 128,
    size: { width: 800, height: 500 },
    backgroundColor: "#0f172a",
    eventHandlers: { drag: true, zoom: "pointer", click: true },
};
```

## Core Settings

| Property | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `scale` | `number` | Required | Initial pixels per world unit. |
| `size` | `{ width, height, ... }` | Required | Initial logical viewport size in pixels. |
| `minScale` | `number` | `scale * 0.5` | Minimum zoom scale. Adjustable at runtime with `engine.setScaleLimits(min, max)`. |
| `maxScale` | `number` | `scale * 2` | Maximum zoom scale. Adjustable at runtime with `engine.setScaleLimits(min, max)`. |
| `backgroundColor` | `string` | `"#ffffff"` | Frame background color. |
| `gridAligned` | `boolean` | `false` | Snaps the initial center to the nearest grid-aligned value for pixel-perfect alignment: half-integers (x.5) for even tile counts, integers for odd. Integers are cell centers (cell `k` spans `[k-0.5, k+0.5]`); integer ties snap down so a center given as `N/2` lands on a 0-based board's true center `(N-1)/2`. |
| `responsive` | `"preserve-scale" \| "preserve-viewport" \| "fill" \| false` | `false` | Enables container-driven resizing in browser renderers. |
| `accessibility` | `object` | — | Accessibility preferences. See [Accessibility](#accessibility). |

### Accessibility

| Property | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `reducedMotion` | `boolean \| "auto"` | `"auto"` | Collapses engine-driven camera animation to instant. `"auto"` follows the platform: `prefers-reduced-motion` on the web, `AccessibilityInfo` on React Native. |

When reduced motion is in effect it **overrides an explicitly passed `durationMs`** — `goCenter(x, y, 800)` lands instantly. That is deliberate: a duration the app hard-codes is exactly what the preference exists to suppress, so the escape hatch is `reducedMotion: false` (or `engine.setReducedMotion(false)`), never a per-call duration.

Scope is the engine's own camera animation: `goCenter`, `goScale`, `fitBounds` and `resize`. `SpriteAnimator` and anything you draw yourself are **not** covered — call `animator.stop()` yourself if you need WCAG SC 2.2.2.

This field reports the preference **as configured**, so persisting a `getConfig()` snapshot and replaying it never turns "follow the OS" into a permanent choice. For the value actually in effect, call [`engine.getReducedMotion()`](../js/camera_and_viewport.md).

### Size

| Property | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `width` | `number` | Required | Logical width in pixels. |
| `height` | `number` | Required | Logical height in pixels. |
| `minWidth` | `number` | `100` | Minimum width for resize watchers. |
| `minHeight` | `number` | `100` | Minimum height for resize watchers. |
| `maxWidth` | `number` | `Infinity` | Maximum width for resize watchers. |
| `maxHeight` | `number` | `Infinity` | Maximum height for resize watchers. |

## Responsive Mode

Responsive mode is handled by the browser renderers. It is ignored by the server renderer, and React Native uses layout measurement instead.

| Mode | Behavior |
| :-- | :-- |
| `"preserve-scale"` | Keeps `scale` fixed. The visible world area changes as the wrapper size changes. Width-responsive only: the wrapper gets `width: 100%` and its height is pinned to `config.size.height` with an inline style, overriding CSS heights. Use `"fill"` or `"preserve-viewport"` if the height should follow the container too. |
| `"preserve-viewport"` | Keeps the configured tile count visible. The scale changes when the wrapper width changes, and the height is derived from the configured width/height ratio. |
| `"fill"` | Keeps `scale` fixed and lets both axes follow the container — the mode for a canvas that fills a panel, grid cell, or split pane. `config.size` only seeds the first frame. |
| `false` | The engine uses the configured `size` until you call `resize()` or enable `eventHandlers.resize`. |

```ts
const responsiveConfig: CanvasTileEngineConfig = {
    scale: 50,
    size: { width: 800, height: 600 },
    responsive: "preserve-scale",
};
```

:::warning
When `responsive` is enabled, `engine.resize()` and `eventHandlers.resize` are ignored because the wrapper element controls the size.
:::

### Sizing a `"fill"` container

`"fill"` gives the wrapper `width: 100%` and `height: 100%`, so the container has to have a definite height of its own. The wrapper cannot supply one: the canvas inside it is absolutely positioned, so the wrapper's content height is zero. A flex or grid child also needs `min-height: 0`, otherwise its default `min-height: auto` keeps it from shrinking.

```css
.chart-panel {
    display: flex;
    min-height: 0; /* without this a flex child refuses to shrink */
    height: 420px; /* or flex: 1 inside a parent that has a height */
}
```

The engine warns once if the first measurement comes back zero-height, because a collapsed container renders a silently blank canvas.

### Scale limits in responsive mode

`minScale` and `maxScale` describe the zoom range at the configured `size`. Responsive modes adapt them as the container resizes so the camera never gets stuck outside the reachable zoom range:

- `"preserve-viewport"` rescales `minScale` with the base scale — it acts as a zoom-out factor, so `scale: 10, minScale: 10` always means "no zooming out past the base view", no matter how wide the container is. `maxScale` stays at its configured value: it is a px-per-tile quality cap (e.g. "tiles are readable up to 40px"), which does not depend on the container width. It is only lifted when the container makes the base scale itself exceed it.
- `"preserve-scale"` keeps the limits as configured, unless finite `bounds` are set. With bounds, the minimum limit follows the scale at which the bounded area fits the viewport, so an intent like "minScale shows the whole board" stays valid at every container width. The limit is never raised above the current scale.
- `"fill"` follows the same rule as `"preserve-scale"`, with the height participating: a shorter container lowers the minimum limit through the vertical fit as well as the horizontal one.

When a `"preserve-viewport"` resize changes the scale, the engine fires `onZoom` with the new value, matching wheel/pinch and programmatic zoom changes — scale-dependent app logic (LOD switches, mini-map thresholds) keeps working across container resizes. The very first responsive sizing happens during engine construction, before callbacks can attach, so read the starting value with `engine.getScale()` after mount.

## Interactions

All interaction flags default to `false`.

| Handler | Type | Description |
| :-- | :-- | :-- |
| `click` | `boolean` | Enables tap/click callbacks. |
| `rightClick` | `boolean` | Enables right-click callbacks on DOM renderers. |
| `hover` | `boolean` | Enables hover/move callbacks. |
| `drag` | `boolean` | Enables panning by pointer drag or touch drag. |
| `zoom` | `boolean \| "pointer" \| "center"` | Enables wheel/pinch zoom. `true` is `"pointer"`. `"center"` zooms around the viewport center. |
| `resize` | `boolean` | Enables wrapper resize observation when `responsive` is `false`. |

```ts
eventHandlers: {
    drag: true,
    zoom: "center",
    click: true,
    rightClick: true,
}
```

You can update interaction flags at runtime:

```ts
engine.setEventHandlers({ drag: false, hover: true });
```

Disabled interactions leave the platform's default behavior intact: with `zoom` off the mouse wheel keeps scrolling the page, with `rightClick` off the browser context menu opens, and when `click`, `drag`, `zoom`, and `hover` are all off, touch gestures scroll the page instead of being captured by the canvas. On React Native the wrapper only claims the gesture responder while an interaction is enabled (or an `onMouseDown`/`onMouseUp` callback is set), so parent scroll views keep receiving touches.

## Bounds

Bounds restrict camera movement.

```ts
const config: CanvasTileEngineConfig = {
    scale: 48,
    size: { width: 800, height: 500 },
    bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
};
```

Use infinities for unbounded axes:

```ts
engine.setBounds({ minX: 0, maxX: 500, minY: -Infinity, maxY: Infinity });
```

## Coordinate Overlay

```ts
coordinates: {
    enabled: true,
    shownScaleRange: { min: 16, max: 96 },
}
```

| Property | Type | Default | Description |
| :-- | :-- | :-- | :-- |
| `enabled` | `boolean` | `false` | Draws coordinate labels around the viewport. |
| `shownScaleRange` | `{ min: number; max: number }` | `{ min: 0, max: Infinity }` | Only shows labels while the current scale is inside the range. |

## Debug

```ts
debug: {
    enabled: true,
    hud: {
        enabled: true,
        topLeftCoordinates: true,
        coordinates: true,
        scale: true,
        tilesInView: true,
        fps: true,
    },
}
```

| Property | Default | Description |
| :-- | :-- | :-- |
| `debug.enabled` | `false` | Master switch for debug overlays. |
| `debug.hud.enabled` | `false` | Shows the HUD panel. |
| `debug.hud.topLeftCoordinates` | `false` | Shows top-left world coordinates. |
| `debug.hud.coordinates` | `false` | Shows center coordinates. |
| `debug.hud.scale` | `false` | Shows current scale. |
| `debug.hud.tilesInView` | `false` | Shows visible tile counts. |
| `debug.hud.fps` | `false` | Shows FPS, continuously updated. |
| `debug.eventHandlers.*` | `true` | Debug logging switches for click, hover, drag, zoom, and resize. |

## Full Type

```ts
export type CanvasTileEngineConfig = {
    scale: number;
    maxScale?: number;
    minScale?: number;
    backgroundColor?: string;
    gridAligned?: boolean;
    size: {
        width: number;
        height: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
    };
    responsive?: "preserve-scale" | "preserve-viewport" | "fill" | false;
    eventHandlers?: {
        click?: boolean;
        rightClick?: boolean;
        hover?: boolean;
        drag?: boolean;
        zoom?: boolean | "pointer" | "center";
        resize?: boolean;
    };
    bounds?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
    accessibility?: {
        reducedMotion?: boolean | "auto";
    };
    coordinates?: {
        enabled?: boolean;
        shownScaleRange?: { min: number; max: number };
    };
    debug?: {
        enabled?: boolean;
        hud?: {
            enabled?: boolean;
            topLeftCoordinates?: boolean;
            coordinates?: boolean;
            scale?: boolean;
            tilesInView?: boolean;
            fps?: boolean;
        };
        eventHandlers?: {
            click?: boolean;
            hover?: boolean;
            drag?: boolean;
            zoom?: boolean;
            resize?: boolean;
        };
    };
};
```
