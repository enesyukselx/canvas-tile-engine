---
sidebar_position: 3.1
---

# Selection and Move Tools

`SelectionController` supplies single selection, modifier selection, rectangle selection, group dragging, and grid snapping. It is a headless tool shared by Canvas2D, WebGL, React, and React Native Skia. Your application keeps its model and paints its own selection feedback.

The controller uses stable item keys from [live item collections](./item_collections.md). It updates the existing draw registration, so moving objects refreshes hit testing and requests a frame without rebuilding your React component tree.

## Connect a Collection

After creating an engine, register an editable collection and attach a controller:

```ts
import {
    ItemCollection,
    SelectionController,
    createItemCollectionSelectionAdapter,
    type Rect,
} from "@canvas-tile-engine/core";

type TileData = { id: string; locked?: boolean; selectable?: boolean };
type Tile = Rect<TileData> & { data: TileData };
const tiles = new ItemCollection<Tile>(
    [
        { data: { id: "a" }, x: 0, y: 0, style: { fillStyle: "#3b82f6" } },
        { data: { id: "b" }, x: 3, y: 0, style: { fillStyle: "#3b82f6" } },
        { data: { id: "fixed", locked: true }, x: 6, y: 0 },
    ],
    { keyOf: (item) => item.data.id },
);

let selection: SelectionController<Tile> | undefined;
const handle = engine.drawRect(tiles, 1, {
    id: "editable-tiles",
    styleOf: (item) =>
        item.data && selection?.selectedIds.includes(item.data.id)
            ? { strokeStyle: "#facc15", lineWidthPx: 3 }
            : undefined,
});

selection = new SelectionController<Tile>(engine, {
    adapter: createItemCollectionSelectionAdapter(tiles, { handle }),
    grid: 1,
    selectable: (item) => item.data.selectable !== false,
    locked: (item) => item.data.locked === true,
    onSelectionChange: (ids) => console.log("Selected", ids),
});

engine.setTool(selection);
engine.render();

// A toolbar can switch between editing and the existing camera gestures.
// engine.setTool(null);       // Pan when eventHandlers.drag is enabled.
// engine.setTool(selection);  // Select and move again.
```

The helper accepts hits only from the supplied `DrawHandle`. The same key in another collection or registration cannot accidentally select this model. If you replace that registration, create a new adapter/controller for its new handle. Removing a draw registration does not dispose an application-owned controller; dispose it in the same cleanup.

Tools opt into pointer/touch input independently from `eventHandlers.click`, `hover`, and `drag`. Enable `eventHandlers.zoom` to retain wheel/pinch zoom, and `drag` if your Pan mode should move the camera. Give the surface an `accessibility.label`. For a tool-only browser surface with every camera/click flag disabled, also set `accessibility.focusable: true` so it can receive Escape.

## Gesture Rules

| Input                    | Result                                                                                                                                            |
| :----------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------ |
| Click one object         | Select it. Clicking an already selected member of a group keeps the group during the press; releasing without dragging selects that member alone. |
| Shift-click              | Add the object.                                                                                                                                   |
| Ctrl-click or Meta-click | Toggle that object in the selection.                                                                                                              |
| Click empty space        | Clear selection, unless a modifier is held.                                                                                                       |
| Drag empty space         | Select objects inside the rectangle. `marqueeMode: "intersect"` is the default; use `"contain"` to require complete containment.                  |
| Shift-marquee            | Add the rectangle's hits to the selection present at press time.                                                                                  |
| Ctrl/Meta-marquee        | Toggle the rectangle's hits against the selection present at press time. Moving back and forth does not repeatedly toggle the same objects.       |
| Drag a selected object   | Translate all selected, unlocked objects by the same world-space delta.                                                                           |
| Escape during a press    | Cancel the preview and restore the preceding selection. The focused browser surface consumes Escape only while an edit is active.                 |
| Second touch             | Cancel the object edit before the existing camera pinch gesture begins.                                                                           |

`dragThresholdPx` defaults to 4 screen pixels. A tool-owned press does not pan the camera, including after the pointer leaves the canvas. Release outside the canvas still commits. A missing release, browser blur, touch cancellation, tool switch, or disposal cancels the preview. Switching tools during a press does not hand its remaining movement to the camera; the next press uses the new tool.

`selectable` and `locked` have different purposes. Unselectable objects are skipped and hit queries can reach objects underneath. Locked objects can be selected and inspected, but do not move. In a mixed selection, unlocked objects move while locked ones stay in place. Existing `visibleOf`, `interactiveOf`, clips, and `hitTest: false` still control which objects produce hits.

