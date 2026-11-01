import type { Bounds, Coords, DrawHandle } from "../types";
import type { HitResult, HitTestRectOptions } from "./HitTester";
import { ItemCollection, type ItemKey } from "./ItemCollection";
import type { EngineInputEvent, EnginePointerEvent, EngineTool } from "./InputRouter";
import { translateItem, translationAnchor, type TranslatableItem } from "../utils/translateItem";
import { runAll } from "../utils/runAll";

/** A mutable model port. IDs must be unique across every source this adapter combines. */
export interface SelectionAdapter<T extends object> {
    idOf(hit: HitResult): ItemKey | undefined;
    get(id: ItemKey): T | undefined;
    /** Return the canonical immutable value stored by the model. */
    update(id: ItemKey, item: T): T;
    batch<R>(callback: () => R): R;
    subscribe(listener: () => void): () => void;
    translate(item: Readonly<T>, delta: Coords): T;
    anchor(item: Readonly<T>): Coords;
}

export interface ItemCollectionSelectionOptions<T extends TranslatableItem> {
    /** Only hits belonging to this registration are accepted. */
    handle: DrawHandle;
    translate?: (item: Readonly<T>, delta: Coords) => T;
    anchor?: (item: Readonly<T>) => Coords;
}

/** Bind one collection and draw handle without confusing equal keys in other draws. */
export function createItemCollectionSelectionAdapter<T extends TranslatableItem>(
    items: ItemCollection<T>,
    options: ItemCollectionSelectionOptions<T>,
): SelectionAdapter<T> {
    return {
        idOf: (hit) => (hit.handle.id === options.handle.id ? hit.key : undefined),
        get: (id) => items.get(id),
        update: (id, item) => items.update(id, () => item),
        batch: (callback) => items.batch(callback),
        subscribe: (listener) => items.subscribe(listener),
        translate: options.translate ?? translateItem<T>,
        anchor: options.anchor ?? translationAnchor,
    };
}

export interface SelectionEngine {
    hitTest(point: Coords): HitResult[];
    hitTestRect(bounds: Bounds, options?: HitTestRectOptions): HitResult[];
    requestRender(): void;
    getTool(): EngineTool | null;
    setTool(tool: EngineTool | null): void;
}

export interface SelectionTransform {
    readonly kind: "translate";
    readonly ids: readonly ItemKey[];
}

export interface SelectionSnapshot {
    readonly selectedIds: readonly ItemKey[];
    readonly phase: "idle" | "pending" | "marquee" | "translate";
    /** Raw/corner world coordinates, directly accepted by engine.hitTestRect. */
    readonly marquee: Readonly<Bounds> | null;
}

export interface SelectionControllerOptions<T extends object> {
    adapter: SelectionAdapter<T>;
    /** Positive world-unit steps. The picked item's anchor snaps; group offsets stay intact. */
    grid?: number | { x: number; y: number; origin?: Coords };
    /** Minimum screen-pixel movement before a drag or marquee. Default 4. */
    dragThresholdPx?: number;
    /** Default "intersect". */
    marqueeMode?: "intersect" | "contain";
    selectable?: (item: Readonly<T>, id: ItemKey) => boolean;
    /** Locked items can be selected but are excluded from translation. */
    locked?: (item: Readonly<T>, id: ItemKey) => boolean;
    onSelectionChange?: (selectedIds: readonly ItemKey[]) => void;
    onTransformStart?: (transform: SelectionTransform) => void;
    /** Paired once with each start, including cancellation/rollback. */
    onTransformEnd?: (transform: SelectionTransform & { readonly cancelled: boolean }) => void;
}

type SelectionMode = "replace" | "add" | "toggle";
type Press<T> = {
    start: EnginePointerEvent | null;
    beforeSelection: readonly ItemKey[];
    baseSelection: readonly ItemKey[];
    hit?: ItemKey;
    mode: SelectionMode;
    moved: boolean;
    originals: Map<ItemKey, T>;
    applied: Map<ItemKey, T>;
    anchor: Coords;
    delta: Coords;
    transform: SelectionTransform | null;
};

/**
 * Headless selection, marquee and group translation. Create it, then activate
 * with engine.setTool(controller). It owns no draw handles or application
 * callbacks; use styleOf and getSnapshot().marquee to paint feedback.
 */
