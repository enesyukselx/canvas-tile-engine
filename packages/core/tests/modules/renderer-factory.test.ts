import { beforeEach, describe, expect, it, vi } from "vitest";
import { RendererFactory } from "../../src/modules/RendererFactory";
import { Config } from "../../src/modules/Config";
import type { CanvasTileEngineConfig, Coords } from "../../src/types";
import type { ICamera } from "../../src/modules/Camera";
import { CoordinateTransformer } from "../../src/modules/CoordinateTransformer";
import { Layer } from "../../src/modules/Layer";
import { ViewportState } from "../../src/modules/ViewportState";
import type { IRenderer } from "../../src/modules/Renderer/Renderer";

const ctorSpy = vi.fn();
let lastInstance: IRenderer | undefined;

vi.mock("../../src/modules/Renderer/CanvasRenderer", () => {
    function MockCanvasRenderer(this: unknown, ...args: unknown[]) {
        ctorSpy(...args);
        const instance: IRenderer = {
            init() {},
            render() {},
            resize() {},
            destroy() {},
        };
        lastInstance = instance;
        return instance;
    }

    return { CanvasRenderer: MockCanvasRenderer };
});

const baseConfig: CanvasTileEngineConfig = {
    renderer: "canvas",
    scale: 1,
    size: { width: 100, height: 80 },
};

const createCamera = (): ICamera => ({
    x: 0,
    y: 0,
    scale: 1,
    pan: vi.fn<(dx: number, dy: number) => void>(),
    zoom: vi.fn<(x: number, y: number, dy: number, rect: DOMRect) => void>(),
    getCenter: vi.fn<(w: number, h: number) => Coords>().mockReturnValue({ x: 0, y: 0 }),
    setCenter: vi.fn<(c: Coords, w: number, h: number) => void>(),
    adjustForResize: vi.fn<(dw: number, dh: number) => void>(),
    zoomByFactor: vi.fn<(factor: number, cx: number, cy: number) => void>(),
});

describe("RendererFactory", () => {
    beforeEach(() => {
        ctorSpy.mockClear();
        lastInstance = undefined;
    });

    it("creates a canvas renderer with provided dependencies", () => {
        const canvas = document.createElement("canvas");
        const config = new Config(baseConfig);
        const camera = createCamera();
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 80);
        const layers = new Layer();

        const renderer = RendererFactory.createRenderer("canvas", canvas, camera, transformer, config, viewport, layers);

        expect(renderer).toBe(lastInstance);
        expect(ctorSpy).toHaveBeenCalledTimes(1);
        expect(ctorSpy).toHaveBeenCalledWith(canvas, camera, transformer, config, viewport, layers);
    });

    it("throws for unsupported renderer types", () => {
        const canvas = document.createElement("canvas");
        const config = new Config(baseConfig);
        const camera = createCamera();
        const transformer = new CoordinateTransformer(camera);
        const viewport = new ViewportState(100, 80);
        const layers = new Layer();

        expect(() =>
            RendererFactory.createRenderer("webgl" as never, canvas, camera, transformer, config, viewport, layers)
        ).toThrowError(/Unsupported renderer type/);
    });

    it("checks supported renderer types", () => {
        expect(RendererFactory.isSupported("canvas")).toBe(true);
        expect(RendererFactory.isSupported("webgl")).toBe(false);
    });

    it("returns list of supported types", () => {
        expect(RendererFactory.getSupportedTypes()).toEqual(["canvas"]);
    });
});
