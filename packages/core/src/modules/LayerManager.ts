import type { CanvasGridMapConfig, Coords } from "../types";
import type { Camera } from "./Camera";
import type { CoordinateTransformer } from "./CoordinateTransformer";

export type DrawContext = {
    ctx: CanvasRenderingContext2D;
    camera: Camera;
    transformer: CoordinateTransformer;
    config: Required<CanvasGridMapConfig>;
    topLeft: Coords;
};

type DrawFn = (dc: DrawContext) => void;

export class LayerManager {
    private layers = new Map<number, DrawFn[]>();

    add(layer: number, fn: DrawFn) {
        if (!this.layers.has(layer)) this.layers.set(layer, []);
        this.layers.get(layer)!.push(fn);
    }

    clear(layer?: number) {
        if (layer === undefined) {
            this.layers.clear();
            return;
        }
        this.layers.set(layer, []);
    }

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