export class SelectionController<T extends object> implements EngineTool {
    private selected: readonly ItemKey[] = Object.freeze([]);
    private snapshot: SelectionSnapshot = Object.freeze({ selectedIds: this.selected, phase: "idle", marquee: null });
    private listeners = new Set<() => void>();
    private press: Press<T> | null = null;
    private applying = false;
    private disposed = false;
    private unsubscribe: () => void;
    private grid: { x: number; y: number; origin: Coords } | null;
    private threshold: number;

    constructor(
        private engine: SelectionEngine,
        private options: SelectionControllerOptions<T>,
    ) {
        const grid = options.grid;
        this.grid =
            grid === undefined
                ? null
                : typeof grid === "number"
                  ? { x: grid, y: grid, origin: { x: 0, y: 0 } }
                  : { x: grid.x, y: grid.y, origin: grid.origin ?? { x: 0, y: 0 } };
        if (
            this.grid &&
            (![this.grid.x, this.grid.y].every((v) => Number.isFinite(v) && v > 0) ||
                !Number.isFinite(this.grid.origin.x) ||
                !Number.isFinite(this.grid.origin.y))
        ) {
            throw new RangeError("Selection grid steps must be positive and its origin finite");
        }
        this.threshold = options.dragThresholdPx ?? 4;
        if (!Number.isFinite(this.threshold) || this.threshold < 0) {
            throw new RangeError("dragThresholdPx must be non-negative and finite");
        }
        this.unsubscribe = options.adapter.subscribe(() => this.sourceChanged());
    }

    get selectedIds(): readonly ItemKey[] {
        return this.selected;
    }
    /** Stable until the next state change; suitable for useSyncExternalStore. */
    getSnapshot = (): SelectionSnapshot => this.snapshot;
    subscribe = (listener: () => void): (() => void) => {
        if (!this.disposed) {
            this.listeners.add(listener);
        }
        return () => {
            this.listeners.delete(listener);
        };
    };

    setSelection(ids: Iterable<ItemKey>): void {
        if (this.disposed) {
            return;
        }
        this.cancel();
        this.replaceSelection([...ids]);
    }

    clearSelection(): void {
        this.setSelection([]);
    }

    private canSelect(id: ItemKey): boolean {
        const item = this.options.adapter.get(id);
        return item !== undefined && this.options.selectable?.(item, id) !== false;
    }

    private replaceSelection(ids: readonly ItemKey[]): void {
        const next = [...new Set(ids)].filter((id) => this.canSelect(id));
        if (next.length === this.selected.length && next.every((id, index) => id === this.selected[index])) {
            return;
        }
        this.selected = Object.freeze(next);
        this.publish(this.snapshot.phase, this.snapshot.marquee, true);
    }

    private publish(
        phase = this.snapshot.phase,
        marquee: Readonly<Bounds> | null = this.snapshot.marquee,
        selectionChanged = false,
    ): void {
        this.snapshot = Object.freeze({
            selectedIds: this.selected,
            phase,
            marquee: marquee ? Object.freeze({ ...marquee }) : null,
        });
        runAll([
            () => this.engine.requestRender(),
            () => {
                if (selectionChanged) {
                    this.options.onSelectionChange?.(this.selected);
                }
            },
            ...this.listeners,
        ]);
    }

    private sourceChanged(): void {
        if (this.applying || this.disposed) {
            return;
        }
        if (this.press && [...this.press.applied].some(([id, value]) => this.options.adapter.get(id) !== value)) {
            this.cancel();
        }
        this.replaceSelection(this.selected);
    }

    handleInput(event: EngineInputEvent): boolean {
        if (this.disposed) {
            return false;
        }
        if (event.type === "pointercancel") {
            this.cancel();
            return false;
        }
        if (event.type === "keydown") {
            if (
                event.key.key === "Escape" &&
                this.press &&
                !event.key.ctrlKey &&
                !event.key.metaKey &&
                !event.key.altKey
            ) {
                this.cancel();
                return true;
            }
            return false;
        }
        if (event.type === "pointerleave") {
            return this.press !== null;
        }
        if (event.type === "pointerdown") {
            return this.begin(event);
        }
        const press = this.press;
        if (!press) {
            return false;
        }
        if (event.type === "pointermove") {
            this.move(event, press);
            return true;
        }
        this.move(event, press);
        if (this.press !== press) {
            return true;
        }
        if (!press.moved && press.mode === "replace") {
            this.replaceSelection(press.hit === undefined ? [] : [press.hit]);
        }
        if (this.press === press) {
            this.finish(false);
        }
        return true;
    }

