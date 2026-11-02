import { describe, expect, it, vi } from "vitest";
import { History, HistoryCommittedError, HistoryReplayError, type HistoryAdapter } from "../../src/modules/History";

interface Change {
    before: number;
    after: number;
}

function counter(
    options: { limit?: number; merge?: HistoryAdapter<Change>["merge"]; release?: (change: Change) => void } = {},
) {
    let value = 0;
    const history = new History<Change>({
        limit: options.limit,
        adapter: {
            redo(change) {
                if (value !== change.before) {
                    throw new Error("store conflict");
                }
                value = change.after;
            },
            undo(change) {
                if (value !== change.after) {
                    throw new Error("store conflict");
                }
                value = change.before;
            },
            merge: options.merge,
            release: options.release,
        },
    });
    return {
        history,
        get value() {
            return value;
        },
        edit(after: number, label?: string) {
            history.execute({ before: value, after }, label);
        },
        applyExternally(after: number) {
            const command = { before: value, after };
            value = after;
            return command;
        },
    };
}

describe("History", () => {
    it("supports application-owned commands, undo/redo labels, and already-applied records", () => {
        const store = counter();
        expect(store.history.undo()).toBe(false);
        store.edit(1, "First");
        store.history.record(store.applyExternally(2), "External store");
        expect(store.history.state).toMatchObject({ undoDepth: 2, redoDepth: 0, undoLabel: "External store" });
        expect(store.history.undo()).toBe(true);
        expect(store.value).toBe(1);
        expect(store.history.state.redoLabel).toBe("External store");
        expect(store.history.redo()).toBe(true);
        expect(store.value).toBe(2);
        store.history.undo();
        store.history.undo();
        expect(store.value).toBe(0);
        expect(store.history.canUndo).toBe(false);
    });

    it("lets a store subscription record every change without recording history's own replays", () => {
        let value = 0;
        const listeners = new Set<(change: Change) => void>();
        const set = (after: number) => {
            const change = { before: value, after };
            value = after;
            listeners.forEach((listener) => listener(change));
        };
        const history = new History<Change>({
            adapter: {
                redo: (change) => set(change.after),
                undo: (change) => set(change.before),
            },
        });
        listeners.add((change) => history.record(change));

        set(1);
        expect(history.state).toMatchObject({ undoDepth: 1, redoDepth: 0 });
        expect(history.undo()).toBe(true);
        expect(value).toBe(0);
        expect(history.state).toMatchObject({ undoDepth: 0, redoDepth: 1 });
        expect(history.redo()).toBe(true);
        expect(value).toBe(1);
        history.execute({ before: 1, after: 2 });
        expect(history.state).toMatchObject({ undoDepth: 2, redoDepth: 0 });
        history.beginTransaction();
        set(3);
        expect(history.cancel()).toBe(true);
        expect(value).toBe(2);
        expect(history.state).toMatchObject({ undoDepth: 2, redoDepth: 0, inTransaction: false });
    });

    it("keeps the state object and stays quiet while a transaction only accumulates commands", () => {
        const store = counter();
        const listener = vi.fn();
        store.history.subscribe(listener);
        store.history.beginTransaction("Drag");
        const state = store.history.state;
        expect(listener).toHaveBeenCalledTimes(1);
        for (let i = 1; i <= 5; i++) {
            store.history.record(store.applyExternally(i));
        }
        expect(store.history.state).toBe(state);
        expect(listener).toHaveBeenCalledTimes(1);
        store.history.commit();
        expect(listener).toHaveBeenCalledTimes(2);
        expect(store.history.state).toMatchObject({ undoDepth: 1, undoLabel: "Drag" });
    });

    it("groups a drag into one entry and reverses commands in the correct order", () => {
        const store = counter();
        store.history.beginTransaction("Move selection");
        store.edit(1);
        store.edit(2);
        store.edit(3);
        expect(store.value).toBe(3);
        expect(store.history.state).toMatchObject({ inTransaction: true, canUndo: false, undoDepth: 0 });
        expect(() => store.history.undo()).toThrow("commit or cancel");
        expect(() => store.history.redo()).toThrow("commit or cancel");
        expect(() => store.history.beginTransaction()).toThrow("already open");
        expect(store.history.commit()).toBe(true);
        expect(store.history.state).toMatchObject({ undoDepth: 1, undoLabel: "Move selection" });
        store.history.undo();
        expect(store.value).toBe(0);
        store.history.redo();
        expect(store.value).toBe(3);
    });

    it("keeps redo after canceled or empty gestures and invalidates it only on a committed edit", () => {
        const store = counter();
        store.edit(1);
        store.edit(2);
        store.history.undo();
        store.history.beginTransaction();
        store.edit(9);
        expect(store.history.state.redoDepth).toBe(1);
        expect(store.history.cancel()).toBe(true);
        expect(store.value).toBe(1);
        expect(store.history.canRedo).toBe(true);
        store.history.beginTransaction();
        expect(store.history.commit()).toBe(false);
        expect(store.history.canRedo).toBe(true);
        store.history.beginTransaction();
        store.edit(7);
        store.history.commit();
        expect(store.history.canRedo).toBe(false);
        expect(store.history.commit()).toBe(false);
        expect(store.history.cancel()).toBe(false);
        expect(store.history.redo()).toBe(false);
    });

    it("compacts transaction commands through an adapter and releases replaced records", () => {
        const release = vi.fn();
        const store = counter({
            release,
            merge: (previous, next) => ({ before: previous.before, after: next.after }),
        });
        store.history.beginTransaction("Brush");
        store.edit(1);
        store.edit(2);
        store.edit(3);
        expect(release).toHaveBeenCalledTimes(4);
        store.history.commit();
        store.history.undo();
        expect(store.value).toBe(0);
        store.history.redo();
        expect(store.value).toBe(3);
        store.history.clear();
        expect(release).toHaveBeenLastCalledWith({ before: 0, after: 3 });
    });

    it("bounds total retained entries and releases evictions, abandoned redo, cancellation, and disposal", () => {
        const release = vi.fn();
        const store = counter({ limit: 2, release });
        store.edit(1);
        store.edit(2);
        store.edit(3);
        expect(release.mock.calls.map(([change]) => change.after)).toEqual([1]);
        store.history.undo();
        store.edit(4);
        expect(release.mock.calls.map(([change]) => change.after)).toEqual([1, 3]);
        store.history.beginTransaction();
        store.edit(5);
        store.history.cancel();
        expect(store.value).toBe(4);
        store.history.dispose();
        store.history.dispose();
        expect(release.mock.calls.map(([change]) => change.after)).toEqual([1, 3, 5, 2, 4]);
        expect(store.history.state).toMatchObject({ disposed: true, undoDepth: 0, redoDepth: 0, canUndo: false });
        expect(() => store.edit(6)).toThrow("disposed");
        expect(() => store.history.subscribe(() => {})).toThrow("disposed");
        expect(store.value).toBe(4);
    });

    it("can disable retention without disabling edits or transaction cancellation", () => {
        const release = vi.fn();
        const store = counter({ limit: 0, release });
        store.edit(1);
        expect(store.value).toBe(1);
        expect(store.history.canUndo).toBe(false);
        store.history.beginTransaction();
        store.edit(2);
        store.history.cancel();
        expect(store.value).toBe(1);
        expect(release).toHaveBeenCalledTimes(2);
    });

    it("clears an open transaction without undoing the document", () => {
        const store = counter();
        store.edit(1);
        store.history.beginTransaction();
        store.edit(2);
        store.history.clear();
        expect(store.value).toBe(2);
        expect(store.history.state).toMatchObject({ undoDepth: 0, redoDepth: 0, inTransaction: false });
        store.edit(3);
        store.history.undo();
        expect(store.value).toBe(2);
    });

    it("does not record an atomic command that fails before commit", () => {
        const store = counter();
        store.edit(1);
        expect(() => store.history.execute({ before: 99, after: 2 })).toThrow("store conflict");
        expect(store.value).toBe(1);
        expect(store.history.state.undoDepth).toBe(1);
        store.history.undo();
        expect(store.value).toBe(0);
    });

    it("rejects an untracked external edit without overwriting it and allows a new baseline", () => {
        const store = counter();
        store.edit(1);
        store.applyExternally(9);
        expect(() => store.history.undo()).toThrow(HistoryReplayError);
        expect(store.value).toBe(9);
        expect(store.history.state).toMatchObject({ undoDepth: 1, redoDepth: 0, faulted: false });
        store.history.clear();
        store.edit(10);
        store.history.undo();
        expect(store.value).toBe(9);
    });

    it("compensates completed commands after a replay error and leaves the stack usable", () => {
        let value = 0;
        let fail = true;
        const history = new History<Change>({
            adapter: {
                redo: (change) => {
                    value = change.after;
                },
                undo: (change) => {
                    if (fail && change.after === 2) {
                        throw new Error("cannot undo second");
                    }
                    value = change.before;
                },
            },
        });
        history.beginTransaction();
        for (let after = 1; after <= 3; after++) {
            history.execute({ before: value, after });
        }
        history.commit();
        let error: unknown;
        try {
            history.undo();
        } catch (caught) {
            error = caught;
        }
        expect(error).toBeInstanceOf(HistoryReplayError);
        expect(error).toMatchObject({ restored: true, rollbackErrors: [] });
        expect(value).toBe(3);
        expect(history.state).toMatchObject({ undoDepth: 1, redoDepth: 0, faulted: false });
        fail = false;
        history.undo();
        expect(value).toBe(0);
    });

    it("faults and releases unusable entries if compensation fails, requiring an explicit new baseline", () => {
        let value = 0;
        let failing = false;
        const release = vi.fn();
        const history = new History<Change>({
            adapter: {
                redo(change) {
                    if (failing && change.after === 3) {
                        throw new Error("compensation failed");
                    }
                    value = change.after;
                },
                undo(change) {
                    if (failing && change.after === 2) {
                        throw new Error("undo failed");
                    }
                    value = change.before;
                },
                release,
            },
        });
        history.beginTransaction();
        for (let after = 1; after <= 3; after++) {
            history.execute({ before: value, after });
        }
        history.commit();
        failing = true;
        expect(() => history.undo()).toThrow(HistoryReplayError);
        expect(value).toBe(2);
        expect(history.state).toMatchObject({ faulted: true, canUndo: false, undoDepth: 0, redoDepth: 0 });
        expect(release).toHaveBeenCalledTimes(3);
        expect(() => history.beginTransaction()).toThrow("call clear()");
        history.clear();
        failing = false;
        history.execute({ before: value, after: 8 });
        history.undo();
        expect(value).toBe(2);
    });

    it("keeps an active transaction after a compensated cancellation failure", () => {
        let value = 0;
        let fail = false;
        const history = new History<Change>({
            adapter: {
                redo: (change) => {
                    value = change.after;
                },
                undo: (change) => {
                    if (fail) {
                        throw new Error("locked");
                    }
                    value = change.before;
                },
            },
        });
        history.beginTransaction("Pending");
        history.execute({ before: 0, after: 1 });
        fail = true;
        expect(() => history.cancel()).toThrow(HistoryReplayError);
        expect(history.inTransaction).toBe(true);
        expect(value).toBe(1);
        fail = false;
        history.cancel();
        expect(value).toBe(0);
    });

    it("advances stacks when adapters report observer errors after a committed model change", () => {
        let value = 0;
        const error = new Error("store observer");
        const history = new History<Change>({
            adapter: {
                redo(change) {
                    value = change.after;
                    throw new HistoryCommittedError([error]);
                },
                undo(change) {
                    value = change.before;
                    throw new HistoryCommittedError([error]);
                },
            },
        });
        expect(() => history.execute({ before: 0, after: 1 })).toThrow(HistoryCommittedError);
        expect(value).toBe(1);
        expect(history.state.undoDepth).toBe(1);
        expect(() => history.undo()).toThrow(HistoryCommittedError);
        expect(value).toBe(0);
        expect(history.state).toMatchObject({ undoDepth: 0, redoDepth: 1 });
        expect(() => history.redo()).toThrow(HistoryCommittedError);
        expect(value).toBe(1);
    });

    it("delivers state to remaining subscribers after an error and prevents reentrant controls", () => {
        const store = counter();
        const initial = store.history.state;
        const listener = vi.fn();
        const unsubscribe = store.history.subscribe(() => store.history.undo());
        store.history.subscribe(listener);
        expect(store.history.state).toBe(initial);
        expect(listener).not.toHaveBeenCalled();
        expect(() => store.edit(1)).toThrow(HistoryCommittedError);
        expect(store.value).toBe(1);
        expect(listener).toHaveBeenCalledExactlyOnceWith(store.history.state);
        expect(Object.isFrozen(store.history.state)).toBe(true);
        unsubscribe();
        store.history.undo();
        expect(store.value).toBe(0);
    });

    it("retains committed commands even when merge or release hooks throw", () => {
        const store = counter({
            merge: () => {
                throw new Error("merge failed");
            },
        });
        store.history.beginTransaction();
        store.edit(1);
        expect(() => store.edit(2)).toThrow(HistoryCommittedError);
        store.history.commit();
        store.history.undo();
        expect(store.value).toBe(0);

        const releasing = counter({
            limit: 1,
            release: () => {
                throw new Error("release failed");
            },
        });
        releasing.edit(1);
        expect(() => releasing.edit(2)).toThrow(HistoryCommittedError);
        expect(releasing.value).toBe(2);
        releasing.history.undo();
        expect(releasing.value).toBe(1);
    });

    it.each([-1, 0.5, NaN, Infinity])("rejects invalid retention limit %s", (limit) => {
        expect(() => counter({ limit })).toThrow("non-negative integer");
    });
});
