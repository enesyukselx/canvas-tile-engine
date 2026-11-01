import { describe, expect, expectTypeOf, it, vi } from "vitest";
import {
    ItemCollection,
    isItemCollection,
    type DrawItems,
    type ItemCollectionChange,
    type ItemKey,
    type ReadonlyItemCollection,
} from "../../src/modules/ItemCollection";
import type { Rect } from "../../src/types/draw-object";

interface Item {
    id: ItemKey;
    x: number;
    style?: { color: string; opacity?: number };
}

const collection = (items: readonly Item[] = []) => new ItemCollection(items, { keyOf: (item) => item.id });

describe("ItemCollection", () => {
    it("owns a stable dense backing array, preserving constructor item references", () => {
        const original = { id: "first", x: 0 };
        const input = [original];
        const source = collection(input);
        const items = source.items;

        source.insert({ id: "second", x: 1 });
        source.update("first", { x: 2 });
        source.remove("second");

        expect(source.items).toBe(items);
        expect(source.items).toEqual([{ id: "first", x: 2 }]);
        expect(source.size).toBe(1);
        expect(input).toEqual([original]);
        expect(original.x).toBe(0);
        expect(source.get("missing")).toBeUndefined();
        expect(source.keyAt(0)).toBe("first");
        expect(source.keyAt(1)).toBeUndefined();
        expect(source.keyAt(-1)).toBeUndefined();
    });

    it("rejects duplicate constructor keys and runtime keys outside string/number", () => {
        expect(() =>
            collection([
                { id: "a", x: 0 },
                { id: "a", x: 1 },
            ]),
        ).toThrow("duplicate key a");
        expect(() => new ItemCollection([{ x: 0 }], { keyOf: () => null as unknown as ItemKey })).toThrow(
            "keys must be strings or numbers",
        );
    });

    it("distinguishes string and numeric keys and uses Map equality for numeric keys", () => {
        const source = collection([
            { id: 1, x: 0 },
            { id: "1", x: 1 },
            { id: NaN, x: 2 },
            { id: 0, x: 3 },
        ]);
        source.update(NaN, { x: 4 });
        source.update(-0, { id: -0, x: 5 });
        expect(source.get(1)?.x).toBe(0);
        expect(source.get("1")?.x).toBe(1);
        expect(source.get(NaN)?.x).toBe(4);
        expect(source.get(0)?.x).toBe(5);
        expect(() => source.insert({ id: NaN, x: 6 })).toThrow("duplicate key");
    });

    it("applies shallow patches and immutable updaters without changing item order", () => {
        const first = { id: "a", x: 0, style: { color: "red", opacity: 0.5 } };
        const second = { id: "b", x: 1 };
        const source = collection([first, second]);
        const changes: ItemCollectionChange<Item>[] = [];
        source.subscribe((next) => changes.push(...next));

        const patched = source.update("a", { style: { color: "blue" } });
        const updated = source.update("a", (item) => ({ ...item, x: item.x + 3 }));
        const copied = source.update("a", (item) => item);

        expect(patched).toEqual({ id: "a", x: 0, style: { color: "blue" } });
        expect(updated).toEqual({ id: "a", x: 3, style: { color: "blue" } });
        expect(copied).toEqual(updated);
        expect(copied).not.toBe(updated);
        expect(source.items[0]).toBe(copied);
        expect(source.items[1]).toBe(second);
        expect(first).toEqual({ id: "a", x: 0, style: { color: "red", opacity: 0.5 } });
        expect(changes[0]).toEqual({ type: "update", key: "a", previous: first, item: patched, index: 0 });
    });

    it("fails invalid mutations before changing the backing array or notifying", () => {
        const source = collection([
            { id: "a", x: 0 },
            { id: "b", x: 1 },
        ]);
        const before = [...source.items];
        const listener = vi.fn();
        source.subscribe(listener);

        expect(() => source.insert({ id: "a", x: 8 })).toThrow("duplicate key a");
        expect(() => source.update("unknown", { x: 8 })).toThrow("unknown key unknown");
        expect(() => source.update("a", { id: "b", x: 8 })).toThrow("cannot change key");
        expect(() => source.update("a", (item) => ({ ...item, id: "new" }))).toThrow("cannot change key");
        expect(() => source.update("a", { id: null as unknown as ItemKey })).toThrow("keys must be");
        expect(source.remove("missing")).toBe(false);
        expect(source.items).toEqual(before);
        source.items.forEach((item, index) => expect(item).toBe(before[index]));
        expect(source.get("new")).toBeUndefined();
        expect(source.size).toBe(2);
        expect(listener).not.toHaveBeenCalled();
    });

    it("compacts removals, updates shifted indexes, and appends reinsertions", () => {
        const a = { id: "a", x: 0 };
        const source = collection([a, { id: "b", x: 1 }, { id: "c", x: 2 }]);
        const changes: ItemCollectionChange<Item>[] = [];
        source.subscribe((next) => changes.push(...next));

        expect(source.remove("a")).toBe(true);
        source.update("c", { x: 3 });
        source.insert(a);

        expect(source.items.map((item) => item.id)).toEqual(["b", "c", "a"]);
        expect([source.keyAt(0), source.keyAt(1), source.keyAt(2)]).toEqual(["b", "c", "a"]);
        expect(changes.map(({ type, key, index }) => ({ type, key, index }))).toEqual([
            { type: "remove", key: "a", index: 0 },
            { type: "update", key: "c", index: 1 },
            { type: "insert", key: "a", index: 2 },
        ]);
    });

    it("inserts at a dense position, preserving identity and shifted update indices", () => {
        const middle = { id: "middle", x: 1 };
        const source = collection([{ id: "last", x: 2 }]);
        const backing = source.items;
        const changes: ItemCollectionChange<Item>[] = [];
        source.subscribe((next) => changes.push(...next));
        source.insertAt(0, middle);
        source.insertAt(0, { id: "first", x: 0 });
        source.insertAt(source.size, { id: "append", x: 3 });
        source.update("last", { x: 4 });
        expect(source.items).toBe(backing);
        expect(source.items[1]).toBe(middle);
        expect(source.items.map((item) => item.id)).toEqual(["first", "middle", "last", "append"]);
        expect(changes.map(({ type, index }) => [type, index])).toEqual([
            ["insert", 0],
            ["insert", 0],
            ["insert", 3],
            ["update", 2],
        ]);
    });

    it("rejects invalid positional inserts without changing items or notifying", () => {
        const source = collection([{ id: "a", x: 0 }]);
        const original = source.get("a");
        const listener = vi.fn();
        source.subscribe(listener);
        for (const index of [-1, 2, 0.5, NaN, Infinity]) {
            expect(() => source.insertAt(index, { id: "b", x: 1 })).toThrow("insertion index");
        }
        expect(() => source.insertAt(0, { id: "a", x: 1 })).toThrow("duplicate key");
        expect(source.items).toEqual([original]);
        expect(source.items[0]).toBe(original);
        expect(listener).not.toHaveBeenCalled();
    });

    it("groups nested batches in mutation order and returns the callback result", () => {
        const source = collection([{ id: "a", x: 0 }]);
        const listener = vi.fn();
        source.subscribe(listener);

        const result = source.batch(() => {
            source.insert({ id: "b", x: 1 });
            source.batch(() => source.update("a", { x: 2 }));
            source.remove("b");
            expect(listener).not.toHaveBeenCalled();
            return 42;
        });

        expect(result).toBe(42);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].map((change: ItemCollectionChange<Item>) => change.type)).toEqual([
            "insert",
            "update",
            "remove",
        ]);
        source.batch(() => source.remove("missing"));
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("flushes successful changes when a batch callback fails, without rollback", () => {
        const source = collection();
        const callbackError = new Error("callback failed");
        const listener = vi.fn();
        source.subscribe(listener);

        expect(() =>
            source.batch(() => {
                source.insert({ id: "a", x: 0 });
                throw callbackError;
            }),
        ).toThrow(callbackError);

        expect(source.size).toBe(1);
        expect(listener).toHaveBeenCalledTimes(1);
        source.insert({ id: "b", x: 1 });
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it("queues reentrant changes until all current subscribers receive the earlier batch", () => {
        const source = collection();
        const calls: string[] = [];
        source.subscribe((changes) => {
            calls.push(`first:${String(changes[0].key)}`);
            if (changes[0].key === "a") {
                source.batch(() => {
                    source.insert({ id: "b", x: 1 });
                    source.update("b", { x: 2 });
                });
            }
        });
        source.subscribe((changes) => calls.push(`second:${changes.map((change) => change.key).join(",")}`));

        source.insert({ id: "a", x: 0 });

        expect(calls).toEqual(["first:a", "second:a", "first:b", "second:b,b"]);
        expect(source.items).toEqual([
            { id: "a", x: 0 },
            { id: "b", x: 2 },
        ]);
    });

    it("notifies every subscriber and queued batch before rethrowing the first listener error", () => {
        const source = collection();
        const firstError = new Error("first failure");
        const secondError = new Error("second failure");
        source.subscribe((changes) => {
            if (changes[0].key === "a") {
                source.insert({ id: "b", x: 1 });
            }
            throw firstError;
        });
        const observed = vi.fn();
        source.subscribe(observed);
        source.subscribe(() => {
            throw secondError;
        });

        expect(() => source.insert({ id: "a", x: 0 })).toThrow(firstError);

        expect(observed.mock.calls.map(([changes]) => changes[0].key)).toEqual(["a", "b"]);
        expect(source.size).toBe(2);
        expect(() => source.update("b", { x: 2 })).toThrow(firstError);
        expect(observed).toHaveBeenCalledTimes(3);
        expect(source.get("b")?.x).toBe(2);
    });

    it("preserves a batch callback error when a listener also throws", () => {
        const source = collection();
        const callbackError = new Error("callback failure");
        source.subscribe(() => {
            throw new Error("listener failure");
        });
        const observed = vi.fn();
        source.subscribe(observed);

        expect(() =>
            source.batch(() => {
                source.insert({ id: "a", x: 0 });
                throw callbackError;
            }),
        ).toThrow(callbackError);
        expect(observed).toHaveBeenCalledTimes(1);
    });

    it("unsubscribes idempotently and does not replay queued changes to new subscribers", () => {
        const source = collection();
        const late = vi.fn();
        const removed = vi.fn();
        let unsubscribe = () => {};
        source.subscribe((changes) => {
            if (changes[0].key === "a") {
                source.insert({ id: "b", x: 1 });
                source.subscribe(late);
                unsubscribe();
                unsubscribe();
            }
        });
        unsubscribe = source.subscribe(removed);

        source.insert({ id: "a", x: 0 });
        expect(removed).not.toHaveBeenCalled();
        expect(late).not.toHaveBeenCalled();
        source.insert({ id: "c", x: 2 });
        expect(late).toHaveBeenCalledTimes(1);
        expect(late.mock.calls[0][0][0].key).toBe("c");
    });

    it("delivers only the pending batch tail to subscribers added after earlier changes", () => {
        const source = collection();
        const early = vi.fn();
        const late = vi.fn();
        const afterLastChange = vi.fn();
        source.subscribe(early);
        let captured: readonly Item[] = [];

        source.batch(() => {
            source.insert({ id: "a", x: 0 });
            captured = [...source.items];
            source.subscribe(late);
            source.update("a", { x: 1 });
            source.insert({ id: "b", x: 2 });
            source.subscribe(afterLastChange);
        });

        expect(captured).toEqual([{ id: "a", x: 0 }]);
        expect(early.mock.calls[0][0].map((change: ItemCollectionChange<Item>) => change.type)).toEqual([
            "insert",
            "update",
            "insert",
        ]);
        expect(late.mock.calls[0][0].map((change: ItemCollectionChange<Item>) => change.type)).toEqual([
            "update",
            "insert",
        ]);
        expect(afterLastChange).not.toHaveBeenCalled();
        source.update("b", { x: 3 });
        expect(late).toHaveBeenCalledTimes(2);
        expect(afterLastChange).toHaveBeenCalledTimes(1);
    });

    it("recognizes only explicit live collections", () => {
        const source = collection();
        expect(isItemCollection(source)).toBe(true);
        for (const value of [null, undefined, [], new Set(), { items: [], subscribe() {} }, "items"]) {
            expect(isItemCollection(value)).toBe(false);
        }
    });

    it("exposes a covariant read-only source and unconstrained change types", () => {
        interface Seat {
            id: string;
        }
        const source = new ItemCollection<Rect<Seat>>([{ x: 0, y: 0, size: 1, data: { id: "a" } }], {
            keyOf: (item) => item.data!.id,
        });
        const readOnly: ReadonlyItemCollection<Rect> = source;
        const drawItems: DrawItems<Rect> = source;
        const listener: (changes: readonly ItemCollectionChange<unknown>[]) => void = vi.fn();
        readOnly.subscribe(listener);

        expectTypeOf<ReadonlyItemCollection<Rect<Seat>>>().toMatchTypeOf<ReadonlyItemCollection<Rect>>();
        expectTypeOf<ItemCollectionChange<Rect<Seat>>>().toMatchTypeOf<ItemCollectionChange<unknown>>();
        expect(drawItems).toBe(source);
    });
});