    private begin(event: EnginePointerEvent): boolean {
        if (event.pointer.button !== undefined && event.pointer.button !== 0) {
            return false;
        }
        this.cancel();
        const beforeSelection = this.selected;
        const mode: SelectionMode =
            event.pointer.ctrlKey || event.pointer.metaKey ? "toggle" : event.pointer.shiftKey ? "add" : "replace";
        const hit = this.engine
            .hitTest(event.coords.raw)
            .map((candidate) => this.options.adapter.idOf(candidate))
            .find((id) => id !== undefined && this.canSelect(id));
        if (hit !== undefined) {
            if (mode === "toggle") {
                this.replaceSelection(
                    this.selected.includes(hit) ? this.selected.filter((id) => id !== hit) : [...this.selected, hit],
                );
            } else if (mode === "add" || !this.selected.includes(hit)) {
                this.replaceSelection(mode === "add" ? [...this.selected, hit] : [hit]);
            }
        }
        if (this.disposed || this.engine.getTool() !== this) {
            return true;
        }
        const originals = new Map<ItemKey, T>();
        if (hit !== undefined && this.selected.includes(hit)) {
            for (const id of this.selected) {
                const item = this.options.adapter.get(id);
                if (item && this.options.locked?.(item, id) !== true) {
                    originals.set(id, item);
                }
            }
        }
        const anchorItem = hit === undefined ? undefined : this.options.adapter.get(hit);
        this.press = {
            start: event,
            beforeSelection,
            baseSelection: this.selected,
            hit,
            mode,
            moved: false,
            originals,
            applied: new Map(originals),
            anchor: anchorItem ? this.options.adapter.anchor(anchorItem) : { x: 0, y: 0 },
            delta: { x: 0, y: 0 },
            transform: null,
        };
        this.publish("pending", null);
        return true;
    }

    private move(event: EnginePointerEvent, press: Press<T>): void {
        const initial = press.start;
        if (!initial) {
            return;
        }
        if (
            !press.moved &&
            Math.hypot(event.mouse.raw.x - initial.mouse.raw.x, event.mouse.raw.y - initial.mouse.raw.y) <
                this.threshold
        ) {
            return;
        }
        if (event.mouse.raw.x === initial.mouse.raw.x && event.mouse.raw.y === initial.mouse.raw.y && !press.moved) {
            return;
        }
        press.moved = true;
        if (press.hit === undefined) {
            const a = initial.coords.raw,
                b = event.coords.raw;
            const marquee = {
                minX: Math.min(a.x, b.x),
                minY: Math.min(a.y, b.y),
                maxX: Math.max(a.x, b.x),
                maxY: Math.max(a.y, b.y),
            };
            const hits = [
                ...new Set(
                    this.engine
                        .hitTestRect(marquee, { mode: this.options.marqueeMode })
                        .map((hit) => this.options.adapter.idOf(hit)),
                ),
            ].filter((id): id is ItemKey => id !== undefined && this.canSelect(id));
            const base = press.baseSelection;
            this.replaceSelection(
                press.mode === "replace"
                    ? hits
                    : press.mode === "add"
                      ? [...base, ...hits]
                      : [...base.filter((id) => !hits.includes(id)), ...hits.filter((id) => !base.includes(id))],
            );
            if (this.press === press) {
                this.publish("marquee", marquee);
            }
            return;
        }
        let delta = { x: event.coords.raw.x - initial.coords.raw.x, y: event.coords.raw.y - initial.coords.raw.y };
        if (this.grid) {
            const { x, y, origin } = this.grid;
            delta = {
                x: Math.round((press.anchor.x + delta.x - origin.x) / x) * x + origin.x - press.anchor.x,
                y: Math.round((press.anchor.y + delta.y - origin.y) / y) * y + origin.y - press.anchor.y,
            };
        }
        this.applyDelta(press, delta);
    }

