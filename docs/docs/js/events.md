---
sidebar_position: 3
---

# Interactions & Events

The core engine normalizes mouse, touch, wheel, and resize input into world-space callbacks. Events are disabled by default, so enable only the interaction paths your UI needs.

```ts
const config = {
    scale: 48,
    size: { width: 800, height: 500 },
    eventHandlers: {
        click: true,
        rightClick: true,
        hover: true,
        drag: true,
        zoom: "pointer",
        resize: true,
    },
};
```

`zoom: true` is shorthand for `"pointer"`. Use `zoom: "center"` when wheel and pinch gestures should zoom around the viewport center instead of the cursor or pinch midpoint.

## Event Handlers

Assign callbacks directly on the engine instance.

### `onClick`

Triggered when a click or tap completes without a drag.

```ts
engine.onClick = (coords, mouse, client) => {
    console.log("Clicked cell:", coords.snapped);
    console.log("Exact world position:", coords.raw);
    console.log("Canvas pixel:", mouse.raw);
    console.log("Viewport pixel:", client.raw);
};
```

### `onRightClick`

Triggered by DOM context menu/right-click input when `eventHandlers.rightClick` is enabled. The renderer prevents the browser context menu before forwarding the callback.

```ts
engine.onRightClick = (coords, mouse, client) => {
    openContextMenu({
        tile: coords.snapped,
        screen: client.raw,
    });
};
```

### `onHover`

Triggered when the pointer moves over the canvas while not dragging, if `eventHandlers.hover` is enabled.

```ts
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
    );

    engine.render();
};
```

For high-frequency hover work, prefer replacing one previous `DrawHandle` or clearing a dedicated layer over accumulating draw calls.

### `onMouseDown` And `onMouseUp`

Useful for painting, selection, drag handles, and other tool modes. On
browsers these fire for the **primary (left) button only** — right clicks go
through `onRightClick`, and the middle button is left to the browser. Touch
input also feeds them (touch start/end).

```ts
let selecting = false;
let selectionStart = { x: 0, y: 0 };

engine.onMouseDown = (coords) => {
    selecting = true;
    selectionStart = coords.snapped;
};

engine.onMouseUp = (coords) => {
    if (!selecting) return;
    selecting = false;
    selectRect(selectionStart, coords.snapped);
};
```

### `onMouseLeave`

Triggered when the pointer leaves the canvas. Use it to clear transient UI state.

```ts
engine.onMouseLeave = () => {
    selecting = false;
    if (hoverHandle) {
        engine.removeDrawHandle(hoverHandle);
        hoverHandle = undefined;
        engine.render();
    }
};
```

## Camera Callbacks

### `onCoordsChange`

Fires after camera movement: drag, wheel/pinch zoom, `setCenter`, `goCenter`, `setBounds` clamping, or resize-centered updates.

```ts
engine.onCoordsChange = (center) => {
    updateMiniMap(center);
    updateCoordinateReadout(center);
};
```

### `onZoom`

Fires when the scale changes through wheel, pinch, `setScale`, `goScale`, `zoomIn`, `zoomOut`, or `setScaleLimits` clamping the current scale into a new range.

```ts
engine.onZoom = (scale) => {
    zoomLabel.textContent = `${Math.round(scale)} px / cell`;
};
```

### `onWheel`

Fires for wheel (desktop) and pinch (touch) zoom gestures. Requires `eventHandlers.zoom`. Unlike `onZoom`, which reports the resulting scale (including programmatic changes), `onWheel` reports the input gesture itself with its position — and it still fires when the scale is clamped at a limit.

The first three arguments are the standard coordinate payload (for pinch they describe the pinch midpoint). The fourth describes the gesture:

| Property    | Type                   | Description                                                                                              |
| :---------- | :--------------------- | :------------------------------------------------------------------------------------------------------- |
| `deltaY`    | `number`               | Vertical wheel delta (negative = zoom in). For pinch: the wheel delta that would produce the same factor. |
| `direction` | `"in" \| "out"`        | Zoom direction implied by the gesture.                                                                    |
| `source`    | `"wheel" \| "pinch"`   | Input source.                                                                                             |

```ts
engine.onWheel = (coords, mouse, client, wheel) => {
    console.log(`${wheel.source} zoom ${wheel.direction} at`, coords.snapped);
};
```

### `onResize`

Fires after manual resize or observed wrapper resize.

```ts
engine.onResize = () => {
    console.log("New size:", engine.getSize());
};
```

:::warning Responsive Mode
`engine.resize()` and `eventHandlers.resize` are ignored when `config.responsive` is enabled. Responsive mode is controlled by the wrapper element.
:::

## Coordinate Payload

Pointer callbacks receive three coordinate objects.

| Argument | `raw`                                     | `snapped`                                                     |
| :------- | :---------------------------------------- | :------------------------------------------------------------ |
| `coords` | Exact world coordinate under the pointer. | Floored world grid cell.                                      |
| `mouse`  | Canvas-relative pixel coordinate.         | Canvas pixel coordinate for the center of the snapped cell.   |
| `client` | Browser viewport pixel coordinate.        | Viewport pixel coordinate for the center of the snapped cell. |

```ts
engine.onClick = (coords, mouse, client) => {
    // World tile for game/map logic
    const tile = coords.snapped;

    // Canvas-local pixel position for custom drawing
    const local = mouse.raw;

    // Viewport pixel position for DOM popovers/tooltips
    const screen = client.raw;
};
```

## Runtime Event Modes

Use `setEventHandlers()` to change interaction behavior without recreating the engine.

```ts
function enablePaintMode() {
    engine.setEventHandlers({ drag: false, hover: true });
    engine.canvas.style.cursor = "crosshair";
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

### Painting Tool Example

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
    if (painted.has(key)) return;

    painted.add(key);
    redrawPaintLayer();
};

engine.onMouseUp = () => {
    painting = false;
};

engine.onMouseLeave = () => {
    painting = false;
};
```

:::tip Drag And Paint
If `eventHandlers.drag` stays enabled while painting, pointer movement will pan the camera and paint at the same time. Disable drag in paint mode with `engine.setEventHandlers({ drag: false, hover: true })`.
:::

### Keyboard Mode Switching

```ts
let mode: "pan" | "paint" = "pan";

window.addEventListener("keydown", (event) => {
    if (event.key === "Shift" && mode !== "paint") {
        mode = "paint";
        engine.setEventHandlers({ drag: false, hover: true });
        engine.canvas.style.cursor = "crosshair";
    }

    if (event.code === "Space") {
        engine.setEventHandlers({ drag: true, hover: false });
        engine.canvas.style.cursor = "grab";
    }
});

window.addEventListener("keyup", (event) => {
    if (event.key === "Shift" && mode === "paint") {
        mode = "pan";
        engine.setEventHandlers({ drag: true, hover: false });
        engine.canvas.style.cursor = "default";
    }
});
```

## Hit Testing

`hitTest` / `hitTestFirst` answer "which item is under this point?" for rect,
circle, and image items - no more hand-written lookup maps or manual 0.5-cell
offset math. Pass the `coords.raw` value from any event callback; origin
anchoring, image aspect fit, and rotation are handled internally.

```ts
type Station = { id: string; name: string };

// Attach your own data to items when drawing:
engine.drawRect(
    stations.map((s) => ({ x: s.x, y: s.y, size: 1, data: s })),
    2,
);

engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<Station>(coords.raw);
    if (!hit?.item.data) return;
    openStationPanel(hit.item.data); // typed as Station
};

// All overlapping items, highest visual priority first
engine.onHover = (coords) => {
    const hits = engine.hitTest(coords.raw, { layer: 2 }); // optional layer filter
    highlight(hits.map((h) => h.item));
};
```