## Grid Snapping and Geometry

Use `grid: 1` for a square grid, or `{ x: 2, y: 1, origin: { x: 0, y: 0 } }` for separate positive step sizes. The picked object's original anchor snaps to that grid; every movable object receives the same delta, preserving their relative offsets. Anchors are the authored `x/y` for anchored items, `from` for lines, and the first vertex or non-close command endpoint for paths. Supply `anchor` to the adapter helper to use a different authored anchor.

`translateItem(item, { x, y })` returns a new item. It supports rects, circles, images, text, line endpoints, point paths, and all path commands, including curve control points and arc centers. It preserves styles, data, rotation, sizes, radii, and arc angles. It does not mutate nested geometry from the original item. World-anchored gradients retain their world coordinates.

`selection.translateSelection(delta)` applies one world-space translation to the selected, unlocked items. It uses the same lifecycle hooks as a pointer drag, and does not apply pointer-grid snapping. It can back a toolbar's nudge controls on any platform. Text is still excluded from engine hit testing; an adapter can move text selected programmatically, but this feature does not add glyph hit testing.

## State and Feedback

The controller exposes `selectedIds`, `setSelection(iterable)`, `clearSelection()`, `getSnapshot()`, `subscribe(listener)`, `cancel()`, and `dispose()`. IDs are strings or numbers. Selection updates remove duplicate, missing, or unselectable IDs. Collection deletions prune selected IDs automatically.

`getSnapshot()` returns a stable, readonly snapshot until state changes:

```ts
const { selectedIds, phase, marquee } = selection.getSnapshot();
// phase: "idle" | "pending" | "marquee" | "translate"
// marquee: { minX, minY, maxX, maxY } | null
const unsubscribe = selection.subscribe(() => updateInspector(selection.getSnapshot()));
```

State changes request a frame automatically, including selection-only changes used by `styleOf`. The controller does not add overlay draw calls. The marquee bounds use **raw/corner world coordinates**, directly accepted by `hitTestRect`. `DrawTransform.worldToScreen` accepts item coordinates, so subtract half a cell when painting the marquee:

```ts
const overlay = engine.addDrawFunction((context, _coords, _config, transform) => {
    const box = selection?.getSnapshot().marquee;
    if (!box) return;
    const ctx = context as CanvasRenderingContext2D;
    const a = transform.worldToScreen(box.minX - 0.5, box.minY - 0.5);
    const b = transform.worldToScreen(box.maxX - 0.5, box.maxY - 0.5);
    ctx.save();
    ctx.fillStyle = "rgba(59, 130, 246, 0.15)";
    ctx.strokeStyle = "#60a5fa";
    ctx.lineWidth = 1;
    ctx.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    ctx.restore();
}, 100);
```

For Skia, use the same snapshot and coordinate conversion with Skia's drawing methods. The runnable [selection tools example](../introduction/examples.md) includes a selection inspector, marquee overlay, Pan/Select modes, snapping, locked objects, and unselectable objects.

## React and React Native

Both bindings re-export the controller, adapter helper, translation helper, and public types. Their stable engine handle forwards `setTool`, `getTool`, `subscribeInput`, and `subscribeToolChange`; before mount these methods are no-ops and return `null`/empty unsubscribe functions. Attach effects to the current engine instance so a key remount creates a fresh controller.

This child component can live inside an existing `<CanvasTileEngine>` provider:

```tsx
import { useEffect, useState } from "react";
import {
    ItemCollection,
    SelectionController,
    createItemCollectionSelectionAdapter,
    useEngineContext,
    type Rect,
} from "@canvas-tile-engine/react";

type Tile = Rect<{ id: string }> & { data: { id: string } };

function EditableTiles() {
    const { engine } = useEngineContext();
    const [tiles] = useState(
        () =>
            new ItemCollection<Tile>(
                [
                    { data: { id: "a" }, x: 0, y: 0 },
                    { data: { id: "b" }, x: 3, y: 0 },
                ],
                { keyOf: (item) => item.data.id },
            ),
    );

    useEffect(() => {
        const instance = engine.instance;
        if (!instance) return;
        let tool: SelectionController<Tile>;
        const handle = instance.drawRect(tiles, 1, {
            id: "editable-tiles",
            styleOf: (item) =>
                item.data && tool?.selectedIds.includes(item.data.id)
                    ? { strokeStyle: "#facc15", lineWidthPx: 3 }
                    : undefined,
        });
        tool = new SelectionController<Tile>(instance, {
            adapter: createItemCollectionSelectionAdapter(tiles, { handle }),
            grid: 1,
        });
        instance.setTool(tool);
        instance.requestRender();
        return () => {
            tool.dispose();
            instance.removeDrawHandle(handle);
            instance.requestRender();
        };
    }, [engine, engine.instance, tiles]);

    return null;
}
```

