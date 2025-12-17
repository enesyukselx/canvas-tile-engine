import { describe, expect, it, vi } from "vitest";
import { Layer } from "../../src/modules/Layer";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";
import { Config } from "../../src/modules/Config";
import type { ICamera } from "../../src/modules/Camera";

const makeCtx = () => {
    const save = vi.fn();
    const restore = vi.fn();
    const ctx = { save, restore } as unknown as CanvasRenderingContext2D;
    return { ctx, save, restore };
};

const makeCamera = (): ICamera => ({
    x: 0,
    y: 0,
    scale: 1,
    pan: vi.fn(),
    zoom: vi.fn(),
    getCenter: vi.fn(),
    setCenter: vi.fn(),
    adjustForResize: vi.fn(),
    zoomByFactor: vi.fn(),
});

const makeDrawContext = () => {
    const { ctx, save, restore } = makeCtx();
    const camera = makeCamera();
    const transformer = new CoordinateTransformer(camera);
    const config = new Config({ scale: 1, size: { width: 100, height: 100 } }).get();
    return {
        dc: { ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } },
        save,
        restore,
    };
};

describe("Layer", () => {
    it("adds and draws callbacks in layer order with save/restore", () => {
        const layer = new Layer();
        const calls: string[] = [];
        const { dc, save, restore } = makeDrawContext();

        layer.add(2, () => calls.push("b1"));
        layer.add(1, () => calls.push("a1"));
        layer.add(2, () => calls.push("b2"));

        layer.drawAll(dc);

        expect(calls).toEqual(["a1", "b1", "b2"]);
        expect(save).toHaveBeenCalledTimes(3);
        expect(restore).toHaveBeenCalledTimes(3);
    });

    it("clears a specific layer", () => {
        const layer = new Layer();
        const { dc, save, restore } = makeDrawContext();
        const hit = vi.fn();

        layer.add(1, hit);
        layer.add(2, hit);
        layer.clear(1);
        layer.drawAll(dc);

        expect(hit).toHaveBeenCalledTimes(1); // only layer 2 remains
        expect(save).toHaveBeenCalledTimes(1);
        expect(restore).toHaveBeenCalledTimes(1);
    });

    it("clears all layers when no layer specified", () => {
        const layer = new Layer();
        const { dc, save, restore } = makeDrawContext();
        const hit = vi.fn();
        layer.add(1, hit);
        layer.add(2, hit);

        layer.clear();
        layer.drawAll(dc);

        expect(hit).not.toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
        expect(restore).not.toHaveBeenCalled();
    });

    it("skips missing layer entries gracefully", () => {
        const layer = new Layer();
        const { dc, save, restore } = makeDrawContext();
        // Inject a map entry with undefined callbacks to hit the guard
        const underlying = new Map<number, undefined>([[1, undefined]]);
        (layer as unknown as { layers: Map<number, undefined> }).layers = underlying;

        layer.drawAll(dc);
        expect(save).not.toHaveBeenCalled();
        expect(restore).not.toHaveBeenCalled();
    });
});
