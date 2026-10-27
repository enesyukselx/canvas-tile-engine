# Events and Interaction Reference

All interaction is opt-in via `config.eventHandlers` (every flag defaults to
`false`) and can be changed at runtime with `engine.setEventHandlers()`.
Disabled flags leave platform defaults intact: with `zoom` off the wheel
scrolls the page, with `rightClick` off the context menu opens, and with
`click`/`drag`/`zoom`/`hover` all off touch gestures scroll the page. On
React Native the wrapper claims the gesture responder only while an
interaction is enabled (or `onMouseDown`/`onMouseUp` is set), so parent
scroll views keep working.

Contents:

- [Flags and the callbacks they gate](#flags-and-the-callbacks-they-gate)
- [Pointer callback payload](#pointer-callback-payload)
- [Camera callbacks](#camera-callbacks)
- [Keyboard camera control](#keyboard-camera-control)
- [Runtime mode switching](#runtime-mode-switching)
- Patterns: [hitTest](#pattern-item-click--hover-via-hittest),
  [cursor](#pattern-cursor-management), [hover](#pattern-hover-highlight),
  [painting](#pattern-click-drag-painting),
  [marquee](#pattern-drag-to-select-marquee),
  [mode keys](#pattern-keyboard-driven-mode-switching-vanilla)
- [Best practices](#best-practices)

## Flags and the callbacks they gate

| Flag | Enables | Gates |
| :-- | :-- | :-- |
| `click` | tap / click | `onClick`. Skipped after a press that panned; with `drag: false` it also fires after press-move-release. |
| `rightClick` | DOM context menu capture (the browser menu is prevented only while on) | `onRightClick` |
| `hover` | move reporting | `onHover`. Mouse: not while drag-panning. Touch (incl. RN): every one-finger move, also while panning. |
| `drag` | drag / one-finger pan | nothing: `drag: false` keeps down/up firing and only skips panning |
| `zoom` | wheel + pinch; `true`/`"pointer"` anchors at the cursor or pinch midpoint, `"center"` at the viewport center | `onWheel`, and `onZoom` from gestures (programmatic zooms fire `onZoom` regardless) |
| `resize` | wrapper observation while `responsive` is `false` | `onResize` for observed sizes |
| `keyboard` (core >= 0.12) | keyboard camera control, see [below](#keyboard-camera-control) | keyboard `onClick` |
| no flag | - | `onMouseDown`, `onMouseUp`, `onMouseLeave`, `onCoordsChange`, `onDraw`, programmatic `onZoom`, `onResize` from `resize()` / responsive modes |

`onMouseDown`/`onMouseUp` fire for the primary mouse button and touch
start/end only (right -> `onRightClick`, middle -> browser).

## Pointer callback payload

`onClick`, `onRightClick`, `onHover`, `onMouseDown`, `onMouseUp`,
`onMouseLeave` (and `onWheel`) receive `(coords, mouse, client)`:

| Argument | `raw` | `snapped` |
| :-- | :-- | :-- |
| `coords` | World point in RAW (corner) space: cell k spans `[k, k+1]`. | `Math.floor(raw)`: the cell's integer, i.e. the item `x`/`y` of that cell. |
| `mouse` | Canvas-relative CSS px. | Canvas px of the snapped cell's CENTER. |
| `client` | `clientX`/`clientY` (viewport px). | `mouse.snapped` + the canvas rect offset. |

Why raw and item space differ by half a cell:
[core-api.md](core-api.md#coordinate-spaces). Rule of thumb: `coords.raw`
into `hitTest*`, `coords.snapped` for grid logic and `goCenter`, `mouse.raw`
for custom canvas drawing, `client.raw` for DOM popovers/tooltips.

`onClick` gets a 4th argument `info?: ClickInfo` (core >= 0.12):
`info.source` is `"pointer"`, or `"keyboard"` for Enter/Space, where the
coordinates describe the viewport center (skip pointer-only UI then).

```ts
engine.onClick = (coords, mouse, client, info) => {
    placeUnit(coords.snapped.x, coords.snapped.y);
    if (info?.source !== "keyboard") showTooltipAt(client.raw.x, client.raw.y);
};
```

Touch: a drag or pinch suppresses the click on release. A moving pinch
midpoint keeps its world point underneath in pointer zoom mode (unless
`bounds` constrain it); center mode ignores it. Browser drags track the
mouse outside the canvas: `onMouseLeave` fires but does not stop the drag,
and `onMouseUp` still fires once on release (possibly outside the canvas).
`touchcancel`, window blur, a lost button and teardown cancel the gesture
without a click, release an active press once via `onMouseUp` and clear
drag/pinch state. Only touches that started on the canvas count.

## Camera callbacks

| Callback | Fires on | Does NOT fire on |
| :-- | :-- | :-- |
| `onCoordsChange(center)` (item space) | Every camera notification: drag pan, wheel/pinch, keyboard pan and zoom, `setCenter`, `goCenter` (each frame), `setScale`/`goScale`/`zoomIn`/`zoomOut`, `setScaleLimits`, `setBounds`, `fitBounds`. Also zoom-only and no-op calls: it means "camera touched", not "center moved". | Any resize (responsive, `eventHandlers.resize`, `resize()`, RN layout) or pixel-ratio change - the center is kept, but the visible area changes, so minimaps and readouts also need `onResize`. |
| `onZoom(scale)` | The scale actually changed: wheel, pinch, keyboard `+`/`-`, `setScale`, `goScale` (each frame), `zoomIn`/`zoomOut`, `fitBounds`, `setScaleLimits` clamping, `"preserve-viewport"` resizes. | A gesture clamped at a limit, unchanged values. |
| `onWheel(coords, mouse, client, wheel)` | A wheel or pinch gesture (needs `zoom`), even when clamped at a limit. `wheel = { deltaY, direction: "in" \| "out", source: "wheel" \| "pinch" }`; `deltaY < 0` = zoom in; pinch reports the midpoint and a factor-equivalent delta. | Keyboard and programmatic zooms. |
| `onResize()` | `resize()` completion, an observed wrapper resize (`eventHandlers.resize` or a responsive mode), a pixel-ratio change, RN layout. | Camera moves. |

Timing of `onZoom`/`onCoordsChange`/`onComplete` per programmatic call
(instant vs animated, interruption):
[core-api.md](core-api.md#animation-and-interruption).

## Keyboard camera control

(core >= 0.12.) DOM renderers only (RN's `View` has no key events, the
server has no input). The handler sits on the WRAPPER and acts only on keys
pressed while the wrapper ITSELF has focus, so inputs and buttons you place
inside the wrapper keep all their keys. The wrapper is a tab stop when
`accessibility.focusable` is true (derived by default - see
[core-api.md](core-api.md#accessibility-and-reduced-motion)); a click on the
canvas focuses it too.

| Key | Action | Gate while `keyboard` is unset |
| :-- | :-- | :-- |
| Arrow keys | pan by `panPx` (default 80 screen px) or `pan` world units (`panPx` wins) | `drag` |
| `+` / `=` | zoom in by `zoomFactor` (default 1.5) around the viewport center | `zoom` |
| `-` / `_` | zoom out by `zoomFactor` | `zoom` |
| `Enter` / `Space` | `onClick` at the viewport center, `info.source === "keyboard"` | `click` (and `onClick` assigned) |

- `keyboard` unset (default) mirrors the pointer gates above; the object
  form `{ pan?, panPx?, zoomFactor? }` sets step sizes and still mirrors;
  `true` forces every key on; `false` turns them all off.
- Never captured: `Tab`, `Escape`, `Home`, `End`, `PageUp`/`PageDown` and
  any Ctrl/Meta/Alt chord; Shift only on the zoom keys. Only consumed keys
  are `preventDefault`ed.
- Keyboard pan/zoom fire `onCoordsChange` and (when the scale moves)
  `onZoom`, never `onWheel`.

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
    engine.setEventHandlers({ click: false, rightClick: false, hover: false, drag: false, zoom: false });
}
```

CRITICAL for paint/marquee tools: disable `drag` while the tool is active,
otherwise pointer movement pans the camera AND paints simultaneously.
Toggling flags also moves the derived tab stop (`accessibility.focusable`).

## Pattern: item click / hover via hitTest

For "which item did the user click/hover?" use the built-in hit testing,
NOT coordinate lookup maps or hand-rolled box math (the half-cell offset is
easy to get wrong). Attach app data via the item `data` field and read it
back from the hit (not `hit.index`, which goes stale after a re-draw):

```ts
import type { Circle } from "@canvas-tile-engine/core";

type Station = { id: string; name: string; x: number; y: number };
const dots = stations.map((s: Station): Circle<Station> => ({ x: s.x, y: s.y, size: 1, data: s }));
engine.drawCircle(dots, 2);
engine.onClick = (coords) => {
    // raw, not snapped; padding widens small markers (world units)
    const hit = engine.hitTestFirst<Station>(coords.raw, { padding: 0.6 });
    if (hit?.item.data) select(hit.item.data); // typed as Station
};
```

`paddingPx` is the zoom-independent alternative to `padding`. React / React
Native: the hook handle has the same methods (empty result before mount)
and its hits include items drawn by the declarative components. Full
semantics (kinds, ordering, what never hits):
[core-api.md](core-api.md#hit-testing).

## Pattern: cursor management

The engine never sets `canvas.style.cursor` - the app owns cursor policy
entirely. On the browser renderers `onMouseUp` fires once per press even
when the button is released outside the canvas, so resetting there is
enough; also reset in `onMouseLeave` when hover picks the cursor.

```ts
const idle = () => {
    engine.canvas.style.cursor = "grab";
};
idle();
engine.onMouseDown = () => {
    engine.canvas.style.cursor = "grabbing";
};
engine.onMouseUp = idle;
engine.onMouseLeave = idle;
// Optional item feedback; mouse onHover never fires mid-drag:
engine.onHover = (c) => {
    engine.canvas.style.cursor = engine.hitTestFirst(c.raw) ? "pointer" : "grab";
};
```

## Pattern: hover highlight

A registration id replaces the previous draw call instead of accumulating
(core >= 0.10). Re-register only when the hovered cell changes:

```ts
let hovered = "";
engine.onHover = (coords) => {
    const key = `${coords.snapped.x},${coords.snapped.y}`;
    if (key === hovered) return;
    hovered = key;
    const { x, y } = coords.snapped;
    const fill = { fillStyle: "rgba(56, 189, 248, 0.25)" };
    // high layer -> on top; same id replaces the previous highlight
    engine.drawRect({ x, y, size: 1, style: fill }, 10, { id: "hover", hitTest: false });
    engine.render();
};

engine.onMouseLeave = () => {
    hovered = "";
    engine.drawRect([], 10, { id: "hover" }); // replace with nothing
    engine.render();
};
```

To tint existing items instead, use `styleOf` reading the hovered id
([drawing.md](drawing.md#styleof-visibleof-interactiveof)).

`onHover` does not fire during wheel zoom or drag-panning, so a tooltip
anchored to the pointer goes stale while the map moves under it: hide it in
`onCoordsChange` (and `onMouseLeave`) and let the next `onHover` show it
again.

## Pattern: click-drag painting

Register the cells ONCE; painting only mutates a map and calls `render()`
(`visibleOf`/`styleOf` read it live, nothing re-registers):

```ts
import type { Coords, Rect } from "@canvas-tile-engine/core";

const W = 64;
const H = 64;
const painted = new Map<string, string>(); // "x,y" -> color
const cells: Rect[] = [];
for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) cells.push({ x, y, size: 1 });
}
engine.drawRect(cells, 2, {
    hitTest: false,
    visibleOf: (c) => painted.has(`${c.x},${c.y}`),
    styleOf: (c) => ({ fillStyle: painted.get(`${c.x},${c.y}`) }),
});

let painting = false;
let color = "#38bdf8";
function paintAt(c: { snapped: Coords }) {
    const { x, y } = c.snapped;
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    if (painted.get(`${x},${y}`) === color) return;
    painted.set(`${x},${y}`, color);
    engine.render();
}

engine.setEventHandlers({ drag: false, hover: true }); // paint mode
engine.onMouseDown = (coords) => {
    painting = true;
    paintAt(coords);
};
engine.onHover = (coords) => {
    if (painting) paintAt(coords);
};
const stop = () => {
    painting = false;
};
engine.onMouseUp = stop;
engine.onMouseLeave = stop;
// Back to pan mode: engine.setEventHandlers({ drag: true });
```

Works on touch too: a finger move reports `onHover` while `hover` is on.

## Pattern: drag-to-select (marquee)

With `drag: false` while the tool is active, collect the press and release
points in RAW space and ask the engine which items fall inside:

```ts
import type { Coords } from "@canvas-tile-engine/core";

let start: Coords | null = null;

engine.onMouseDown = (coords) => {
    start = coords.raw;
};
engine.onMouseUp = (coords) => {
    if (!start) return;
    const hits = engine.hitTestRect(
        { minX: start.x, minY: start.y, maxX: coords.raw.x, maxY: coords.raw.y },
        { mode: "intersect" }, // or "contain"
    );
    start = null;
    select(hits.map((h) => h.item.data));
};
```

For a cell range instead of items, use `coords.snapped` at both ends and
take `Math.min`/`Math.max` per axis (inclusive cell indices).

## Pattern: keyboard-driven mode switching (vanilla)

The engine's keys cover camera control only. Wire other shortcuts yourself
(`Tab`, `Escape`, `Home`, `End`, `PageUp`/`PageDown` and modifier chords are
never captured, so they stay yours) and translate them into camera calls or
`setEventHandlers` flips:

```ts
// Hold Shift to paint, release to pan
window.addEventListener("keydown", (e) => {
    if (e.key === "Shift") engine.setEventHandlers({ drag: false, hover: true });
});
window.addEventListener("keyup", (e) => {
    if (e.key === "Shift") engine.setEventHandlers({ drag: true, hover: false });
});
```

## Best practices

- Enable only the events the UI needs; each enabled path costs listeners and
  per-move math.
- Keep transient visuals (hover, selection) on their own high layer under a
  registration id, or tint items with `styleOf`.
- Clear tool state in `onMouseLeave` - pointers leave mid-gesture.
- Sync external UI (minimaps, readouts, URL params) from `onCoordsChange` +
  `onZoom` + `onResize`.
- Platform notes: `rightClick`, keyboard and cursor styling are DOM-only.
  React Native has taps, drags, pinch and finger-move `onHover`, but no
  pointer hover or right-click (see [react-native.md](react-native.md)).
