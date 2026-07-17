# Events and Interaction Reference

All interaction is opt-in via `config.eventHandlers` (every flag defaults to
`false`) and can be changed at runtime with `engine.setEventHandlers()`.
Disabled flags leave platform defaults intact: with `zoom` off the wheel
scrolls the page, with `rightClick` off the context menu opens, and with
`click`/`drag`/`zoom`/`hover` all off touch gestures scroll the page. On
React Native the wrapper claims the gesture responder only while an
interaction is enabled (or `onMouseDown`/`onMouseUp` is set), so parent
scroll views keep working.

```ts
eventHandlers: {
    click: true,        // tap/click -> onClick
    rightClick: true,   // DOM context menu -> onRightClick (browser only;
                        // the default browser menu is suppressed)
    hover: true,        // pointer move (not dragging) -> onHover
    drag: true,         // pointer/touch drag pans the camera
    zoom: "pointer",    // wheel + pinch; true === "pointer"; "center" zooms
                        // around the viewport center; false disables
    resize: true,       // observe wrapper size when responsive === false
}
```

## Pointer callback payload

`onClick`, `onRightClick`, `onHover`, `onMouseDown`, `onMouseUp`,
`onMouseLeave` all receive `(coords, mouse, client)`.
`onMouseDown`/`onMouseUp` fire for the primary (left) mouse button only
(right → `onRightClick`, middle → browser) and for touch start/end:

| Argument | Space       | `raw`                                     | `snapped`                                    |
| :------- | :---------- | :---------------------------------------- | :------------------------------------------- |
| `coords` | World       | Exact world coordinate under the pointer. | Floored world grid cell (integer).           |
| `mouse`  | Canvas px   | Canvas-relative pixel position.           | Pixel position of the snapped cell's center. |
| `client` | Viewport px | Browser viewport pixel position.          | Viewport pixel of the snapped cell's center. |

Usage rule of thumb: `coords.snapped` for game/grid logic, `mouse.raw` for
custom canvas drawing, `client.raw` for positioning DOM popovers/tooltips.

```ts
engine.onClick = (coords, mouse, client) => {
    placeUnit(coords.snapped.x, coords.snapped.y);
    showTooltipAt(client.raw.x, client.raw.y);
};
```

Touch behavior: taps fire `onClick`; touch drags pan (when `drag` enabled);
pinch zooms (when `zoom` enabled). A drag suppresses the click that would
otherwise fire on release.

## Camera callbacks

```ts
engine.onCoordsChange = (center: Coords) => {};
// Fires on ANY camera movement: drag, wheel/pinch, updateCoords, goCoords,
// setBounds clamping, resize re-centering. The primary hook for syncing
// minimaps, URL state, or coordinate readouts.

engine.onZoom = (scale: number) => {};
// Fires on ANY scale change: wheel, pinch, setScale, goScale, zoomIn, zoomOut,
// and preserve-viewport responsive resizes (the resize changes the scale).

engine.onWheel = (coords, mouse, client, wheel) => {};
// Fires for wheel (desktop) and pinch (touch) zoom gestures — requires
// eventHandlers.zoom, and fires even when the scale is clamped at a limit.
// coords/mouse/client are the standard payload (pinch: the pinch midpoint);
// wheel = { deltaY, direction: "in" | "out", source: "wheel" | "pinch" }
// (deltaY < 0 = zoom in; for pinch it is the factor-equivalent wheel delta).

engine.onResize = () => {};
// Fires after manual resize() or an observed wrapper resize.
```

## Runtime mode switching

`setEventHandlers` takes a partial - only the passed flags change:

```ts
function enablePaintMode() {
    engine.setEventHandlers({ drag: false, hover: true });
    engine.canvas.style.cursor = "crosshair"; // DOM renderers only
}
function enablePanMode() {
    engine.setEventHandlers({ drag: true, hover: false });
    engine.canvas.style.cursor = "grab";
}
function enableReadOnlyMode() {
    engine.setEventHandlers({
        click: false,
        rightClick: false,
        hover: false,
        drag: false,
        zoom: false,
    });
}
```

CRITICAL for paint/marquee tools: disable `drag` while the tool is active,
otherwise pointer movement pans the camera AND paints simultaneously.

## Pattern: item click / hover via hitTest

For "which item did the user click/hover?" use the built-in hit testing -
do NOT build coordinate lookup maps or hand-roll box math (the 0.5 cell
offset is easy to get wrong):

Attach app data to items with the `data` field (never read by the engine)
and read it back from the hit - do not rely on `hit.index`, which goes stale
when a filtered/re-ordered array is re-drawn:

```ts
engine.drawCircle(stations.map((s) => ({ x: s.x, y: s.y, size: 1, data: s })), 2);
engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<Station>(coords.raw); // raw, not snapped
    if (hit?.item.data) select(hit.item.data); // typed as Station
};
```

Small markers hard to click? Expand the hit area with `padding` (world
units) or `paddingPx` (screen pixels, zoom-independent) instead of drawing
invisible oversized halo items:

```ts
const hit = engine.hitTestFirst(coords.raw, { padding: 0.6 });
```