Each result is `{ item, kind, layer, handle, index }`, ordered by visual
priority: higher layer first, then later registration, then later item within
a draw call - the item you see on top comes first.

Semantics to know:

- Works for `drawRect` / `drawCircle` / `drawImage` and their `drawStatic*`
  variants. Line, Path, and Text items are not hit-testable.
- Every drawable item accepts an optional `data` field. The engine never
  reads it - it is carried through to `hit.item.data` so you can identify
  what was hit. The `TData` type parameter on `hitTest<TData>` /
  `hitTestFirst<TData>` types that field for you; it is an assertion, not a
  runtime check.
- `hit.item` is the exact object you passed to the draw call (same
  reference), and `hit.index` is its position in that array at draw time.
  Prefer `data` for identity - indexes go stale when you re-draw a filtered
  or re-ordered array.
- Like rendering, results reflect item positions as of the draw call:
  mutating an item's position requires re-registration (style mutation is
  unaffected).
- Draw calls with 500+ items are queried through a spatial index, so
  hit testing large scenes on hover is cheap.

### Generous touch targets: `padding` and `paddingPx`

By default the hit area is exactly the drawn geometry, which makes small
markers hard to click. Both options expand every item's hit geometry outward:

| Option      | Unit          | Behavior                                                             |
| :---------- | :------------ | :------------------------------------------------------------------- |
| `padding`   | world units   | Fixed world-space margin; grows/shrinks on screen with zoom.         |
| `paddingPx` | screen pixels | Zoom-independent margin, converted with the current scale per query. |

They can be combined (added together). Negative values are treated as 0.

```ts
// A dot drawn with size 0.95 (radius ~0.475), clickable up to 1.1 units out
const hit = engine.hitTestFirst(coords.raw, { padding: 0.625 });

// Finger-sized target at any zoom level
const hit2 = engine.hitTestFirst(coords.raw, { paddingPx: 12 });
```

## Managing the Cursor

The engine never touches `canvas.style.cursor` - cursor styling is fully owned
by your application, so pick the policy that fits your scenario. The typical
map pattern:

```ts
const canvas = engine.canvas; // DOM renderers only

canvas.style.cursor = "grab"; // idle

engine.onMouseDown = () => {
    canvas.style.cursor = "grabbing";
};

engine.onMouseUp = () => {
    canvas.style.cursor = "grab";
};

engine.onMouseLeave = () => {
    // Releasing the button outside the canvas never fires onMouseUp,
    // so reset here too or the cursor sticks on "grabbing".
    canvas.style.cursor = "grab";
};

// Optional: pointer feedback over interactive items.
// onHover does not fire while dragging, so it never fights "grabbing".
engine.onHover = (coords) => {
    const key = `${coords.snapped.x},${coords.snapped.y}`;
    canvas.style.cursor = itemsByCoord.has(key) ? "pointer" : "grab";
};
```

Always pair the `onMouseDown` override with resets in **both** `onMouseUp` and
`onMouseLeave`.

## Camera API Used With Events

Events often drive camera or viewport updates.

```ts
engine.setCenter({ x: 10, y: 10 });
engine.goCenter(0, 0, 500);
engine.setScale(64);
engine.goScale(64, 500);
engine.zoomIn();
engine.zoomOut();
engine.resize(1024, 768, 300);
engine.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
```

`resize(width, height, durationMs?, onComplete?)` is disabled when `config.responsive` is enabled.

## Best Practices

- Enable only the events you need.
- Use a dedicated layer or retained `DrawHandle` for transient hover/selection visuals.
- Disable `drag` while implementing paint or marquee-selection tools.
- Use `client.raw` for DOM popovers and `coords.snapped` for grid logic.
- Clear temporary state in `onMouseLeave`.
- Use `onCoordsChange`, `onZoom`, and `onResize` to synchronize minimaps and UI readouts.
