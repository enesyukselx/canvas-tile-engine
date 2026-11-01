/** Replay direction for an application-defined command. */
export type HistoryDirection = "undo" | "redo";

/**
 * An adapter for a store or document model. Each undo/redo must either finish
 * completely or throw without changing the model. If an observer fails AFTER
 * commit, throw HistoryCommittedError instead, so the stacks can still advance.
 * Merge/release must not mutate the document. Commands are treated as immutable.
 */
export interface HistoryAdapter<TCommand> {
    undo(command: TCommand): void;
    redo(command: TCommand): void;
    /** Optional compaction inside an open transaction; undefined keeps both commands. */
    merge?(previous: TCommand, next: TCommand): TCommand | undefined;
    /** Release resources when a record is evicted, canceled, merged, cleared, or disposed. */
    release?(command: TCommand): void;
}

export interface HistoryOptions<TCommand> {
    adapter: HistoryAdapter<TCommand>;
    /** Maximum retained complete undo/redo entries. Default 100; zero disables retention. */
    limit?: number;
}

/** Immutable UI state. Subscribe to it for undo/redo buttons or external-store bindings. */
export interface HistoryState {
    readonly canUndo: boolean;
    readonly canRedo: boolean;
    readonly inTransaction: boolean;
    readonly undoDepth: number;
    readonly redoDepth: number;
    readonly undoLabel?: string;
    readonly redoLabel?: string;
    readonly transactionLabel?: string;
    readonly disposed: boolean;
    readonly faulted: boolean;
}

/** The data/history change succeeded; the attached errors are from observers or cleanup. */
export class HistoryCommittedError extends Error {
    readonly committed = true;
    readonly errors: readonly unknown[];

    constructor(errors: readonly unknown[]) {
        super("History change committed, but notification or cleanup failed", { cause: errors[0] });
        this.name = "HistoryCommittedError";
        this.errors = Object.freeze([...errors]);
    }
}

/** A replay failed. restored=false means compensation failed and clear() is required. */
export class HistoryReplayError extends Error {
    readonly restored: boolean;
    readonly rollbackErrors: readonly unknown[];

    constructor(cause: unknown, rollbackErrors: readonly unknown[]) {
        super(
            rollbackErrors.length === 0
                ? "History replay failed; the original state was restored"
                : "History replay and compensation failed; clear history before continuing",
            { cause },
        );
        this.name = "HistoryReplayError";
        this.restored = rollbackErrors.length === 0;
        this.rollbackErrors = Object.freeze([...rollbackErrors]);
    }
}

interface HistoryEntry<TCommand> {
    commands: TCommand[];
    label?: string;
}

interface HistoryLifecycle {
    guard: () => void;
    dispose: () => void;
    lock?: () => () => void;
}

/**
 * Command-based undo/redo for any synchronous model. A transaction groups many
 * applied edits into one step; cancel replays their inverses and preserves redo.
 * Undo/redo compensate completed commands when a later command fails. There is
 * no snapshot isolation: model observers can see replay and compensation.
 */
export class History<TCommand> {
    private readonly adapter: HistoryAdapter<TCommand>;
    private readonly limit: number;
    private undoEntries: HistoryEntry<TCommand>[] = [];
    private redoEntries: HistoryEntry<TCommand>[] = [];
    private transaction?: HistoryEntry<TCommand>;
    private readonly listeners = new Set<(state: HistoryState) => void>();
    private readonly lifecycle = new Set<HistoryLifecycle>();
    private busy = false;
    private isDisposed = false;
    private isFaulted = false;
    private snapshot: HistoryState;

    constructor(options: HistoryOptions<TCommand>) {
        if (typeof options.adapter?.undo !== "function" || typeof options.adapter?.redo !== "function") {
            throw new TypeError("History: adapter must implement undo and redo");
        }
        this.limit = options.limit ?? 100;
        if (!Number.isInteger(this.limit) || this.limit < 0) {
            throw new RangeError("History: limit must be a non-negative integer");
        }
        this.adapter = options.adapter;
        this.snapshot = this.makeState();
    }

    get canUndo(): boolean {
        return this.snapshot.canUndo;
    }
    get canRedo(): boolean {
        return this.snapshot.canRedo;
    }
    get inTransaction(): boolean {
        return this.snapshot.inTransaction;
    }
    get state(): HistoryState {
        return this.snapshot;
    }

