import { CanvasTileEngineConfig, CoordinateTransformer, Coords, ICamera } from "@canvas-tile-engine/core";
import type { SkCanvas } from "@shopify/react-native-skia";

/**
 * Drawing context passed to every layer callback. The Skia canvas is recorded
 * into a picture once per frame, so callbacks draw immediately and in order.
 * @internal
 */
export type DrawContext = {
    canvas: SkCanvas;
    camera: ICamera;
    transformer: CoordinateTransformer;
    config: Required<CanvasTileEngineConfig>;
    topLeft: Coords;
};

/** @internal */
export type DrawCallback = (dc: DrawContext) => void;

export interface DrawHandle {
    layer: number;
    id: symbol;
}

/**
 * Manages ordered draw callbacks for Skia rendering.
 * @internal
 */
export class Layer {
    private layers = new Map<number, { id: symbol; fn: DrawCallback }[]>();

    add(layer: number, fn: DrawCallback): DrawHandle {
        const id = Symbol("layer-callback");
        const entry = { id, fn };
        if (!this.layers.has(layer)) this.layers.set(layer, []);
        this.layers.get(layer)!.push(entry);
        return { layer, id };
    }

    remove(handle: DrawHandle) {
        const list = this.layers.get(handle.layer);
        if (!list) return;
        this.layers.set(
            handle.layer,
            list.filter((entry) => entry.id !== handle.id)
        );
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
            for (const { fn } of fns) {
                const count = dc.canvas.save();
                fn(dc);
                dc.canvas.restoreToCount(count);
            }
        }
    }
}