    private applyDelta(press: Press<T>, delta: Coords): void {
        if (!press.originals.size) {
            return;
        }
        const adapter = this.options.adapter;
        if (
            [...press.applied].some(
                ([id, value]) =>
                    adapter.get(id) !== value || this.options.locked?.(value, id) === true || !this.canSelect(id),
            )
        ) {
            this.cancel();
            return;
        }
        if (delta.x === press.delta.x && delta.y === press.delta.y) {
            return;
        }
        // Prepare all geometry before entering an application's transaction.
        const updates = [...press.originals].map(([id, item]) => [id, adapter.translate(item, delta)] as const);
        if (!press.transform) {
            press.transform = Object.freeze({ kind: "translate", ids: Object.freeze([...press.originals.keys()]) });
            try {
                this.options.onTransformStart?.(press.transform);
            } catch (error) {
                this.cancel();
                throw error;
            }
            if (this.press !== press || this.disposed) {
                return;
            }
        }
        this.applying = true;
        try {
            adapter.batch(() => {
                for (const [id, item] of updates) {
                    press.applied.set(id, adapter.update(id, item));
                }
            });
        } catch (error) {
            this.applying = false;
            this.cancel();
            throw error;
        } finally {
            this.applying = false;
        }
        // Reentrant model subscribers may replace an item before batch returns.
        // Such changes belong to the application, never to this preview.
        if ([...press.applied].some(([id, item]) => adapter.get(id) !== item)) {
            this.cancel();
            return;
        }
        press.delta = delta;
        if (this.press === press) {
            this.publish("translate", null);
        }
    }

    /** Translate selected unlocked items once. Delta is world units; grid is for pointer drags only. */
    translateSelection(delta: Coords): void {
        if (this.disposed) {
            return;
        }
        if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) {
            throw new RangeError("Translation must be finite");
        }
        this.cancel();
        const originals = new Map<ItemKey, T>();
        for (const id of this.selected) {
            const item = this.options.adapter.get(id);
            if (item && this.canSelect(id) && this.options.locked?.(item, id) !== true) {
                originals.set(id, item);
            }
        }
        // Programmatic edits use the same lifecycle without fabricating pointer events.
        const press: Press<T> = {
            start: null,
            beforeSelection: this.selected,
            baseSelection: this.selected,
            mode: "replace",
            moved: false,
            originals,
            applied: new Map(originals),
            anchor: { x: 0, y: 0 },
            delta: { x: 0, y: 0 },
            transform: null,
        };
        this.press = press;
        try {
            this.applyDelta(press, delta);
        } finally {
            if (this.press === press) {
                this.finish(false);
            }
        }
    }

    private finish(cancelled: boolean): void {
        const press = this.press;
        if (!press) {
            return;
        }
        this.press = null;
        let selectionChanged = false;
        runAll([
            () => {
                if (!cancelled) {
                    return;
                }
                this.applying = true;
                try {
                    this.options.adapter.batch(() =>
                        runAll(
                            [...press.originals].map(([id, original]) => () => {
                                const current = this.options.adapter.get(id);
                                if (current === press.applied.get(id) && current !== original) {
                                    this.options.adapter.update(id, original);
                                }
                            }),
                        ),
                    );
                } finally {
                    this.applying = false;
                }
            },
            () => {
                if (!cancelled) {
                    return;
                }
                const next = press.beforeSelection.filter((id) => this.canSelect(id));
                selectionChanged =
                    next.length !== this.selected.length || next.some((id, index) => id !== this.selected[index]);
                if (selectionChanged) {
                    this.selected = Object.freeze(next);
                }
            },
            () => {
                this.snapshot = Object.freeze({ selectedIds: this.selected, phase: "idle", marquee: null });
                this.engine.requestRender();
            },
            // Close the transaction before notifying UI that can start another edit.
            () => {
                if (press.transform) {
                    this.options.onTransformEnd?.({ ...press.transform, cancelled });
                }
            },
            () => {
                if (selectionChanged) {
                    this.options.onSelectionChange?.(this.selected);
                }
            },
            ...this.listeners,
        ]);
    }

    /** Roll back this controller's preview; never overwrite an externally replaced/deleted item. */
    cancel(): void {
        this.finish(true);
    }

    dispose(): void {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        runAll([
            () => this.cancel(),
            () => this.unsubscribe(),
            () => this.listeners.clear(),
            () => {
                if (this.engine.getTool() === this) {
                    this.engine.setTool(null);
                }
            },
        ]);
    }
}
