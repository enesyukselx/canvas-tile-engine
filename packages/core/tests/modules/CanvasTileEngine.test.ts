import { beforeEach, describe, expect, it, vi } from "vitest";
import { CanvasTileEngine } from "../../src/CanvasTileEngine";
import type { CanvasTileEngineConfig, Coords, IRenderer } from "../../src/types";

type Mount = Record<string, never>;

function createMockRenderer(): IRenderer<Mount> {
    return {
        init: vi.fn(),
        setupEvents: vi.fn(),
        render: vi.fn(),
        resize: vi.fn(),
        resizeWithAnimation: vi.fn(),
        destroy: vi.fn(),
        getDrawAPI: vi.fn(),
        getImageLoader: vi.fn(),
    } as unknown as IRenderer<Mount>;
}

const baseConfig: CanvasTileEngineConfig = {
    scale: 1,
    minScale: 0.5,
    maxScale: 2,
    size: { width: 800, height: 600 },
};

function createEngine(config: CanvasTileEngineConfig = baseConfig) {
    return new CanvasTileEngine<Mount>({}, config, createMockRenderer());
}

describe("CanvasTileEngine", () => {
    let engine: CanvasTileEngine<Mount>;
    let onZoom: ReturnType<typeof vi.fn<(scale: number) => void>>;
    let onCoordsChange: ReturnType<typeof vi.fn<(coords: Coords) => void>>;

    beforeEach(() => {
        engine = createEngine();
        onZoom = vi.fn<(scale: number) => void>();
        onCoordsChange = vi.fn<(coords: Coords) => void>();
        engine.onZoom = onZoom;
        engine.onCoordsChange = onCoordsChange;
    });

    describe("programmatic zoom fires onZoom", () => {
        it("fires onZoom when setScale changes the scale", () => {
            engine.setScale(1.5);
            expect(onZoom).toHaveBeenCalledWith(1.5);
        });

        it("does not fire onZoom when setScale leaves the scale unchanged", () => {
            engine.setScale(1);
            expect(onZoom).not.toHaveBeenCalled();
        });

        it("fires onZoom on zoomIn with the clamped scale", () => {
            engine.zoomIn(10); // clamped to maxScale 2
            expect(onZoom).toHaveBeenCalledWith(2);
        });

        it("does not fire onZoom when zoomIn is already clamped at maxScale", () => {
            engine.setScale(2);
            onZoom.mockClear();
            engine.zoomIn();
            expect(onZoom).not.toHaveBeenCalled();
        });

        it("fires onZoom on zoomOut", () => {
            engine.zoomOut(2); // 1 / 2 = 0.5
            expect(onZoom).toHaveBeenCalledWith(0.5);
        });
    });
});
