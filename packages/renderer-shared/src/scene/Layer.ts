import { CanvasTileEngineConfig, CoordinateTransformer, Coords, DrawHandle, ICamera } from "@canvas-tile-engine/core";

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
 * Manages ordered draw callbacks, generic over the full draw context handed to
 * callbacks. Plain Canvas2D renderers use {@link DrawContext}; renderers with
 * extra per-frame state (e.g. WebGL's batched GL renderer alongside its 2D
 * overlay) intersect their own fields onto it. The Skia renderer uses it too —
 * nothing here touches a drawing API beyond save/restore.
 * @internal
 */
export class Layer<TDrawContext extends { ctx: LayerContext }> {
    private layers = new Map<number, { id: symbol; fn: DrawCallback<TDrawContext> }[]>();

    /**
     * Register a draw callback at a specific layer index.
     * @param layer Layer order; lower numbers draw first.
     * @param fn Callback receiving drawing context.
     */
    add(layer: number, fn: DrawCallback<TDrawContext>): DrawHandle {
        const id = Symbol("layer-callback");
        const entry = { id, fn };
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
            for (const { fn } of fns) {
                const count = dc.ctx.save();
                fn(dc);
                if (typeof count === "number" && dc.ctx.restoreToCount) {
                    dc.ctx.restoreToCount(count);
                } else {
                    dc.ctx.restore();
                }
            }
        }
    }
}
