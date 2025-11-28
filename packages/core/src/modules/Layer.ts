import { Coords, CanvasTileEngineConfig } from "../types";
import { ICamera } from "./Camera";
import { CoordinateTransformer } from "./CoordinateTransformer";

type DrawContext = {
    ctx: CanvasRenderingContext2D;
    camera: ICamera;
    transformer: CoordinateTransformer;
    config: Required<CanvasTileEngineConfig>;
    topLeft: Coords;
};

export type DrawCallback = (dc: DrawContext) => void;

/**
 * Manages ordered draw callbacks for canvas rendering.
 * @internal
 */
export class Layer {
    private layers = new Map<number, DrawCallback[]>();

    /**
     * Register a draw callback at a specific layer index.
     * @param layer Layer order; lower numbers draw first.
     * @param fn Callback receiving drawing context.
     */
    add(layer: number, fn: DrawCallback) {
        if (!this.layers.has(layer)) this.layers.set(layer, []);
        this.layers.get(layer)!.push(fn);
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
    drawAll(dc: DrawContext) {
        const keys = [...this.layers.keys()].sort((a, b) => a - b);
        for (const layer of keys) {
            const fns = this.layers.get(layer);
            if (!fns) continue;
            for (const fn of fns) {
                dc.ctx.save();
                fn(dc);
                dc.ctx.restore();
            }
        }
    }
}
