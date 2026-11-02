---
sidebar_position: 2.3
---

# Transactions and Undo/Redo

Use `History` to make one drag, brush stroke, or multi-item edit one undo step. It stores commands and item deltas instead of copying the entire scene on each pointer move. History is independent of the renderer and works with custom application stores as well as [live item collections](./item_collections.md).

## Track a Collection

```ts
import { ItemCollection, createItemCollectionHistory, type Rect } from "@canvas-tile-engine/core";

type Seat = Rect & { id: string };
const seats = new ItemCollection<Seat>(
    [
        { id: "A1", x: 0, y: 0 },
        { id: "A2", x: 1, y: 0 },
    ],
    { keyOf: (seat) => seat.id },
);
const history = createItemCollectionHistory(seats, {
    sourceId: "seats",
    limit: 100,
});

engine.drawRect(seats, 1, { id: "seats" });
engine.render();

// Call once when a gesture starts.
history.beginTransaction("Move seats");

// Call as often as needed while the gesture is active.
seats.batch(() => {
    seats.update("A1", { x: 4 });
    seats.update("A2", { x: 5 });
});
seats.update("A1", { x: 6 });

// Call once when the gesture finishes. The entire gesture is one undo step.
history.commit();
history.undo(); // Original A1/A2 positions.
history.redo(); // Final A1/A2 positions.

// On Escape, pointer cancellation, or an abandoned tool operation:
history.beginTransaction("Temporary move");
seats.update("A1", { x: 20 });
history.cancel(); // Restores x: 6 and preserves existing redo entries.
```

The helper records subsequent collection mutations automatically. Do not also call `history.record()` for those edits. Without an open history transaction, each collection notification is one undo entry: one `update`, `insert`, `insertAt`, or successful `remove`, or all changes from one `batch`.

Start and finish history transactions outside collection `batch` callbacks and notification listeners. `ItemCollection.batch()` only groups synchronous notifications; `History` supplies the reversible transaction boundary. A gesture can span many batches and frames. Nested history transactions are rejected.

## History API

| Member                     | Behavior                                                                                                                             |
| :------------------------- | :----------------------------------------------------------------------------------------------------------------------------------- |
| `beginTransaction(label?)` | Opens one transaction. Changes apply immediately and accumulate until commit or cancel.                                              |
| `commit()`                 | Keeps the edits and creates one undo entry; returns whether a nonempty transaction was committed.                                    |
| `cancel()`                 | Reverts the open transaction and preserves the earlier redo stack; returns `false` if no transaction is open.                        |
| `undo()` / `redo()`        | Replays one complete entry; returns `false` when its stack is empty. Both reject an open transaction.                                |
| `canUndo` / `canRedo`      | Availability for controls. Both are `false` during a transaction, after disposal, or after an unrecoverable replay failure.          |
| `inTransaction`            | Whether a transaction is open.                                                                                                       |
| `state`                    | Stable, immutable snapshot with availability, `undoDepth`, `redoDepth`, optional labels, `inTransaction`, `disposed`, and `faulted`. |
| `subscribe(listener)`      | Observes history state changes; returns unsubscribe. No initial emission. Other listeners still run if one throws.                   |
| `execute(command, label?)` | Applies a new custom command through its adapter, then records it.                                                                   |
| `record(command, label?)`  | Records an already-applied custom command; does not apply it again.                                                                  |
| `clear()`                  | Releases all entries and any active transaction without changing the current document. Establishes a new baseline.                   |
| `dispose()`                | Releases entries and attached source subscriptions without changing the document. Idempotent.                                        |

A new committed edit invalidates redo. An empty transaction or a canceled gesture preserves it. Opening a transaction does not itself discard redo.

The default `limit` is 100 complete entries across the undo and redo stacks. It must be a non-negative integer; `0` disables retained entries while still allowing active transactions to be canceled. Eviction removes the oldest complete entry. The limit counts entries, not bytes: one large brush stroke can still contain many changed items. `clear()` and `dispose()` discard an active gesture without reverting it; call `cancel()` first if reverting is intended.

## Several Collections, One Transaction

Use a shared history when a scene has separate shape, label, or image collections. Source IDs identify batches; item keys identify objects within each batch. Different collections can have different item types and can reuse item keys.

```ts
import {
    History,
    ItemCollection,
    attachItemCollectionHistory,
    itemCollectionHistoryAdapter,
} from "@canvas-tile-engine/core";

const seats = new ItemCollection([{ id: "A1", x: 0, y: 0 }], { keyOf: (seat) => seat.id });
const labels = new ItemCollection([{ id: "A1", x: 0, y: 0, text: "A1" }], { keyOf: (label) => label.id });
const history = new History({ adapter: itemCollectionHistoryAdapter, limit: 100 });
const detachSeats = attachItemCollectionHistory(history, "seats", seats);
attachItemCollectionHistory(history, "labels", labels);

history.beginTransaction("Move seat and label");
seats.update("A1", { x: 4 });
labels.update("A1", { x: 4, text: "Reserved" });
history.commit();

history.undo(); // Both collections return to their original values.

detachSeats(); // Clears the shared history, then stops tracking seats.
history.dispose(); // Also detaches the remaining sources.
```

Each collection can have one history owner. Source IDs must be nonempty and unique within a history. Attachment starts at the current state and does not record preexisting items. Detaching any source clears the entire shared history, including an active transaction, so a later replay cannot touch an untracked source through an old cross-source entry. Detach and dispose never edit the collections themselves.

These APIs do not require a particular scene format or selection controller. A tool can call `beginTransaction`, `commit`, and `cancel` from its gesture lifecycle hooks, and a scene loader can attach its typed collections using stable batch IDs.

## Order, Identity, and Live Rendering

