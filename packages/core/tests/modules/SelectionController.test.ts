import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasTileEngine } from "../../src/CanvasTileEngine";
import { GestureProcessor, type NormalizedPointer } from "../../src/modules/GestureProcessor";
import { ItemCollection } from "../../src/modules/ItemCollection";
import {
    SelectionController,
    createItemCollectionSelectionAdapter,
    type SelectionControllerOptions,
} from "../../src/modules/SelectionController";
import type { IRenderer, IDrawAPI, Rect, RendererDependencies } from "../../src/types";

type Shape = Rect & { id: string; locked?: boolean; selectable?: boolean };
const engines: CanvasTileEngine<object, unknown>[] = [];
const pointer = (x: number, y = 0, modifiers: Partial<NormalizedPointer> = {}): NormalizedPointer => ({
    x: (x + 10) * 10,
    y: (y + 10) * 10,
    clientX: (x + 10) * 10,
    clientY: (y + 10) * 10,
    pointerType: "mouse",
    button: 0,
    buttons: 1,
    ...modifiers,
});

function setup(
    values: Shape[] = [
        { id: "a", x: 0, y: 0 },
        { id: "b", x: 3, y: 0 },
    ],
    options: Partial<SelectionControllerOptions<Shape>> = {},
) {
    let gestures!: GestureProcessor;
    const add = vi.fn((_items: unknown, layer = 1) => ({ id: Symbol(), layer }));
    const apply = vi.fn();
    const draw = { drawRect: add, applyDrawChanges: apply } as unknown as IDrawAPI<unknown>;
    const renderer: IRenderer<object, unknown> = {
        init(deps: RendererDependencies<object>) {
            gestures = new GestureProcessor(
                deps.camera,
                deps.config,
                deps.transformer,
                () => ({ x: 0, y: 0, left: 0, top: 0, width: 200, height: 200, right: 200, bottom: 200 }),
                () => renderer.onCameraChange?.(),
                deps.input,
            );
            gestures.onClick = (...args) => renderer.onClick?.(...args);
            gestures.onMouseDown = (...args) => renderer.onMouseDown?.(...args);
            gestures.onMouseUp = (...args) => renderer.onMouseUp?.(...args);
        },
        setupEvents() {},
        render: vi.fn(),
        resize() {},
        resizeWithAnimation() {},
        destroy() {},
        getDrawAPI: () => draw,
        getImageLoader: vi.fn(),
    };
    const engine = new CanvasTileEngine(
        {},
        {
            scale: 10,
            gridAligned: false,
            size: { width: 200, height: 200 },
            eventHandlers: { drag: true, click: true, zoom: true },
        },
        renderer,
    );
    engines.push(engine);
    const items = new ItemCollection(values, { keyOf: (item) => item.id });
    const handle = engine.drawRect(items);
    const start = vi.fn(),
        end = vi.fn(),
        change = vi.fn();
    const selection = new SelectionController(engine, {
        adapter: createItemCollectionSelectionAdapter(items, { handle }),
        locked: (item) => item.locked === true,
        selectable: (item) => item.selectable !== false,
        onTransformStart: start,
        onTransformEnd: end,
        onSelectionChange: change,
        ...options,
    });
    engine.setTool(selection);
    const click = (x: number, y = 0, modifiers: Partial<NormalizedPointer> = {}) => {
        gestures.handlePointerDown(pointer(x, y, modifiers));
        gestures.handlePointerUp(pointer(x, y, modifiers));
        gestures.handleClick(pointer(x, y, modifiers));
    };
    return { engine, items, handle, selection, gestures, click, start, end, change, apply, add };
}

afterEach(() => {
    engines.splice(0).forEach((engine) => engine.destroy());
    vi.restoreAllMocks();
});