For React Native, change the import to `@canvas-tile-engine/react-native`; keep the existing Skia renderer and `GestureHandlerRootView` setup. The native transport reports view-relative coordinates, contact identity, and `pointerType: "touch"`. Native touches have no keyboard modifier flags. Use `setSelection`, a toolbar, or a custom tool for additive mobile workflows. An active tool claims touches against enclosing scroll views even when all camera flags are disabled; detaching it releases that claim for subsequent gestures. Hardware keyboard input is not synthesized by the native binding.

For React UI that tracks a controller, `useSyncExternalStore(tool.subscribe, tool.getSnapshot, tool.getSnapshot)` can subscribe to its stable snapshots. Collection-driven canvas edits do not require a parent React render.

## Input Subscriptions and Custom Tools

`engine.subscribeInput((event, handled) => ...)` adds an observer without replacing `onClick`, `onMouseDown`, or other callback properties. It returns an unsubscribe function. Events are `pointerdown`, `pointermove`, `pointerup`, `pointerleave`, `pointercancel`, and `keydown`. Pointer events carry the existing `coords`, `mouse`, and `client` coordinate groups plus `pointer` metadata: optional ID, type, buttons, and Shift/Ctrl/Meta/Alt flags. Cancellation carries a reason (`"cancel"` or `"multitouch"`); key events carry a normalized `key` object.

Only one `EngineTool` is active. Its `handleInput(event)` runs before observers and camera defaults. Return `true` from `pointerdown` to capture the whole press. `handled` tells observers whether the tool owns that event. Keys reach the tool first, but a tool's `true` for `Tab` is ignored so focus can always leave the surface. `cancel()` is called when switching away; optional `dispose()` runs when the engine is destroyed with that tool active. `subscribeToolChange(listener)` reports changes without altering the tool. Legacy callbacks remain connected and ordinary clicks still reach them; a dragged or cancelled press does not produce a click.

Custom interactive renderers can opt in by passing `deps.input` as the sixth `GestureProcessor` constructor argument. Continue forwarding captured outside moves using `trackingPointer`, claim touches while `toolsEnabled`, preserve pointer metadata, and forward real cancellation. Server rendering has no input transport; programmatic selection and translation remain platform-neutral.

## Model Adapters, Transactions, and Limits

`SelectionAdapter<T>` separates interaction from storage. It supplies `idOf(hit)`, `get(id)`, `update(id, item)` returning the canonical immutable value, `batch(callback)`, `subscribe(listener)`, `translate(item, delta)`, and `anchor(item)`. A custom adapter can combine rect, image, line, and path collections using globally unique IDs. Its `idOf` must check the source registration; array indices are not stable IDs. The supplied convenience helper covers one `ItemCollection` and one handle.

`onTransformStart({ kind: "translate", ids })` fires once before the first real geometry update. `onTransformEnd({ kind: "translate", ids, cancelled })` closes it once on commit or cancellation. Clicks, locked-only drags, and zero translations do not open a transaction. Use these hooks to connect an application's history or persistence layer. No history implementation is required by this controller.

Cancellation restores the original immutable items only if the model still contains the controller's last preview values. Until a press writes its first preview, external updates (live data, sprite frames, selection flags mirrored into the model) are followed: the press continues and translates the current values, and removed, locked, or unselectable items drop out. Once a preview is written, external replacement/deletion aborts the drag without overwriting the external values; remaining owned previews are restored. If a model or UI subscriber throws, cleanup and the end hook still run before the first error is rethrown. Application transaction systems need their own policy for external changes during an open transaction: rolling back an entire model transaction may also roll back those external edits.

This release supplies selection and translation. Resize/rotate handles, exact painted selection bounds, lasso selection, alignment guides, edge auto-pan, and an editor UI remain follow-on work. `itemsBounds` is a camera-independent layout helper; it ignores rotation, origin offsets, and fixed pixel sizes, so it should not be treated as accurate transform-handle geometry.
