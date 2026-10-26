import {
    Bounds,
    CanvasTileEngineConfig,
    CoordinateTransformer,
    Coords,
    DrawHandle,
    ICamera,
} from "@canvas-tile-engine/core";

/** @internal */
export type DrawContext<TContext> = {
    ctx: TContext;
    camera: ICamera;
    transformer: CoordinateTransformer;
    config: Required<CanvasTileEngineConfig>;
    topLeft: Coords;
};

/** @internal */
export type DrawCallback<TDrawContext> = (dc: TDrawContext) => void;

/**
 * The save/restore surface {@link Layer} needs from a draw context — the only
 * part of it the layer manager touches.
 *
 * Canvas2D contexts return nothing from `save()`; Skia returns the save depth
 * and can restore straight back to it, which also unwinds any saves a callback
 * forgot to pop. Layer uses whichever the context offers.
 * @internal
 */
export interface LayerContext {
    save(): void | number;
    restore(): void;
    restoreToCount?(count: number): void;
}

/**
 * Applies a registration's clip rectangle and, when the platform needs it,
 * hands back a release function.
 *
 * The clip arrives in WORLD coordinates: this module stays free of any
 * coordinate math, and each renderer needs a different space anyway — CSS
 * pixels for a Canvas2D path clip, device pixels measured from the bottom for
 * a GL scissor. Contexts that unwind their clip through `restore()` return
 * nothing; state that lives outside the context stack (GL scissor) returns its
 * own teardown.
 * @internal
 */
export type ClipAdapter<TDrawContext> = (dc: TDrawContext, clip: Bounds) => (() => void) | void;

/**
 * Manages ordered draw callbacks, generic over the full draw context handed to
 * callbacks. Plain Canvas2D renderers use {@link DrawContext}; renderers with
 * extra per-frame state (e.g. WebGL's batched GL renderer alongside its 2D
 * overlay) intersect their own fields onto it. The Skia renderer uses it too —
 * nothing here touches a drawing API beyond save/restore.
 * @internal
 */
export class Layer<TDrawContext extends { ctx: LayerContext }> {
    private layers = new Map<number, { id: symbol; fn: DrawCallback<TDrawContext>; clip?: Bounds }[]>();

    /**
     * @param applyClip Platform hook for `add`'s clip argument. A renderer
     * that omits it simply draws unclipped.
     */
    constructor(private applyClip?: ClipAdapter<TDrawContext>) {}

    /**
     * Register a draw callback at a specific layer index.
     * @param layer Layer order; lower numbers draw first.
     * @param fn Callback receiving drawing context.
     * @param clip Optional world rectangle to confine the callback to.
     */
    add(layer: number, fn: DrawCallback<TDrawContext>, clip?: Bounds): DrawHandle {
        const id = Symbol("layer-callback");
        const entry = { id, fn, clip };
        if (!this.layers.has(layer)) {
            this.layers.set(layer, []);
        }
        this.layers.get(layer)!.push(entry);
        return { layer, id };
    }

    /**
     * Remove a previously registered callback.
     * Safe to call multiple times; no-op if not found.
     */
    remove(handle: DrawHandle) {
        const list = this.layers.get(handle.layer);
        if (!list) {
            return;
        }
        this.layers.set(
            handle.layer,
            list.filter((entry) => entry.id !== handle.id),
        );
    }

    /**
     * Clear callbacks for a layer or all layers.
     * @param layer Layer to clear; clears all when omitted.
     */
    clear(layer?: number) {
        if (layer === undefined) {
            this.layers.clear();
            return;
        }
        this.layers.set(layer, []);
    }

    /**
     * Draw all registered callbacks in layer order.
     * @param dc Drawing context shared with callbacks.
     */
    drawAll(dc: TDrawContext) {
        const keys = [...this.layers.keys()].sort((a, b) => a - b);
        for (const layer of keys) {
            const fns = this.layers.get(layer);
            if (!fns) {
                continue;
            }
            for (const { fn, clip } of fns) {
                const count = dc.ctx.save();
                // Applied inside the save/restore pair the callback already
                // runs in, so a context-stack clip unwinds itself and only
                // out-of-stack state needs the release below.
                const release = clip && this.applyClip ? this.applyClip(dc, clip) : undefined;
                fn(dc);
                if (release) {
                    release();
                }
                if (typeof count === "number" && dc.ctx.restoreToCount) {
                    dc.ctx.restoreToCount(count);
                } else {
                    dc.ctx.restore();
                }
            }
        }
    }
}
