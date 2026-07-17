---
sidebar_position: 3
---

# Interactions & Events

React events are passed as props to `<CanvasTileEngine>`. The interaction flags still live in `config.eventHandlers`.

```tsx
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

`zoom: true` is shorthand for `"pointer"`. Use `"center"` for center-anchored wheel and pinch zoom.

## Pointer Props

### `onClick`

```tsx
<CanvasTileEngine
    engine={engine}
    renderer={new RendererCanvas()}
    config={config}
    onClick={(coords, mouse, client) => {
        console.log("Clicked cell:", coords.snapped);
        console.log("Exact world position:", coords.raw);
    }}
/>
```

### `onRightClick`

```tsx
<CanvasTileEngine
    engine={engine}
    renderer={new RendererCanvas()}
    config={config}
    onRightClick={(coords, mouse, client) => {
        setContextMenu({ tile: coords.snapped, screen: client.raw });
    }}
/>
```

### `onHover`

```tsx
function MapWithHover() {
    const engine = useCanvasTileEngine();
    const [hovered, setHovered] = useState<Coords | null>(null);

    const hoverRect = useMemo(
        () =>
            hovered && {
                x: hovered.x,
                y: hovered.y,
                size: 1,
                style: { fillStyle: "rgba(56,189,248,0.25)" },
            },
        [hovered],
    );

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            config={{
                ...config,
                eventHandlers: { ...config.eventHandlers, hover: true },
            }}
            onHover={(coords) => setHovered(coords.snapped)}
            onMouseLeave={() => setHovered(null)}
        >
            <CanvasTileEngine.GridLines cellSize={1} />
            {hoverRect && <CanvasTileEngine.Rect items={hoverRect} layer={3} />}
        </CanvasTileEngine>
    );
}
```

### `onMouseDown`, `onMouseUp`, And `onMouseLeave`

On browsers, `onMouseDown`/`onMouseUp` fire for the **primary (left) button
only** — right clicks go through `onRightClick`, and the middle button is
left to the browser. Touch input also feeds them.

```tsx
function SelectionMap() {
    const engine = useCanvasTileEngine();
    const [start, setStart] = useState<Coords | null>(null);
    const [end, setEnd] = useState<Coords | null>(null);

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            config={config}
            onMouseDown={(coords) => {
                setStart(coords.snapped);
                setEnd(coords.snapped);
            }}
            onHover={(coords) => {
                if (start) setEnd(coords.snapped);
            }}
            onMouseUp={(coords) => {
                setEnd(coords.snapped);
                commitSelection(start, coords.snapped);
                setStart(null);
            }}
            onMouseLeave={() => setStart(null)}
        >
            <CanvasTileEngine.GridLines cellSize={1} />
        </CanvasTileEngine>
    );
}
```

## Callback Payload

Pointer props share the same callback shape.

| Argument | `raw`                                     | `snapped`                                                     |
| :------- | :---------------------------------------- | :------------------------------------------------------------ |
| `coords` | Exact world coordinate under the pointer. | Floored world grid cell.                                      |
| `mouse`  | Canvas-relative pixel coordinate.         | Canvas pixel coordinate for the center of the snapped cell.   |
| `client` | Browser viewport pixel coordinate.        | Viewport pixel coordinate for the center of the snapped cell. |

Use `coords.snapped` for map logic and `client.raw` for DOM popovers.

## Camera Props

```tsx
<CanvasTileEngine
    engine={engine}
    renderer={new RendererCanvas()}
    config={config}
    onCoordsChange={setCenter}
    onZoom={setScale}
    onWheel={(coords, mouse, client, wheel) => console.log(wheel.source, wheel.direction)}
    onResize={() => console.log(engine.getSize())}
