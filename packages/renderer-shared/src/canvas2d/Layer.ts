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
 * Manages ordered draw callbacks for canvas rendering, generic over the full
 * draw context handed to callbacks. Plain Canvas2D renderers use
 * {@link DrawContext}; renderers with extra per-frame state (e.g. WebGL's
 * batched GL renderer alongside its 2D overlay) intersect their own fields
 * onto it.
 * @internal
 */
export class Layer<TDrawContext extends { ctx: { save(): void; restore(): void } }> {
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
                dc.ctx.save();
                fn(dc);
                dc.ctx.restore();
            }
        }
    }
}