    /** Apply a new command through the adapter and record it only after it commits. */
    execute(command: TCommand, label?: string): void {
        this.run((errors) => {
            this.apply(command, "redo", errors);
            this.addRecord(command, label, errors);
            this.publish(errors);
        });
    }

    /** Record an already-applied command, for store subscriptions and collection deltas. */
    record(command: TCommand, label?: string): void {
        this.run(
            (errors) => {
                this.addRecord(command, label, errors);
                this.publish(errors);
            },
            { guard: false },
        );
    }

    beginTransaction(label?: string): void {
        this.run((errors) => {
            if (this.transaction) {
                throw new Error("History: a transaction is already open");
            }
            this.transaction = { commands: [], label };
            this.publish(errors);
        });
    }

    /** Commit one undo entry. Empty transactions do not invalidate redo. */
    commit(): boolean {
        return this.run((errors) => {
            const entry = this.transaction;
            if (!entry) {
                return false;
            }
            this.transaction = undefined;
            if (entry.commands.length > 0) {
                this.pushEntry(entry, errors);
            }
            this.publish(errors);
            return entry.commands.length > 0;
        });
    }

    /** Undo the active transaction, leaving the pre-existing redo stack intact. */
    cancel(): boolean {
        return this.run((errors) => {
            const entry = this.transaction;
            if (!entry) {
                return false;
            }
            this.replay(entry.commands, "undo", errors);
            this.transaction = undefined;
            this.releaseEntries([entry], errors);
            this.publish(errors);
            return true;
        });
    }

    undo(): boolean {
        return this.run((errors) => {
            this.assertNoTransaction();
            const entry = this.undoEntries.at(-1);
            if (!entry) {
                return false;
            }
            this.replay(entry.commands, "undo", errors);
            this.undoEntries.pop();
            this.redoEntries.push(entry);
            this.publish(errors);
            return true;
        });
    }

    redo(): boolean {
        return this.run((errors) => {
            this.assertNoTransaction();
            const entry = this.redoEntries.at(-1);
            if (!entry) {
                return false;
            }
            this.replay(entry.commands, "redo", errors);
            this.redoEntries.pop();
            this.undoEntries.push(entry);
            this.publish(errors);
            return true;
        });
    }

    /** Discard retained entries and any open transaction without changing the model. */
    clear(): void {
        this.run(
            (errors) => {
                this.discard(errors);
                this.isFaulted = false;
                this.publish(errors);
            },
            { allowFault: true },
        );
    }