/>
```

| Prop             | Description                                                                                 |
| :--------------- | :------------------------------------------------------------------------------------------ |
| `onCoordsChange` | Fires after pan, zoom, animated moves, bounds clamping, and resize-centered camera changes. |
| `onZoom`         | Fires after wheel, pinch, `setScale`, `goScale`, `zoomIn`, or `zoomOut` changes the scale.  |
| `onWheel`        | Fires for wheel/pinch zoom gestures with the standard coordinate payload plus `{ deltaY, direction, source }`. Requires `eventHandlers.zoom`. |
| `onResize`       | Fires after manual or observed resize.                                                      |

## Painting Example

For high-frequency interactions, use functional state updates or refs. Keep the rendered item array memoized.

```tsx
function PaintingApp() {
    const engine = useCanvasTileEngine();
    const [painting, setPainting] = useState(false);
    const [painted, setPainted] = useState<Set<string>>(() => new Set());

    const paintRects = useMemo(
        () =>
            Array.from(painted).map((key) => {
                const [x, y] = key.split(",").map(Number);
                return { x, y, size: 1, style: { fillStyle: "#38bdf8" } };
            }),
        [painted],
    );

    const addCell = (coords: Coords) => {
        const key = `${coords.x},${coords.y}`;
        setPainted((prev) => {
            if (prev.has(key)) return prev;
            const next = new Set(prev);
            next.add(key);
            return next;
        });
    };

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            config={{
                ...config,
                eventHandlers: {
                    ...config.eventHandlers,
                    drag: false,
                    hover: true,
                },
            }}
            onMouseDown={(coords) => {
                setPainting(true);
                addCell(coords.snapped);
            }}
            onHover={(coords) => {
                if (painting) addCell(coords.snapped);
            }}
            onMouseUp={() => setPainting(false)}
            onMouseLeave={() => setPainting(false)}
        >
            <CanvasTileEngine.GridLines cellSize={1} />
            <CanvasTileEngine.Rect items={paintRects} layer={2} />
        </CanvasTileEngine>
    );
}
```

## Runtime Event Modes

Use `engine.setEventHandlers()` for tool modes without remounting the component.

```tsx
function ModeControls() {
    const engine = useCanvasTileEngine();
    const [mode, setMode] = useState<"pan" | "paint" | "readonly">("pan");

    const enablePaint = () => {
        setMode("paint");
        engine.setEventHandlers({ drag: false, hover: true });
    };

    const enablePan = () => {
        setMode("pan");
        engine.setEventHandlers({ drag: true, hover: false });
    };

    const enableReadonly = () => {
        setMode("readonly");
        engine.setEventHandlers({
            click: false,
            rightClick: false,
            hover: false,
            drag: false,
            zoom: false,
        });
    };

    return (
        <>
            <button onClick={enablePan}>Pan</button>
            <button onClick={enablePaint}>Paint</button>
            <button onClick={enableReadonly}>Read only</button>

            <CanvasTileEngine
                engine={engine}
                renderer={new RendererCanvas()}
                config={config}
                onHover={(coords) => {
                    if (mode === "paint") console.log(coords.snapped);
                }}
            />
        </>
    );
}
```

## Keyboard Shortcuts

```tsx
useEffect(() => {
    const down = (event: KeyboardEvent) => {
        if (event.key === "Shift") {
            engine.setEventHandlers({ drag: false, hover: true });
        }

        if (event.code === "Space") {
            engine.setEventHandlers({ drag: true, hover: false });
        }
    };

    const up = (event: KeyboardEvent) => {
        if (event.key === "Shift") {
            engine.setEventHandlers({ drag: true, hover: false });
        }
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
        window.removeEventListener("keydown", down);
        window.removeEventListener("keyup", up);
    };
}, [engine]);
```

## Camera API Used With Events

The hook handle exposes the same camera controls as the core engine.

```tsx
engine.updateCoords({ x: 10, y: 10 });
engine.goCoords(0, 0, 500);
engine.setScale(64);
engine.goScale(64, 500);
engine.zoomIn();
engine.zoomOut();
engine.resize(1024, 768, 300);
engine.setBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 });
```

## Hit Testing

`engine.hitTest` / `engine.hitTestFirst` answer "which item is under this
point?" for rect, circle, and image items - including items drawn by the
declarative components, which register through the same engine. Pass
`coords.raw` from any event prop; origin anchoring, image aspect fit, and
rotation are handled internally. Before the engine mounts the methods
return an empty result, so no null checks are needed.

```tsx
type Station = { id: string; name: string };

function StationMap() {
    const engine = useCanvasTileEngine();
    const [selected, setSelected] = useState<Station | null>(null);

    // Attach your own data to each item; the engine carries it through
    const stationDots = useMemo(
        () => stations.map((s) => ({ x: s.x, y: s.y, size: 0.6, data: s })),
        [stations],
    );

    return (
        <CanvasTileEngine
            engine={engine}
            renderer={new RendererCanvas()}
            config={config}
            onClick={(coords) => {
                const hit = engine.hitTestFirst<Station>(coords.raw);
                setSelected(hit?.item.data ?? null); // typed as Station
            }}
        >
            <CanvasTileEngine.Circle items={stationDots} layer={2} />
        </CanvasTileEngine>
    );
}
```

Results are `{ item, kind, layer, handle, index }`, ordered by visual
priority (higher layer, then later registration, then later item). Line,
Path, and Text are not hit-testable, and - like rendering - position
mutations require re-registration to be reflected.

Every drawable item accepts an optional `data` field the engine never reads;
use it to identify hits instead of `hit.index`, which goes stale when you
re-render a filtered or re-ordered items array. The `TData` parameter on
`hitTest<TData>` / `hitTestFirst<TData>` types `hit.item.data` and is an
assertion, not a runtime check.

The hit area is exactly the drawn geometry by default. For generous touch
targets around small markers, expand it with `padding` (world units) or
`paddingPx` (screen pixels, zoom-independent); they can be combined (added
together), and negative values are treated as 0:

```tsx
onClick={(coords) => {
    // Accept clicks up to 0.6 world units around each station dot
    const hit = engine.hitTestFirst<Station>(coords.raw, { padding: 0.6 });
    setSelected(hit?.item.data ?? null);
}}
```

## Managing the Cursor

The engine never touches `canvas.style.cursor` - cursor styling is fully owned
by your application, so pick the policy that fits your scenario. Access the
canvas through `engine.instance.canvas` and reset in **both** `onMouseUp` and
`onMouseLeave` (releasing the button outside the canvas never fires
`onMouseUp`):

```tsx
const engine = useCanvasTileEngine();

const setCursor = (cursor: string) => {
    const canvas = engine.instance?.canvas;
    if (canvas) canvas.style.cursor = cursor;
};

<CanvasTileEngine
    engine={engine}
    config={config}
    renderer={new RendererCanvas()}
    onMouseDown={() => setCursor("grabbing")}
    onMouseUp={() => setCursor("grab")}
    onMouseLeave={() => setCursor("grab")}
    // onHover does not fire while dragging, so it never fights "grabbing"
    onHover={(coords) => {
        const key = `${coords.snapped.x},${coords.snapped.y}`;
        setCursor(itemsByCoord.has(key) ? "pointer" : "grab");
    }}
>
    {/* ... */}
</CanvasTileEngine>;
```

## Best Practices

- Keep `config`, `center`, and `renderer` lifecycle rules in mind: they are read on mount. Use `engine.setEventHandlers()` for runtime event changes.
- Use React state for UI-visible state and refs for very hot transient state.
- Memoize draw item arrays with `useMemo`.
- Disable `drag` while painting or selecting.
- Use `client.raw` for DOM overlays and `coords.snapped` for grid logic.
- Clear active tool state in `onMouseLeave`.
