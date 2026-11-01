import { describe, expect, it, vi } from "vitest";
import { History, HistoryCommittedError, HistoryReplayError } from "../../src/modules/History";
import { ItemCollection } from "../../src/modules/ItemCollection";
import {
    attachItemCollectionHistory,
    createItemCollectionHistory,
    itemCollectionHistoryAdapter,
    type ItemCollectionHistoryCommand,
} from "../../src/modules/ItemCollectionHistory";

type Item = { id: string; x: number; extra?: string };
const items = (values: readonly Item[] = []) => new ItemCollection(values, { keyOf: (item) => item.id });

describe("ItemCollection history", () => {
    it("records collection edits automatically and restores exact object references and deleted fields", () => {
        const original = { id: "a", x: 0, extra: "original" };
        const source = items([original]);
        const history = createItemCollectionHistory(source);
        const next = source.update("a", () => ({ id: "a", x: 2 }));
        expect(history.canUndo).toBe(true);
        history.undo();
        expect(source.get("a")).toBe(original);
        history.redo();
        expect(source.get("a")).toBe(next);
        expect("extra" in source.get("a")!).toBe(false);
        source.remove("a");
        history.undo();
        expect(source.get("a")).toBe(next);
        history.undo();
        expect(source.get("a")).toBe(original);
    });

    it("restores keys, identities, and dense order after mixed membership and update batches", () => {
        const a = { id: "a", x: 0 };
        const b = { id: "b", x: 1 };
        const c = { id: "c", x: 2 };
        const d = { id: "d", x: 3 };
        const source = items([a, b, c]);
        const backing = source.items;
        const history = createItemCollectionHistory(source);
        source.batch(() => {
            source.remove("b");
            source.update("a", { x: 10 });
            source.insertAt(1, d);
            source.remove("c");
            source.insert(b);
        });
        const final = [...source.items];
        expect(final.map((item) => item.id)).toEqual(["a", "d", "b"]);
        expect(history.state.undoDepth).toBe(1);
        history.undo();
        expect(source.items).toBe(backing);
        expect(source.items).toEqual([a, b, c]);
        [a, b, c].forEach((item, index) => expect(source.items[index]).toBe(item));
        expect([0, 1, 2].map((index) => source.keyAt(index))).toEqual(["a", "b", "c"]);
        history.redo();
        final.forEach((item, index) => expect(source.items[index]).toBe(item));
    });

    it("compacts many brush updates into initial/final values per touched key", () => {
        const original = [
            { id: "a", x: 0 },
            { id: "b", x: 1 },
        ];
        const source = items(original);
        const history = createItemCollectionHistory(source);
        history.beginTransaction("Move two items");
        for (let x = 1; x <= 100; x++) {
            source.batch(() => {
                source.update("a", { x });
                source.update("b", { x: x + 1 });
            });
        }
        const final = [...source.items];
        history.commit();
        const listener = vi.fn();
        source.subscribe(listener);
        history.undo();
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0]).toHaveLength(2);
        original.forEach((item, index) => expect(source.items[index]).toBe(item));
        history.redo();
        final.forEach((item, index) => expect(source.items[index]).toBe(item));
        expect(history.state.undoDepth).toBe(1);
    });

    it("groups heterogeneous collections into a shared transaction using stable source IDs", () => {
        const seats = items([{ id: "seat", x: 0 }]);
        const labels = new ItemCollection([{ key: 4, text: "A" }], { keyOf: (item) => item.key });
        const history = new History({ adapter: itemCollectionHistoryAdapter });
        attachItemCollectionHistory(history, "seats", seats);
        attachItemCollectionHistory(history, "labels", labels);
        history.beginTransaction("Rename and move");
        seats.update("seat", { x: 8 });
        labels.update(4, { text: "B" });
        history.commit();
        history.undo();
        expect(seats.get("seat")?.x).toBe(0);
        expect(labels.get(4)?.text).toBe("A");
        history.redo();
        expect(seats.get("seat")?.x).toBe(8);
        expect(labels.get(4)?.text).toBe("B");
        expect(history.state.undoDepth).toBe(1);
    });

    it("preserves redo when a multi-source gesture is canceled", () => {
        const a = items([{ id: "a", x: 0 }]);
        const b = items([{ id: "b", x: 0 }]);
        const history = new History({ adapter: itemCollectionHistoryAdapter });
        attachItemCollectionHistory(history, "a", a);
        attachItemCollectionHistory(history, "b", b);
        a.update("a", { x: 1 });
        history.undo();
        history.beginTransaction();
        a.update("a", { x: 8 });
        b.remove("b");
        history.cancel();
        expect(a.get("a")?.x).toBe(0);
        expect(b.get("b")?.x).toBe(0);
        expect(history.canRedo).toBe(true);
        history.redo();
        expect(a.get("a")?.x).toBe(1);
    });

    it("records successful source mutations even when the collection batch callback throws", () => {
        const source = items();
        const history = createItemCollectionHistory(source);
        expect(() =>
            source.batch(() => {
                source.insert({ id: "a", x: 1 });
                throw new Error("brush interrupted");
            }),
        ).toThrow("brush interrupted");
        expect(history.canUndo).toBe(true);
        history.undo();
        expect(source.size).toBe(0);
    });

    it("keeps history usable after source and history observer failures", () => {
        const source = items([{ id: "a", x: 0 }]);
        const history = createItemCollectionHistory(source);
        const observerError = new Error("source observer");
        const unsubscribe = source.subscribe(() => {
            throw observerError;
        });
        const listener = vi.fn();
        source.subscribe(listener);
        expect(() => source.update("a", { x: 1 })).toThrow(observerError);
        expect(history.canUndo).toBe(true);
        expect(() => history.undo()).toThrow(HistoryCommittedError);
        expect(source.get("a")?.x).toBe(0);
        expect(history.state).toMatchObject({ undoDepth: 0, redoDepth: 1 });
        expect(listener).toHaveBeenCalledTimes(2);
        unsubscribe();
        history.redo();
        const unsubscribeHistory = history.subscribe(() => {
            throw new Error("UI observer");
        });
        expect(() => source.update("a", { x: 2 })).toThrow(HistoryCommittedError);
        expect(history.state.undoDepth).toBe(2);
        unsubscribeHistory();
        history.undo();
        expect(source.get("a")?.x).toBe(1);
    });

    it("rejects observer edits to any attached source during replay before mutation", () => {
        const a = items([{ id: "a", x: 0 }]);
        const b = items([{ id: "b", x: 0 }]);
        const history = new History({ adapter: itemCollectionHistoryAdapter });
        attachItemCollectionHistory(history, "a", a);
        attachItemCollectionHistory(history, "b", b);
        a.update("a", { x: 1 });
        const unsubscribeA = a.subscribe(() => a.update("a", { x: 99 }));
        const unsubscribeB = a.subscribe(() => b.update("b", { x: 99 }));
        expect(() => history.undo()).toThrow(HistoryCommittedError);
        expect(a.get("a")?.x).toBe(0);
        expect(b.get("b")?.x).toBe(0);
        expect(history.state).toMatchObject({ undoDepth: 0, redoDepth: 1 });
        unsubscribeA();
        unsubscribeB();
        history.redo();
        b.update("b", { x: 2 });
        expect(history.state.undoDepth).toBe(2);
    });

    it("rejects cross-source mutations from history state observers before an unrecorded edit can commit", () => {
        const a = items([{ id: "a", x: 0 }]);
        const b = items([{ id: "b", x: 0 }]);
        const history = new History({ adapter: itemCollectionHistoryAdapter });
        attachItemCollectionHistory(history, "a", a);
        attachItemCollectionHistory(history, "b", b);
        const unsubscribe = history.subscribe(() => b.update("b", { x: 5 }));
        expect(() => a.update("a", { x: 1 })).toThrow(HistoryCommittedError);
        expect(a.get("a")?.x).toBe(1);
        expect(b.get("b")?.x).toBe(0);
        expect(history.state.undoDepth).toBe(1);
        unsubscribe();
        history.undo();
        expect(a.get("a")?.x).toBe(0);
    });

    it("allows ordinary collection subscriber edits and records their queued deltas in order", () => {
        const source = items([{ id: "a", x: 0 }]);
        const unsubscribe = source.subscribe(() => {
            if (source.get("a")?.x === 1) {
                source.update("a", { x: 2 });
            }
        });
        const history = createItemCollectionHistory(source);
        source.update("a", { x: 1 });
        expect(history.state.undoDepth).toBe(2);
        unsubscribe();
        history.undo();
        expect(source.get("a")?.x).toBe(1);
        history.undo();
        expect(source.get("a")?.x).toBe(0);
    });

    it("preflights the whole delta batch before changing any item and resets replay mode after errors", () => {
        const a = { id: "a", x: 0 };
        const b = { id: "b", x: 0 };
        let fail = false;
        const source = new ItemCollection([a, b], {
            keyOf: (item) => {
                if (fail && item === a) {
                    throw new Error("external key policy changed");
                }
                return item.id;
            },
        });
        const history = createItemCollectionHistory(source);
        source.batch(() => {
            source.update("a", { x: 1 });
            source.update("b", { x: 2 });
        });
        const final = [...source.items];
        const listener = vi.fn();
        source.subscribe(listener);
        fail = true;
        expect(() => history.undo()).toThrow(HistoryReplayError);
        expect(listener).not.toHaveBeenCalled();
        final.forEach((item, index) => expect(source.items[index]).toBe(item));
        expect(history.state).toMatchObject({ undoDepth: 1, redoDepth: 0, faulted: false });
        fail = false;
        source.update("b", { x: 3 });
        history.undo();
        history.undo();
        expect(source.items).toEqual([a, b]);
    });

    it("compensates another source if a shared transaction cannot be replayed", () => {
        const original = { id: "a", x: 0 };
        let fail = false;
        const a = new ItemCollection([original], {
            keyOf: (item) => {
                if (fail && item === original) {
                    throw new Error("external conflict");
                }
                return item.id;
            },
        });
        const b = items([{ id: "b", x: 0 }]);
        const history = new History({ adapter: itemCollectionHistoryAdapter });
        attachItemCollectionHistory(history, "a", a);
        attachItemCollectionHistory(history, "b", b);
        history.beginTransaction();
        a.update("a", { x: 1 });
        const finalB = b.update("b", { x: 2 });
        history.commit();
        fail = true;
        expect(() => history.undo()).toThrow(HistoryReplayError);
        expect(a.get("a")?.x).toBe(1);
        expect(b.get("b")).toBe(finalB);
        expect(history.state).toMatchObject({ undoDepth: 1, redoDepth: 0 });
        fail = false;
        history.undo();
        expect(a.get("a")).toBe(original);
        expect(b.get("b")?.x).toBe(0);
    });

    it("requires history boundaries outside collection batches and notifications", () => {
        const source = items([{ id: "a", x: 0 }]);
        const history = createItemCollectionHistory(source);
        history.beginTransaction();
        expect(() =>
            source.batch(() => {
                source.update("a", { x: 1 });
                history.commit();
            }),
        ).toThrow("during a batch or notification");
        expect(history.inTransaction).toBe(true);
        history.commit();
        const unsubscribe = source.subscribe(() => history.undo());
        expect(() => source.update("a", { x: 2 })).toThrow("during a batch or notification");
        expect(history.state.undoDepth).toBe(2);
        unsubscribe();
        history.undo();
        expect(source.get("a")?.x).toBe(1);
    });

    it("starts at attachment time, including when attached halfway through a collection batch", () => {
        const source = items();
        let history!: History<ItemCollectionHistoryCommand>;
        source.batch(() => {
            source.insert({ id: "a", x: 0 });
            history = createItemCollectionHistory(source);
            source.insert({ id: "b", x: 1 });
        });
        history.undo();
        expect(source.items.map((item) => item.id)).toEqual(["a"]);
    });

    it("owns each collection once and rejects duplicate source IDs without leaving a subscription", () => {
        const source = items();
        const other = items();
        const history = createItemCollectionHistory(source, { sourceId: "source" });
        expect(() => createItemCollectionHistory(source)).toThrow("already has a history owner");
        expect(() => attachItemCollectionHistory(history, "source", other)).toThrow("duplicate sourceId");
        expect(() => attachItemCollectionHistory(history, "", other)).toThrow("must not be empty");
        other.insert({ id: "other", x: 0 });
        expect(history.canUndo).toBe(false);
        history.dispose();
        const replacement = createItemCollectionHistory(source);
        source.insert({ id: "a", x: 0 });
        expect(replacement.canUndo).toBe(true);
    });

    it("detaches sources and clears shared entries while keeping remaining sources tracked", () => {
        const a = items();
        const b = items();
        const history = new History({ adapter: itemCollectionHistoryAdapter });
        const detach = attachItemCollectionHistory(history, "a", a);
        attachItemCollectionHistory(history, "b", b);
        history.beginTransaction();
        a.insert({ id: "a", x: 0 });
        b.insert({ id: "b", x: 0 });
        history.commit();
        detach();
        detach();
        expect(history.canUndo).toBe(false);
        a.update("a", { x: 1 });
        expect(history.canUndo).toBe(false);
        b.update("b", { x: 1 });
        history.undo();
        expect(b.get("b")?.x).toBe(0);
        history.dispose();
        b.update("b", { x: 2 });
        expect(history.state.undoDepth).toBe(0);
    });
});