    /** No initial emission. State objects remain stable until the next history change. */
    subscribe(listener: (state: HistoryState) => void): () => void {
        if (this.isDisposed) {
            throw new Error("History: already disposed");
        }
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    /** Release entries and source subscriptions. Idempotent; never edits the document. */
    dispose(): void {
        if (this.isDisposed) {
            return;
        }
        if (this.busy) {
            throw new Error("History: controls cannot run during replay or notification");
        }
        this.busy = true;
        const errors: unknown[] = [];
        try {
            this.isDisposed = true;
            this.discard(errors);
            for (const lifecycle of [...this.lifecycle]) {
                try {
                    lifecycle.dispose();
                } catch (error) {
                    errors.push(error);
                }
            }
            this.lifecycle.clear();
            this.publish(errors);
            this.listeners.clear();
        } finally {
            this.busy = false;
        }
        if (errors.length > 0) {
            throw new HistoryCommittedError(errors);
        }
    }

    /** @internal Register source guards, replay locks, and disposal for an adapter bridge. */
    _addLifecycle(lifecycle: HistoryLifecycle): () => void {
        if (this.isDisposed || this.busy) {
            throw new Error("History: cannot attach a source right now");
        }
        this.lifecycle.add(lifecycle);
        return () => {
            this.lifecycle.delete(lifecycle);
        };
    }

    private run<R>(callback: (errors: unknown[]) => R, options: { guard?: boolean; allowFault?: boolean } = {}): R {
        if (this.isDisposed) {
            throw new Error("History: already disposed");
        }
        if (this.busy) {
            throw new Error("History: controls cannot run during replay or notification");
        }
        if (this.isFaulted && !options.allowFault) {
            throw new Error("History: compensation failed; call clear() first");
        }
        if (options.guard !== false) {
            for (const lifecycle of this.lifecycle) {
                lifecycle.guard();
            }
        }
        this.busy = true;
        const errors: unknown[] = [];
        const unlock: (() => void)[] = [];
        try {
            for (const lifecycle of this.lifecycle) {
                if (lifecycle.lock) {
                    unlock.push(lifecycle.lock());
                }
            }
            const result = callback(errors);
            if (errors.length > 0) {
                throw new HistoryCommittedError(errors);
            }
            return result;
        } finally {
            for (const release of unlock.reverse()) {
                release();
            }
            this.busy = false;
        }
    }

    private assertNoTransaction(): void {
        if (this.transaction) {
            throw new Error("History: commit or cancel the active transaction first");
        }
    }

    private apply(command: TCommand, direction: HistoryDirection, errors: unknown[]): void {
        try {
            this.adapter[direction](command);
        } catch (error) {
            if (error instanceof HistoryCommittedError) {
                errors.push(...error.errors);
            } else {
                throw error;
            }
        }
    }

    private replay(commands: readonly TCommand[], direction: HistoryDirection, errors: unknown[]): void {
        const ordered = direction === "undo" ? [...commands].reverse() : commands;
        const completed: TCommand[] = [];
        try {
            for (const command of ordered) {
                this.apply(command, direction, errors);
                completed.push(command);
            }
        } catch (cause) {
            const rollbackErrors: unknown[] = [];
            const inverse = direction === "undo" ? "redo" : "undo";
            for (const command of completed.reverse()) {
                try {
                    this.apply(command, inverse, errors);
                } catch (error) {
                    rollbackErrors.push(error);
                }
            }
            if (rollbackErrors.length > 0) {
                this.isFaulted = true;
                this.discard(errors);
                this.publish(errors);
            }
            throw new HistoryReplayError(cause, rollbackErrors);
        }
    }

    private addRecord(command: TCommand, label: string | undefined, errors: unknown[]): void {
        if (!this.transaction) {
            this.pushEntry({ commands: [command], label }, errors);
            return;
        }
        const previous = this.transaction.commands.at(-1);
        let merged: TCommand | undefined;
        if (this.transaction.commands.length > 0 && this.adapter.merge) {
            try {
                merged = this.adapter.merge(previous!, command);
            } catch (error) {
                errors.push(error);
            }
        }
        if (merged !== undefined) {
            this.transaction.commands[this.transaction.commands.length - 1] = merged;
            if (previous !== merged) {
                this.release(previous!, errors);
            }
            if (command !== merged) {
                this.release(command, errors);
            }
        } else {
            this.transaction.commands.push(command);
        }
    }

    private pushEntry(entry: HistoryEntry<TCommand>, errors: unknown[]): void {
        const discarded = this.redoEntries;
        this.redoEntries = [];
        this.undoEntries.push(entry);
        if (this.undoEntries.length > this.limit) {
            discarded.push(...this.undoEntries.splice(0, this.undoEntries.length - this.limit));
        }
        this.releaseEntries(discarded, errors);
    }

    private release(command: TCommand, errors: unknown[]): void {
        try {
            this.adapter.release?.(command);
        } catch (error) {
            errors.push(error);
        }
    }

    private releaseEntries(entries: readonly HistoryEntry<TCommand>[], errors: unknown[]): void {
        for (const entry of entries) {
            for (const command of entry.commands) {
                this.release(command, errors);
            }
        }
    }

    private discard(errors: unknown[]): void {
        const entries = [...this.undoEntries, ...this.redoEntries];
        if (this.transaction) {
            entries.push(this.transaction);
        }
        this.undoEntries = [];
        this.redoEntries = [];
        this.transaction = undefined;
        this.releaseEntries(entries, errors);
    }

    private makeState(): HistoryState {
        const available = !this.isDisposed && !this.isFaulted && !this.transaction;
        return Object.freeze({
            canUndo: !!available && this.undoEntries.length > 0,
            canRedo: !!available && this.redoEntries.length > 0,
            inTransaction: this.transaction !== undefined,
            undoDepth: this.undoEntries.length,
            redoDepth: this.redoEntries.length,
            undoLabel: this.undoEntries.at(-1)?.label,
            redoLabel: this.redoEntries.at(-1)?.label,
            transactionLabel: this.transaction?.label,
            disposed: this.isDisposed,
            faulted: this.isFaulted,
        });
    }

    private publish(errors: unknown[]): void {
        this.snapshot = this.makeState();
        for (const listener of [...this.listeners]) {
            if (!this.listeners.has(listener)) {
                continue;
            }
            try {
                listener(this.snapshot);
            } catch (error) {
                errors.push(error);
            }
        }
    }
}
