import { History, HistoryCommittedError, type HistoryAdapter, type HistoryDirection } from "./History";
import { ItemCollection, type ItemCollectionChange, type ItemKey } from "./ItemCollection";

interface CollectionHistorySource {
    sourceId: string;
    replaying: boolean;
    apply(changes: readonly ItemCollectionChange<unknown>[]): readonly unknown[];
}

const COMMAND_SOURCE: unique symbol = Symbol("ItemCollectionHistory.source");

/** A compact delta batch created by attachItemCollectionHistory, not a scene snapshot. */
export interface ItemCollectionHistoryCommand {
    readonly sourceId: string;
    readonly changes: readonly ItemCollectionChange<unknown>[];
    readonly [COMMAND_SOURCE]: CollectionHistorySource;
}

export interface ItemCollectionHistoryOptions {
    /** Retained complete undo/redo entries, default 100. */
    limit?: number;
    /** Stable application identity for this collection, default "items". */
    sourceId?: string;
}

const owners = new WeakMap<object, History<ItemCollectionHistoryCommand>>();
const sources = new WeakMap<History<ItemCollectionHistoryCommand>, Map<string, CollectionHistorySource>>();

function commandFor(
    source: CollectionHistorySource,
    changes: readonly ItemCollectionChange<unknown>[],
): ItemCollectionHistoryCommand {
    return Object.freeze({ sourceId: source.sourceId, changes: compactUpdates(changes), [COMMAND_SOURCE]: source });
}

/** Updates commute across distinct keys while membership/order stays unchanged. */
function compactUpdates(changes: readonly ItemCollectionChange<unknown>[]): readonly ItemCollectionChange<unknown>[] {
    if (!changes.every((change) => change.type === "update")) {
        return Object.freeze([...changes]);
    }
    const updates = new Map<ItemKey, Extract<ItemCollectionChange<unknown>, { type: "update" }>>();
    for (const change of changes) {
        if (change.type !== "update") {
            continue;
        }
        const previous = updates.get(change.key);
        updates.set(change.key, previous ? Object.freeze({ ...change, previous: previous.previous }) : change);
    }
    return Object.freeze([...updates.values()]);
}

function replay(command: ItemCollectionHistoryCommand, direction: HistoryDirection): void {
    const source = command[COMMAND_SOURCE];
    const changes =
        direction === "redo"
            ? command.changes
            : [...command.changes].reverse().map((change) => {
                  if (change.type === "insert") {
                      return { ...change, type: "remove" as const };
                  }
                  if (change.type === "remove") {
                      return { ...change, type: "insert" as const };
                  }
                  return { ...change, item: change.previous, previous: change.item };
              });
    source.replaying = true;
    try {
        const errors = source.apply(changes);
        if (errors.length > 0) {
            throw new HistoryCommittedError(errors);
        }
    } finally {
        source.replaying = false;
    }
}

/**
 * Use with History and attachItemCollectionHistory to group several typed
 * collections in the same transaction. It has no dependency on scene/editor APIs.
 */
export const itemCollectionHistoryAdapter: HistoryAdapter<ItemCollectionHistoryCommand> = {
    undo: (command) => replay(command, "undo"),
    redo: (command) => replay(command, "redo"),
    merge(previous, next) {
        if (
            previous[COMMAND_SOURCE] !== next[COMMAND_SOURCE] ||
            !previous.changes.every((change) => change.type === "update") ||
            !next.changes.every((change) => change.type === "update")
        ) {
            return undefined;
        }
        return commandFor(previous[COMMAND_SOURCE], [...previous.changes, ...next.changes]);
    },
};

/**
 * Observe a source's subsequent changes. One batch is one history command;
 * open History transactions can group batches from multiple collections.
 * A source has one history owner. Detaching clears the whole shared history,
 * so retained cross-source entries cannot later replay against untracked edits.
 */
export function attachItemCollectionHistory<T extends object>(
    history: History<ItemCollectionHistoryCommand>,
    sourceId: string,
    collection: ItemCollection<T>,
): () => void {
    if (sourceId.length === 0) {
        throw new Error("History: sourceId must not be empty");
    }
    if (owners.has(collection)) {
        throw new Error("History: the collection already has a history owner");
    }
    let registered = sources.get(history);
    if (registered?.has(sourceId)) {
        throw new Error(`History: duplicate sourceId ${sourceId}`);
    }
    const source: CollectionHistorySource = {
        sourceId,
        replaying: false,
        apply: (changes) => collection._replayHistory(changes as readonly ItemCollectionChange<T>[]),
    };
    let attached = true;
    let unsubscribe = () => {};
    let unregister = () => {};
    const cleanup = () => {
        if (!attached) {
            return;
        }
        attached = false;
        unsubscribe();
        unregister();
        owners.delete(collection);
        registered!.delete(sourceId);
    };
    unregister = history._addLifecycle({
        guard: () => collection._assertHistoryIdle(),
        lock: () => collection._lockHistoryMutations(),
        dispose: cleanup,
    });
    if (!registered) {
        registered = new Map();
        sources.set(history, registered);
    }
    registered.set(sourceId, source);
    owners.set(collection, history);
    unsubscribe = collection.subscribe((changes) => {
        if (!source.replaying) {
            history.record(commandFor(source, changes));
        }
    });
    return () => {
        if (!attached) {
            return;
        }
        let committedError: HistoryCommittedError | undefined;
        try {
            history.clear();
        } catch (error) {
            if (!(error instanceof HistoryCommittedError)) {
                throw error;
            }
            committedError = error;
        }
        cleanup();
        if (committedError) {
            throw committedError;
        }
    };
}

/** Observe one collection with the same transaction API used by generic History. */
export function createItemCollectionHistory<T extends object>(
    collection: ItemCollection<T>,
    options: ItemCollectionHistoryOptions = {},
): History<ItemCollectionHistoryCommand> {
    const history = new History({ adapter: itemCollectionHistoryAdapter, limit: options.limit });
    attachItemCollectionHistory(history, options.sourceId ?? "items", collection);
    return history;
}
