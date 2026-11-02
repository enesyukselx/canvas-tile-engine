# History and Transactions (core >= 0.12)

Use command/delta history for undoable editor operations. Do not copy the whole
scene on every pointer move. Import these APIs from core, react, or react-native.

## Contents

- [Collection history](#collection-history)
- [Several collections](#several-collections)
- [Generic stores](#generic-stores)
- [Lifecycle and limits](#lifecycle-and-limits)
- [Errors and ordering](#errors-and-ordering)

## Collection history

```ts
const history = createItemCollectionHistory(items, { sourceId: "seats", limit: 100 });
history.beginTransaction("Drag selection");
items.batch(() => {
    items.update("A1", { x: 4 });
    items.update("A2", { x: 5 });
});
// More updates and batches may follow across frames.
history.commit(); // One undo step.
history.undo();
history.redo();
```

Call `beginTransaction` at gesture start, `commit` at successful end, and
`cancel` for Escape or pointer cancellation. Wire these structurally to the
tool's lifecycle hooks; no Scene/Selection imports are required. Start/end
history transactions outside collection batch callbacks and notifications.
Nested history transactions throw; undo/redo while one is open also throw.

The helper records subsequent collection notifications automatically. Do not
also call `record` or `execute` for those edits. Without a transaction, one
notification is one undo step, including a whole `ItemCollection.batch`.
`batch` still has no rollback: if its callback throws, successful edits notify
and become undoable. `cancel` is the operation that reverts the active gesture.

`commit(): boolean` reports a nonempty committed transaction. Empty commits do
not discard redo. `cancel(): boolean` reports whether a transaction existed
and preserves earlier redo. Only a newly committed edit invalidates redo.

## Several collections

```ts
const history = new History({ adapter: itemCollectionHistoryAdapter, limit: 100 });
const detach = attachItemCollectionHistory(history, "seats", seats);
attachItemCollectionHistory(history, "labels", labels);
history.beginTransaction("Move seat and label");
seats.update("A1", { x: 5 });
labels.update("label-A1", { x: 5 });
history.commit();
```

Collections may have different item types. Give each a nonempty stable source
ID unique within this history. Item keys are scoped to a source. A collection
can have one history owner. Attachment starts at its current state.

Detaching any source clears the whole shared history, including an active
transaction, without changing the document. This prevents old cross-source
entries from replaying against untracked edits. Remaining sources stay tracked.
`dispose()` detaches all sources and clears retained commands.

## Generic stores

```ts
type Change = { id: string; before: Position; after: Position };
const history = new History<Change>({
    limit: 100,
    adapter: {
        undo: (change) => store.replace(change.id, change.after, change.before),
        redo: (change) => store.replace(change.id, change.before, change.after),
        merge: (previous, next) =>
            previous.id === next.id && previous.after === next.before
                ? { ...next, before: previous.before }
                : undefined,
    },
});
history.execute({ id, before, after }, "Move");
```

Bridge a Redux/Zustand/custom store with its ordinary synchronous update API.
The facade above must check the expected value and atomically replace it:
each adapter command either commits completely or throws without changing the
model. `execute` applies and records; `record` only records an already-applied
command. Never use both for the same edit. `record` calls made while
history applies a command through its adapter (a store subscription seeing
undo/redo/cancel/execute) are ignored, so subscriptions need no filter.
Keep commands immutable.

Optional `merge(previous,next)` compacts adjacent transaction commands;
`undefined` keeps both. Optional `release(command)` releases command-owned
resources on eviction, cancellation, merge replacement, clear, or disposal.
Neither callback may mutate the model or free assets that the document uses.

## Lifecycle and limits

Read `canUndo`, `canRedo`, and `inTransaction`, or use immutable `state`:
availability, `undoDepth`, `redoDepth`, optional `undoLabel`, `redoLabel`,
`transactionLabel`, plus `disposed` and `faulted`. Availability is false during
a transaction. `subscribe(listener)` has no initial emission and returns an
unsubscribe function. Use stable subscribe/getSnapshot closures around
`history.subscribe` and `history.state` with React `useSyncExternalStore`.

The default limit is 100 complete retained undo/redo entries. Use a
non-negative integer; zero disables retention but keeps cancellation of an
active transaction. This is an entry limit, not a byte cap. Large gestures can
still retain many changed items. Consecutive update-only commands for the same
source compact to initial/final values per key; alternating sources and
membership changes can retain separate sequential commands.

`clear()` discards entries and an active transaction without reverting edits.
`dispose()` also detaches source subscriptions and is idempotent. Call
`cancel()` first if the active edits should be reverted. Keep history stable
for its document lifetime; removing a draw handle does not dispose history.

## Errors and ordering

Undo/redo restores exact captured item references, keys, and dense positions.
Use immutable nested values for the full history lifetime; no deep copies are
made. Keys and `keyOf` must stay stable. Clear history before external document
replacement or after edits outside the tracked API. History is in-memory;
commands are not a portable scene format or persisted undo log.

`items.insertAt(index,item)` inserts at integer `0..size`, preserving identity.
Duplicate keys and invalid indices fail before mutation. `insert` still
appends. Middle insertion/removal shifts dense indices, so identify selections
by stable key. Geometry/hit caches update synchronously; rendering is requested
automatically. Middle insertion invalidates painted-order culling for its next
query; updates and appends remain incremental. No draw re-registration needed.

The collection adapter preflights each complete command before writing, then
notifies once. Multiple commands/sources can expose intermediate replay and
compensation states to observers; there is no snapshot isolation.

On replay failure, completed commands are compensated in reverse order.
`HistoryReplayError.restored` true means pre-call state and stacks are intact.
False means compensation failed: history faults, releases unusable entries,
and requires the app to resolve the model and call `clear()` for a new baseline.

An observer failure after commit is `HistoryCommittedError` (`committed: true`,
`errors`). Stacks still advance; do not retry the edit. Custom adapters must
throw that error when they already committed, rather than an ordinary error.
The collection adapter makes this distinction automatically.

Do not call history controls or mutate attached collections from history-state
callbacks or replay observers. The bridge rejects such source edits before
mutation and continues notification. Run follow-up edits after the current
operation returns. Normal collection reentrant notifications outside history
callbacks still follow FIFO delivery.