React / React Native: the hook handle exposes the same methods (empty
result before mount, no null checks needed), and items drawn by the
declarative components are included automatically:

```tsx
const engine = useCanvasTileEngine();

<CanvasTileEngine
    engine={engine}
    onClick={(coords) => {
        const hit = engine.hitTestFirst<Station>(coords.raw);
        setSelected(hit?.item.data ?? null); // data attached to items below
    }}
    /* ... */
>
    {/* stationDots items carry data: station */}
    <CanvasTileEngine.Circle items={stationDots} layer={2} />
</CanvasTileEngine>;
```

Full semantics: [core-api.md](core-api.md) hit testing section (kinds
covered, ordering, staleness rule).

## Pattern: cursor management

The engine never sets `canvas.style.cursor` - the app owns cursor policy
entirely (there is no cursor config). Reset in BOTH `onMouseUp` and
`onMouseLeave`: releasing the button outside the canvas never fires
`onMouseUp`, so without the leave reset the cursor sticks on "grabbing".

```ts
engine.canvas.style.cursor = "grab"; // idle
engine.onMouseDown = () => {
    engine.canvas.style.cursor = "grabbing";
};
engine.onMouseUp = () => {
    engine.canvas.style.cursor = "grab";
};
engine.onMouseLeave = () => {
    engine.canvas.style.cursor = "grab";
};
// Optional item feedback; onHover never fires mid-drag, so no conflict:
engine.onHover = (c) => {
    engine.canvas.style.cursor = items.has(`${c.snapped.x},${c.snapped.y}`)
        ? "pointer"
        : "grab";
};
```

## Pattern: hover highlight

Replace one retained handle instead of accumulating draw calls:

```ts
import type { DrawHandle } from "@canvas-tile-engine/core";
let hoverHandle: DrawHandle | undefined;

engine.onHover = (coords) => {
    if (hoverHandle) engine.removeDrawHandle(hoverHandle);
    hoverHandle = engine.drawRect(
        {
            x: coords.snapped.x,
            y: coords.snapped.y,
            size: 1,
            style: { fillStyle: "rgba(56, 189, 248, 0.25)" },
        },
        10,
    ); // high layer -> on top
    engine.render();
};

engine.onMouseLeave = () => {
    if (hoverHandle) {
        engine.removeDrawHandle(hoverHandle);
        hoverHandle = undefined;
        engine.render();
    }
};
```

## Pattern: click-drag painting

```ts
let painting = false;
const painted = new Set<string>();
let paintHandle: DrawHandle | undefined;

function redrawPaintLayer() {
    if (paintHandle) engine.removeDrawHandle(paintHandle);
    const rects = Array.from(painted).map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y, size: 1, style: { fillStyle: "#38bdf8" } };
    });
    paintHandle = engine.drawRect(rects, 2);
    engine.render();
}

engine.onMouseDown = (coords) => {
    painting = true;
    painted.add(`${coords.snapped.x},${coords.snapped.y}`);
    redrawPaintLayer();
};
engine.onHover = (coords) => {
    if (!painting) return;
    const key = `${coords.snapped.x},${coords.snapped.y}`;
    if (!painted.has(key)) {
        painted.add(key);
        redrawPaintLayer();
    }
};
engine.onMouseUp = () => {
    painting = false;
};
engine.onMouseLeave = () => {
    painting = false;
};
```

Requires `eventHandlers: { hover: true, drag: false, ... }` while painting.

## Pattern: drag-to-select (marquee)

```ts
let selecting = false;
let start = { x: 0, y: 0 };

engine.onMouseDown = (coords) => {
    selecting = true;
    start = coords.snapped;
};
engine.onMouseUp = (coords) => {
    if (!selecting) return;
    selecting = false;
    const minX = Math.min(start.x, coords.snapped.x);
    const maxX = Math.max(start.x, coords.snapped.x);
    const minY = Math.min(start.y, coords.snapped.y);
    const maxY = Math.max(start.y, coords.snapped.y);
    selectRegion({ minX, maxX, minY, maxY });
};
```

## Pattern: keyboard-driven mode switching (vanilla)

```ts
window.addEventListener("keydown", (e) => {
    if (e.key === "Shift") {
        engine.setEventHandlers({ drag: false, hover: true });
    }
    if (e.code === "Space") {
        engine.setEventHandlers({ drag: true, hover: false });
    }
});
window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") {
        engine.setEventHandlers({ drag: true, hover: false });
    }
});
```

The engine binds no keyboard events itself - wire `keydown`/`keyup` yourself
and translate them into camera calls (`goCoords`, `zoomIn`, ...) or
`setEventHandlers` mode flips.

## Best practices

- Enable only the events the UI needs; each enabled path costs listeners and
  per-move math.
- Keep transient visuals (hover, selection) on their own high layer or a
  single replaced `DrawHandle`.
- Clear tool state in `onMouseLeave` - pointers leave mid-gesture.
- `onCoordsChange` + `onZoom` + `onResize` are the sync points for external
  UI (minimaps, readouts, URL params).
- Platform notes: `rightClick` and cursor styling are DOM-only; React Native has
  taps, drags, and pinch but no hover or right-click (see
  [react-native.md](react-native.md)).
