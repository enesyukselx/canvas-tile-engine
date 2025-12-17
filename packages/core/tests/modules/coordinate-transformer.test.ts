import { describe, expect, it } from "vitest";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";
import type { ICamera } from "../../src/modules/Camera";

const makeCamera = (x: number, y: number, scale: number): ICamera => ({
    x,
    y,
    scale,
    pan: () => {},
    zoom: () => {},
    getCenter: () => ({ x: 0, y: 0 }),
    setCenter: () => {},
    adjustForResize: () => {},
    zoomByFactor: () => {},
});

describe("CoordinateTransformer", () => {

    it("converts world to screen using camera offsets and scale", () => {
        const cam = makeCamera(1, 2, 2);
        const transformer = new CoordinateTransformer(cam);
        const screen = transformer.worldToScreen(3, 4);
        expect(screen).toEqual({ x: 5, y: 5 });
    });

    it("converts screen to world using camera offsets and scale", () => {
        const cam = makeCamera(-2, 1, 4);
        const transformer = new CoordinateTransformer(cam);
        const world = transformer.screenToWorld(8, 4);
        expect(world).toEqual({ x: 0, y: 2 });
    });
});
