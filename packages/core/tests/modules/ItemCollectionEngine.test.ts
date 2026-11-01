import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasTileEngine } from "../../src/CanvasTileEngine";
import { ItemCollection } from "../../src/modules/ItemCollection";
import { SpatialIndex } from "../../src/modules/SpatialIndex";
import { createItemCollectionHistory } from "../../src/modules/ItemCollectionHistory";
import type { DrawHandle, IDrawAPI, IRenderer, PathItem, Rect } from "../../src/types";

type Seat = Rect & { id: string };
const engines: CanvasTileEngine<Record<string, never>, unknown>[] = [];
const at = (x: number, y = 0) => ({ x: x + 0.5, y: y + 0.5 });

function createEngine(live = true) {
    const registered: { handle: DrawHandle; items: unknown }[] = [];
    const add = vi.fn((items: unknown, layer = 1) => {
        const handle = { id: Symbol(), layer };
        registered.push({ handle, items });
        return handle;
    });
    const applyDrawChanges = vi.fn();
    const removeDrawHandle = vi.fn();
    const draw = {
        drawRect: add,
        drawCircle: add,
        drawImage: add,
        drawText: add,
        drawPath: add,
        drawLine: (items: unknown, _style: unknown, layer = 1) => add(items, layer),
        removeDrawHandle,
        clearLayer: vi.fn(),
        clearAll: vi.fn(),
        clearStaticCache: vi.fn(),
        ...(live ? { applyDrawChanges } : {}),
    } as unknown as IDrawAPI<unknown>;
    const render = vi.fn();
    const renderer = {
        init: vi.fn(),
        setupEvents: vi.fn(),
        render,
        resize: vi.fn(),
        resizeWithAnimation: vi.fn(),
        destroy: vi.fn(),
        getDrawAPI: () => draw,
        getImageLoader: vi.fn(),
    } as unknown as IRenderer<Record<string, never>, unknown>;
    const engine = new CanvasTileEngine({}, { scale: 10, size: { width: 200, height: 200 } }, renderer);
    engines.push(engine);
    return { engine, add, registered, render, applyDrawChanges, removeDrawHandle };
}

function seats(count = 1) {
    return new ItemCollection<Seat>(
        Array.from({ length: count }, (_, i) => ({ id: String(i), x: i * 10, y: 0, size: 1 })),
        { keyOf: (item) => item.id },
    );
}

function frames() {
    const callbacks = new Map<number, FrameRequestCallback>();
    let next = 0;
    vi.stubGlobal(
        "requestAnimationFrame",
        vi.fn((callback: FrameRequestCallback) => {
            const id = ++next;
            callbacks.set(id, callback);
            return id;
        }),
    );
    vi.stubGlobal(
        "cancelAnimationFrame",
        vi.fn((id: number) => callbacks.delete(id)),
    );
    return {
        callbacks,
        flush() {
            const pending = [...callbacks.values()];
            callbacks.clear();
            pending.forEach((callback) => callback(0));
        },
    };
}