Undo restores the captured item references, keys, and dense array positions. Redo restores the corresponding final references. Reverting an update replaces the whole item, so properties added or removed by an immutable updater are restored correctly. Removing a middle item and undoing that removal returns it to the same paint position.

`ItemCollection.insertAt(index, item)` also exposes positional insertion directly. `index` must be an integer from `0` through `size`; `size` appends. Invalid positions and duplicate keys throw before mutation. `insert(item)` continues to append. Positional insertion shifts subsequent dense indices, so use the stable `key`, rather than `HitResult.index`, as application identity.

Collection history sends the same change notifications as ordinary edits. Registered drawing, hit testing, and automatic render requests therefore follow undo and redo. Geometry queries are current after the history call returns. Existing draw handles stay registered.

Updates and appends retain incremental indexing. Middle insertions and removals shift the dense backing array and require linear work. A middle insertion also invalidates a renderer's painted-order index, which rebuilds on its next indexed query; it does not rebuild the hit-test R-tree. Undoing a removal may take that path. Consecutive update-only commands for the same source are compacted within a transaction to the first previous and final current item per key. Membership changes keep their sequential deltas. Alternating between sources can retain separate commands.

Treat items and their nested values as immutable for the entire history lifetime. Replace nested style, geometry, and data objects when editing. History retains references and does not deep-clone items, serialize commands, or persist undo across reloads. Keep `keyOf` pure and stable. For an external document replacement or a change that bypasses the tracked API, clear history and establish a new baseline.

## Custom Stores and Commands

`History<TCommand>` has no dependency on `ItemCollection`. An adapter can bridge Redux, Zustand, or another synchronous store by implementing reversible commands. Capture the changed values, then use the store's ordinary update mechanism to apply them.

```ts
import { History } from "@canvas-tile-engine/core";

type Position = Readonly<{ x: number; y: number }>;
type Move = { id: string; before: Position; after: Position };

// Implement this facade with your application's store.
interface PositionStore {
    get(id: string): Position;
    // Check the expected value, then replace atomically. On ordinary throw,
    // leave the store unchanged.
    replace(id: string, expected: Position, next: Position): void;
}

function positionHistory(store: PositionStore) {
    return new History<Move>({
        limit: 100,
        adapter: {
            redo: (move) => store.replace(move.id, move.before, move.after),
            undo: (move) => store.replace(move.id, move.after, move.before),
            merge: (previous, next) =>
                previous.id === next.id && previous.after === next.before
                    ? { ...next, before: previous.before }
                    : undefined,
        },
    });
}

declare const store: PositionStore; // your application's store facade
const history = positionHistory(store);
history.execute({ id: "seat-A1", before: store.get("seat-A1"), after: { x: 4, y: 2 } }, "Move seat");
```

Use `execute` when history should apply the command. Use `record` when the store has already applied it, for example from a store subscription; do not replay the same edit through both routes. A subscription also observes history's own `undo`, `redo`, `cancel`, and `execute`; `record` calls made while history is applying a command through its adapter are ignored, so the subscription does not need to filter them. Commands are immutable. `merge(previous, next)` is optional and only compacts adjacent commands within an open transaction. Returning `undefined` keeps both commands. Optional `release(command)` runs for evicted, canceled, merged, cleared, or disposed records. It may release command-owned references but must not alter the document or free assets the current document still uses. Merge and release hooks must not mutate the model.

## React and React Native Controls

Both bindings re-export the History classes, helpers, and types. Keep the collection and history instances stable in the owning application. A toolbar can subscribe independently of the canvas:

```tsx
import { useCallback, useSyncExternalStore } from "react";
import { type History, type ItemCollectionHistoryCommand } from "@canvas-tile-engine/react";

function HistoryButtons({ history }: { history: History<ItemCollectionHistoryCommand> }) {
    const subscribe = useCallback((notify: () => void) => history.subscribe(notify), [history]);
    const getSnapshot = useCallback(() => history.state, [history]);
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    return (
        <>
            <button disabled={!state.canUndo} onClick={() => history.undo()}>
                Undo
            </button>
            <button disabled={!state.canRedo} onClick={() => history.redo()}>
                Redo
            </button>
        </>
    );
}
```

For native UI, import the same APIs from `@canvas-tile-engine/react-native` and use native buttons. The document owner calls `dispose()` when the history is no longer used; unmounting a draw component alone does not dispose shared document history.

## Errors and Replay Guarantees

Each custom adapter command must either complete or throw before changing the model. When several commands are replayed and a later command fails, history runs the inverse of completed commands to restore the pre-call state. `HistoryReplayError.restored === true` means that compensation succeeded and the stacks remain unchanged. If compensation also fails, `restored` is `false`, history becomes `faulted`, and unusable entries are released. Resolve the model state and call `clear()` to establish a new baseline before continuing. `cause` and `rollbackErrors` expose the failures.

The collection adapter validates a whole command batch before writing: expected item references, keys, and sequential positions must match. It then applies that command and publishes one collection notification. A multi-source transaction still notifies sources as their commands replay; observers can see intermediate states and compensation. There is no snapshot isolation across sources.

An observer can fail after a model change has committed. A custom adapter must signal that case with `HistoryCommittedError`, not an ordinary exception. The collection adapter handles this distinction automatically. History advances its stacks and reports `HistoryCommittedError` after notifications; `committed` is `true` and `errors` contains the observer or cleanup errors. Do not retry the same edit just because that error was thrown.

History controls cannot run reentrantly from adapter or history-state callbacks. While a history call or its state notification is running, all attached collections reject source mutations before applying them; this prevents observer edits from escaping the recorded command. Normal collection subscriber mutations outside those history callbacks still follow the collection's FIFO notification rules. Schedule a subsequent edit after the current operation returns if needed.
