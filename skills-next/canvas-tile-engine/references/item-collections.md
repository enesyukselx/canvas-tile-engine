# Live Item Collections (core >= 0.12)

Use `ItemCollection<T extends object>` for frequently changing geometry or
membership. Keep the instance stable and register it once. Supported dynamic
primitives: Rect, Circle, Image, Text, Line, Path on all official renderers,
including their React / React Native components and imperative handles.
Static helpers and Sprite retain their existing inputs.

## Usage

```ts
import { ItemCollection, type Rect } from "@canvas-tile-engine/core";

type Unit = Rect & { id: string };
const units = new ItemCollection<Unit>(
    [{ id: "a", x: 0, y: 0 }],
    { keyOf: (unit) => unit.id },
);
const handle = engine.drawRect(units, 1, { id: "units" });
engine.render(); // initial frame

units.update("a", { x: 3, width: 2 }); // automatically requests a frame
units.batch(() => {
    units.update("a", (unit) => ({
        ...unit,
        style: { ...unit.style, fillStyle: "red" },
    }));
    units.insert({ id: "b", x: 4, y: 0 });
});
units.remove("b");
engine.removeDrawHandle(handle);
```

Import the same class and types from `@canvas-tile-engine/react` or
`@canvas-tile-engine/react-native` in binding apps. Initialize with
`useState(() => new ItemCollection(...))` or an external store; pass the
instance as `items`. Updating it does not require React rerendering. Outside
canvas UI still needs its own state/subscription.

## Contracts

- `ItemKey = string | number`. Supply a stable, unique `keyOf` result;
  duplicate insertion and key-changing updates throw. Missing-key updates
  throw; missing-key removals return `false`. Registration `options.id`
  identifies the whole draw; collection keys identify its individual items.
- `update(key, Partial<T> | ((previous: Readonly<T>) => T))` returns a new
  shallow copy. Replace nested `style`, `data`, `commands`, and `points`
  immutably. Never mutate the read-only `items` view or values from `get`.
- `get(key)`, `size`, `items`, and `keyAt(index)` read the current source.
  `insert` appends and `insertAt(index, item)` (0..size) inserts in place;
  updates keep their order; removal compacts the array.
- `batch(callback)` groups synchronous mutations and nested batches.
  It is not an async transaction. Successful changes still notify if the
  callback throws; no rollback. Subscribers receive immutable delta
  envelopes, but item values themselves must still be treated as read-only.
- `subscribe(listener)` does not emit an initial snapshot and returns
  unsubscribe. It receives ordered `ItemCollectionChange<T>[]` deltas:
  insert/remove carry `key`, `item`, `index`; update also has `previous`.
  A subscriber added during a batch receives only subsequent changes.
- Subscriber errors do not skip remaining subscribers; the first error is
  rethrown after delivery. Reentrant mutation notifications drain in FIFO
  order. Query current engine geometry after the outer mutation returns;
  inside a subscriber other registrations may not have received it yet.
- `DrawItems<T> = T | T[] | ReadonlyItemCollection<T>`. The read-only source
  is covariant, so a collection of application-specific items is accepted
  by the corresponding primitive. `isItemCollection` recognizes the explicit
  protocol; arbitrary iterables are not live sources.

## Hits, Rendering, and Cleanup

`HitResult.key?: ItemKey` is present for collection hits. Use it as stable
identity; `index` is the current dense position and shifts after removal.
Hit geometry updates synchronously before the next paint, also above 500
items. Existing clip/visibility/interaction rules still apply; Text does
not hit-test.

`engine.requestRender()` coalesces requests into one animation frame, or a
microtask without rAF. Collections and React child repaints share it.
`render()` remains synchronous and consumes a pending request. Destroy
cancels pending frames. Remove, id replacement, clearLayer, clearAll, and
destroy detach affected subscriptions. Sources remain reusable and can be
shared across engines/registrations.

Each registration copies the initial array once into a stable view. Changes
update affected cached/indexed entries without replacing the handle. This
does not promise constant-time removal (dense positions shift), no future
index rebuild (zoom/font metrics may invalidate caches), or partial GPU
buffer upload. Keep `styleOf` for non-geometric hover/selection decoration.
Ordinary arrays still need re-registration after geometry changes.

Custom renderer authors implement optional `IDrawAPI.applyDrawChanges` to
accept collections. Core updates the stable registration array first, then
delivers deltas. Cache updater state must be released with its handle/layer.
Without this method, single-item/array draws still work and a collection
draw throws before replacing an existing registration id.