afterEach(() => {
    engines.splice(0).forEach((engine) => engine.destroy());
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("ItemCollection engine integration", () => {
    it("moves a single item in a warmed large index without rebuilding or replacing its draw handle", () => {
        const clock = frames();
        const { engine, add, render, registered } = createEngine();
        const source = seats(650);
        const handle = engine.drawRect(source, 2);
        expect(engine.hitTestFirst(at(0))).toMatchObject({ handle, key: "0", index: 0 });
        const load = vi.spyOn(SpatialIndex.prototype, "load");
        const view = registered[0].items;

        source.update("0", { x: -50 });

        expect(engine.hitTest(at(0))).toEqual([]);
        expect(engine.hitTestFirst(at(-50))).toMatchObject({ handle, key: "0", index: 0 });
        expect(engine.hitTestRect({ minX: -50.1, maxX: -49.9, minY: -0.1, maxY: 0.1 })[0]).toMatchObject({ key: "0" });
        expect(registered[0].items).toBe(view);
        expect(load).not.toHaveBeenCalled();
        expect(add).toHaveBeenCalledTimes(1);
        expect(render).not.toHaveBeenCalled();
        clock.flush();
        expect(render).toHaveBeenCalledTimes(1);
    });

    it("maintains keys, dense hit indices and paint order across a mixed batch", () => {
        frames();
        const { engine, applyDrawChanges } = createEngine();
        const source = seats(502);
        engine.drawRect(source);
        engine.hitTest(at(0));
        const load = vi.spyOn(SpatialIndex.prototype, "load");

        source.batch(() => {
            source.remove("0");
            source.update("1", { x: 50 });
            source.insert({ id: "last", x: 50, y: 0 });
            source.remove("5");
        });

        expect(engine.hitTest(at(50)).map(({ key, index }) => [key, index])).toEqual([
            ["last", 500],
            ["1", 0],
        ]);
        expect(applyDrawChanges).toHaveBeenCalledTimes(1);
        expect(load).not.toHaveBeenCalled();
    });

    it("keeps appends incremental and restores dense hit order for positional insertion and undo", () => {
        frames();
        const { engine, registered } = createEngine();
        const source = seats(502);
        const history = createItemCollectionHistory(source);
        engine.drawRect(source);
        engine.hitTest(at(0));
        const view = registered[0].items as Seat[];
        const map = vi.spyOn(view, "map");
        const load = vi.spyOn(SpatialIndex.prototype, "load");
        source.batch(() => {
            source.insert({ id: "appended-a", x: 0, y: 0 });
            source.insert({ id: "appended-b", x: 0, y: 0 });
        });
        expect(map).not.toHaveBeenCalled();
        expect(engine.hitTest(at(0)).map(({ key, index }) => [key, index])).toEqual([
            ["appended-b", 503],
            ["appended-a", 502],
            ["0", 0],
        ]);
        source.insertAt(0, { id: "behind", x: 0, y: 0 });
        expect(map).toHaveBeenCalledTimes(1);
        expect(engine.hitTest(at(0)).map(({ key, index }) => [key, index])).toEqual([
            ["appended-b", 504],
            ["appended-a", 503],
            ["0", 1],
            ["behind", 0],
        ]);
        history.undo();
        expect(engine.hitTestFirst(at(0))).toMatchObject({ key: "appended-b", index: 503 });
        history.redo();
        expect(view[0].id).toBe("behind");
        expect(engine.hitTest(at(0)).at(-1)).toMatchObject({ key: "behind", index: 0 });
        expect(load).not.toHaveBeenCalled();
    });

    it("grows world and pixel-sized hit bounds immediately and removes old bounds", () => {
        frames();
        const { engine } = createEngine();
        const source = seats(501);
        engine.drawRect(source);
        engine.hitTest(at(0));
        source.update("0", { x: -100, widthPx: 2000, heightPx: 20 });
        expect(engine.hitTestFirst(at(-190))?.key).toBe("0");
        source.update("0", { widthPx: undefined, heightPx: undefined, width: 300, height: 2 });
        expect(engine.hitTestFirst(at(-240))?.key).toBe("0");
        source.update("0", { width: 1, height: 1 });
        expect(engine.hitTest(at(-240))).toEqual([]);
        source.remove("0");
        expect(engine.hitTest(at(-100))).toEqual([]);
    });

    it("supports empty collections and threshold crossings without stale hits", () => {
        frames();
        const { engine } = createEngine();
        const source = seats(0);
        engine.drawCircle(source);
        source.batch(() => {
            for (let i = 0; i < 502; i++) {
                source.insert({ id: String(i), x: i * 10, y: 0 });
            }
        });
        expect(engine.hitTestFirst(at(0))?.key).toBe("0");
        source.remove("1");
        source.remove("2");
        source.update("0", { x: -5 });
        expect(engine.hitTestFirst(at(-5))?.key).toBe("0");
        source.insert({ id: "new", x: -10, y: 0 });
        expect(engine.hitTestFirst(at(-10))?.key).toBe("new");
        expect(engine.hitTest(at(0))).toEqual([]);
    });

    it("invalidates command-path geometry while preserving the registration", () => {
        frames();
        const { engine } = createEngine();
        const source = new ItemCollection<PathItem & { id: string }>(
            [
                {
                    id: "path",
                    commands: [
                        { type: "moveTo", x: 0, y: 0 },
                        { type: "lineTo", x: 2, y: 0 },
                    ],
                },
            ],
            { keyOf: (item) => item.id },
        );
        const handle = engine.drawPath(source);
        expect(engine.hitTestFirst(at(1))?.key).toBe("path");
        source.update("path", {
            commands: [
                { type: "moveTo", x: 30, y: 0 },
                { type: "lineTo", x: 32, y: 0 },
            ],
        });
        expect(engine.hitTest(at(1))).toEqual([]);
        expect(engine.hitTestFirst(at(31))).toMatchObject({ key: "path", handle });
    });

    it("shares one repaint across collections and registrations, with explicit render consuming it", () => {
        const clock = frames();
        const { engine, render, applyDrawChanges } = createEngine();
        const source = seats();
        const other = seats();
        engine.drawRect(source);
        engine.drawCircle(source, 2);
        engine.drawImage(new ItemCollection([{ id: "image", x: 0, y: 0, img: {} }], { keyOf: (item) => item.id }));
        engine.drawRect(other, 3);
        source.batch(() => {
            source.update("0", { x: 1 });
            source.update("0", { x: 2 });
        });
        other.update("0", { x: 3 });
        engine.requestRender();
        expect(applyDrawChanges).toHaveBeenCalledTimes(3);
        expect(clock.callbacks.size).toBe(1);
        engine.render();
        clock.flush();
        expect(render).toHaveBeenCalledTimes(1);
    });

    it("refreshes a previously cached path inserted after an unregistered edit", () => {
        frames();
        const { engine } = createEngine();
        const path: PathItem & { id: string } = {
            id: "reused",
            commands: [
                { type: "moveTo", x: 0, y: 0 },
                { type: "lineTo", x: 2, y: 0 },
            ],
        };
        const old = engine.drawPath(path);
        expect(engine.hitTestFirst(at(1))).toBeDefined();
        engine.removeDrawHandle(old);
        path.commands = [
            { type: "moveTo", x: 30, y: 0 },
            { type: "lineTo", x: 32, y: 0 },
        ];
        const source = new ItemCollection<PathItem & { id: string }>([], { keyOf: (item) => item.id });
        engine.drawPath(source);
        source.insert(path);
        expect(engine.hitTest(at(1))).toEqual([]);
        expect(engine.hitTestFirst(at(31))?.key).toBe("reused");
    });

    it.each(["remove", "replace", "layer", "all", "destroy"] as const)("detaches subscriptions on %s", (cleanup) => {
        const clock = frames();
        const { engine, applyDrawChanges } = createEngine();
        const source = seats();
        const handle = engine.drawRect(source, 2, { id: "live" });
        if (cleanup === "remove") {
            engine.removeDrawHandle(handle);
        }
        if (cleanup === "replace") {
            engine.drawCircle({ x: 100, y: 0 }, 2, { id: "live" });
        }
        if (cleanup === "layer") {
            engine.clearLayer(2);
        }
        if (cleanup === "all") {
            engine.clearAll();
        }
        if (cleanup === "destroy") {
            engine.destroy();
        }
        source.update("0", { x: 5 });
        expect(applyDrawChanges).not.toHaveBeenCalled();
        expect(clock.callbacks.size).toBe(0);
        expect(engine.hitTest(at(5))).toEqual([]);
    });

    it("keeps independent engine subscriptions alive after one engine is destroyed", () => {
        const clock = frames();
        const first = createEngine();
        const second = createEngine();
        const source = seats();
        first.engine.drawRect(source);
        second.engine.drawRect(source);
        source.update("0", { x: 1 });
        first.engine.destroy();
        source.update("0", { x: 2 });
        clock.flush();
        expect(first.render).not.toHaveBeenCalled();
        expect(second.render).toHaveBeenCalledTimes(1);
        expect(second.engine.hitTestFirst(at(2))?.key).toBe("0");
    });

    it("uses a microtask without requestAnimationFrame and cancels it on destroy", async () => {
        vi.stubGlobal("requestAnimationFrame", undefined);
        const first = createEngine();
        first.engine.requestRender();
        first.engine.requestRender();
        expect(first.render).not.toHaveBeenCalled();
        await Promise.resolve();
        expect(first.render).toHaveBeenCalledTimes(1);
        first.engine.requestRender();
        first.engine.destroy();
        await Promise.resolve();
        expect(first.render).toHaveBeenCalledTimes(1);
    });

    it("rejects an unsupported renderer before replacing an existing id", () => {
        const { engine, removeDrawHandle } = createEngine(false);
        engine.drawRect({ x: 0, y: 0 }, 1, { id: "stable" });
        expect(() => engine.drawRect(seats(), 1, { id: "stable" })).toThrow("applyDrawChanges");
        expect(removeDrawHandle).not.toHaveBeenCalled();
        expect(engine.hitTestFirst(at(0))).not.toHaveProperty("key");
    });

    it("preserves clipping, visibility and interaction rules after updates", () => {
        frames();
        const { engine } = createEngine();
        const source = seats();
        engine.drawRect(source, 1, {
            clip: { minX: -1, maxX: 5, minY: -1, maxY: 1 },
            visibleOf: (item) => item.x !== 2,
            interactiveOf: (item) => item.x !== 3,
        });
        for (const x of [2, 3, 6]) {
            source.update("0", { x });
            expect(engine.hitTest(at(x))).toEqual([]);
        }
        source.update("0", { x: 4 });
        expect(engine.hitTestFirst(at(4))?.key).toBe("0");
    });

    it("keeps a registration coherent when an earlier listener mutates and queries reentrantly", () => {
        frames();
        const { engine, registered } = createEngine();
        const source = seats(501);
        let entered = false;
        source.subscribe(() => {
            if (entered) {
                return;
            }
            entered = true;
            source.insert({ id: "nested", x: -20, y: 0 });
            // Warm the index before the engine receives either queued change.
            expect(engine.hitTestFirst(at(0))?.key).toBe("0");
            engine.render();
        });
        engine.drawRect(source);
        const view = registered[0].items;
        source.update("0", { x: -10 });
        expect(engine.hitTest(at(0))).toEqual([]);
        expect(engine.hitTest(at(-10)).map((hit) => hit.key)).toEqual(["0"]);
        expect(engine.hitTest(at(-20)).map((hit) => hit.key)).toEqual(["nested"]);
        expect(registered[0].items).toBe(view);
        expect(view).toEqual(source.items);
    });

    it("attaches midway through a batch without replaying changes already in its initial view", () => {
        frames();
        const { engine, registered } = createEngine();
        const source = seats(0);
        source.batch(() => {
            source.insert({ id: "a", x: 0, y: 0 });
            engine.drawRect(source);
            source.insert({ id: "b", x: 10, y: 0 });
        });
        expect(registered[0].items).toEqual(source.items);
        expect(engine.hitTest(at(0)).map((hit) => hit.key)).toEqual(["a"]);
        expect(engine.hitTest(at(10)).map((hit) => hit.key)).toEqual(["b"]);
    });
});