describe("selection tools", () => {
    it("selects with additive and toggle modifiers without replacing callbacks or observers", () => {
        const { engine, selection, click } = setup();
        const legacy = vi.fn(),
            observer = vi.fn();
        engine.onClick = legacy;
        const unsubscribe = engine.subscribeInput(observer);
        click(0);
        expect(selection.selectedIds).toEqual(["a"]);
        click(3, 0, { shiftKey: true });
        expect(selection.selectedIds).toEqual(["a", "b"]);
        click(0, 0, { ctrlKey: true });
        expect(selection.selectedIds).toEqual(["b"]);
        click(0, 0, { metaKey: true });
        expect(selection.selectedIds).toEqual(["b", "a"]);
        expect(engine.onClick).toBe(legacy);
        expect(legacy).toHaveBeenCalledTimes(4);
        expect(observer).toHaveBeenCalledWith(
            expect.objectContaining({ type: "pointerdown", pointer: expect.objectContaining({ metaKey: true }) }),
            true,
        );
        unsubscribe();
        const count = observer.mock.calls.length;
        click(3);
        expect(selection.selectedIds).toEqual(["b"]);
        expect(observer).toHaveBeenCalledTimes(count);
    });

    it("filters by draw handle and falls through unselectable objects", () => {
        const { engine, selection, click } = setup([
            { id: "a", x: 0, y: 0 },
            { id: "top", x: 0, y: 0, selectable: false },
        ]);
        engine.drawRect(new ItemCollection([{ id: "a", x: 0, y: 0 }], { keyOf: (item) => item.id }), 10);
        click(0);
        expect(selection.selectedIds).toEqual(["a"]);
        selection.setSelection(["missing", "top", "a", "a"]);
        expect(selection.selectedIds).toEqual(["a"]);
    });

    it("computes marquee changes against the initial selection, exposes raw bounds, and cancels previews", () => {
        const { selection, gestures } = setup();
        selection.setSelection(["b"]);
        gestures.handlePointerDown(pointer(-1, -1, { ctrlKey: true }));
        gestures.handlePointerMove(pointer(1, 1));
        expect(selection.selectedIds).toEqual(["b", "a"]);
        expect(selection.getSnapshot()).toMatchObject({
            phase: "marquee",
            marquee: { minX: -0.5, maxX: 1.5, minY: -0.5, maxY: 1.5 },
        });
        gestures.handlePointerMove(pointer(4, 1));
        expect(selection.selectedIds).toEqual(["a"]);
        gestures.handlePointerMove(pointer(1, 1));
        expect(selection.selectedIds).toEqual(["b", "a"]);
        gestures.handleCancel();
        expect(selection.selectedIds).toEqual(["b"]);
        expect(selection.getSnapshot()).toMatchObject({ phase: "idle", marquee: null });
    });

    it("supports contained marquees and Shift union", () => {
        const { selection, gestures } = setup(undefined, { marqueeMode: "contain" });
        selection.setSelection(["b"]);
        gestures.handlePointerDown(pointer(-1, -1, { shiftKey: true }));
        gestures.handlePointerMove(pointer(0.1, 1));
        expect(selection.selectedIds).toEqual(["b"]);
        gestures.handlePointerUp(pointer(1, 1));
        expect(selection.selectedIds).toEqual(["b", "a"]);
    });

    it("moves a selected group once per batched update, snaps its anchor, and never pans the camera", () => {
        const { engine, selection, items, gestures, start, end, apply, add } = setup(
            [
                { id: "a", x: 0.2, y: 0 },
                { id: "b", x: 3.4, y: 0 },
            ],
            { grid: 1 },
        );
        selection.setSelection(["a", "b"]);
        const center = engine.getCenter();
        gestures.handlePointerDown(pointer(0.2));
        gestures.handlePointerMove(pointer(1.9));
        expect(items.get("a")?.x).toBeCloseTo(2);
        expect(items.get("b")?.x).toBeCloseTo(5.2);
        expect(engine.hitTestFirst({ x: 2.5, y: 0.5 })?.key).toBe("a");
        expect(gestures.trackingPointer).toBe(true);
        expect(gestures.dragging).toBe(false);
        gestures.handlePointerMove(pointer(3.1));
        gestures.handlePointerUp(pointer(3.1));
        expect(start).toHaveBeenCalledExactlyOnceWith({ kind: "translate", ids: ["a", "b"] });
        expect(end).toHaveBeenCalledExactlyOnceWith({ kind: "translate", ids: ["a", "b"], cancelled: false });
        expect(apply).toHaveBeenCalledTimes(2);
        expect(add).toHaveBeenCalledTimes(1);
        expect(engine.getCenter()).toEqual(center);
        expect(selection.selectedIds).toEqual(["a", "b"]);
    });

    it("keeps locked items selected but translates only unlocked objects", () => {
        const { selection, items, start, end, click } = setup([
            { id: "a", x: 0, y: 0 },
            { id: "b", x: 3, y: 0, locked: true },
        ]);
        selection.setSelection(["a", "b"]);
        selection.translateSelection({ x: 2, y: 1 });
        expect(items.get("a")).toMatchObject({ x: 2, y: 1 });
        expect(items.get("b")).toMatchObject({ x: 3, y: 0 });
        expect(start).toHaveBeenCalledExactlyOnceWith({ kind: "translate", ids: ["a"] });
        expect(end).toHaveBeenCalledExactlyOnceWith({ kind: "translate", ids: ["a"], cancelled: false });
        click(3);
        expect(selection.selectedIds).toEqual(["b"]);
        selection.translateSelection({ x: 3, y: 0 });
        selection.translateSelection({ x: 0, y: 0 });
        expect(start).toHaveBeenCalledTimes(1);
    });

    it.each(["cancel", "escape", "pinch", "switch", "dispose", "destroy"])(
        "rolls back and ends a transform once on %s",
        (cause) => {
            const { engine, selection, items, gestures, start, end } = setup();
            gestures.handlePointerDown(pointer(0));
            gestures.handlePointerMove(pointer(2));
            expect(items.get("a")?.x).toBe(2);
            if (cause === "cancel") {
                gestures.handleCancel();
            }
            if (cause === "escape") {
                expect(gestures.handleKeyDown({ key: "Escape" })).toBe(true);
            }
            if (cause === "pinch") {
                gestures.handleTouchStart([pointer(2), pointer(5)]);
            }
            if (cause === "switch") {
                engine.setTool(null);
            }
            if (cause === "dispose") {
                selection.dispose();
            }
            if (cause === "destroy") {
                engine.destroy();
            }
            expect(items.get("a")?.x).toBe(0);
            expect(start).toHaveBeenCalledTimes(1);
            expect(end).toHaveBeenCalledExactlyOnceWith({ kind: "translate", ids: ["a"], cancelled: true });
            gestures.handleCancel();
            selection.dispose();
            expect(end).toHaveBeenCalledTimes(1);
        },
    );

    it("does not overwrite external changes while restoring the rest of its preview", () => {
        const { selection, items, gestures, end } = setup();
        selection.setSelection(["a", "b"]);
        gestures.handlePointerDown(pointer(0));
        gestures.handlePointerMove(pointer(2));
        items.update("a", { x: 50 });
        expect(items.get("a")?.x).toBe(50);
        expect(items.get("b")?.x).toBe(3);
        expect(end).toHaveBeenCalledWith(expect.objectContaining({ cancelled: true }));
        items.remove("a");
        expect(selection.selectedIds).toEqual(["b"]);
    });

    it("aborts reentrant source edits before a drag can commit them as its own preview", () => {
        const { selection, items, gestures, end } = setup();
        selection.setSelection(["a", "b"]);
        let changed = false;
        items.subscribe(() => {
            if (!changed && items.get("a")?.x === 2) {
                changed = true;
                items.update("a", { x: 50 });
            }
        });
        gestures.handlePointerDown(pointer(0));
        gestures.handlePointerMove(pointer(2));
        expect(items.get("a")?.x).toBe(50);
        expect(items.get("b")?.x).toBe(3);
        expect(selection.getSnapshot().phase).toBe("idle");
        expect(end).toHaveBeenCalledExactlyOnceWith({ kind: "translate", ids: ["a", "b"], cancelled: true });
        gestures.handlePointerUp(pointer(2));
        expect(end).toHaveBeenCalledTimes(1);
    });

    it("closes lifecycle and detaches despite rollback and UI notification errors", () => {
        const { engine, selection, items, gestures, end } = setup();
        gestures.handlePointerDown(pointer(0));
        gestures.handlePointerMove(pointer(2));
        const off = items.subscribe(() => {
            if (items.get("a")?.x === 0) {
                throw new Error("rollback observer");
            }
        });
        const ui = vi.fn(() => {
            throw new Error("UI observer");
        });
        selection.subscribe(ui);
        expect(() => selection.dispose()).toThrow("rollback observer");
        expect(items.get("a")?.x).toBe(0);
        expect(selection.getSnapshot().phase).toBe("idle");
        expect(engine.getTool()).toBeNull();
        expect(end).toHaveBeenCalledExactlyOnceWith({ kind: "translate", ids: ["a"], cancelled: true });
        expect(ui).toHaveBeenCalledTimes(1);
        off();
        items.remove("a");
        expect(ui).toHaveBeenCalledTimes(1);
    });

    it("notifies state changes without item mutations and stops subscriptions on disposal", () => {
        const { engine, selection, items } = setup();
        const render = vi.spyOn(engine, "requestRender"),
            listener = vi.fn();
        const first = selection.getSnapshot();
        selection.subscribe(listener);
        selection.setSelection(["a"]);
        expect(selection.getSnapshot()).not.toBe(first);
        expect(selection.getSnapshot()).toBe(selection.getSnapshot());
        expect(render).toHaveBeenCalled();
        expect(listener).toHaveBeenCalledTimes(1);
        selection.dispose();
        expect(engine.getTool()).toBeNull();
        items.remove("a");
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it("does not resume pan after switching away during a captured press", () => {
        const { engine, gestures } = setup();
        const center = engine.getCenter();
        gestures.handlePointerDown(pointer(0));
        engine.setTool(null);
        gestures.handlePointerMove(pointer(5));
        gestures.handlePointerUp(pointer(5));
        expect(engine.getCenter()).toEqual(center);
        gestures.handlePointerDown(pointer(5));
        gestures.handlePointerMove(pointer(6));
        expect(engine.getCenter()).not.toEqual(center);
    });

    it.each(["escape", "switch", "toolbar"])(
        "suppresses click after %s cancellation even without a pointer move",
        (cause) => {
            const { engine, selection, gestures, click } = setup();
            const legacy = vi.fn();
            engine.onClick = legacy;
            gestures.handlePointerDown(pointer(0));
            if (cause === "escape") {
                gestures.handleKeyDown({ key: "Escape" });
            }
            if (cause === "switch") {
                engine.setTool(null);
            }
            if (cause === "toolbar") {
                selection.cancel();
            }
            gestures.handlePointerUp(pointer(0));
            gestures.handleClick(pointer(0));
            expect(legacy).not.toHaveBeenCalled();
            engine.setTool(selection);
            click(0);
            expect(legacy).toHaveBeenCalledTimes(1);
        },
    );
});
