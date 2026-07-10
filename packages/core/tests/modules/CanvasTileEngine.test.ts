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

    describe("setBounds", () => {
        it("fires onCoordsChange since bounds can clamp the camera", () => {
            // Engine starts centered at (0, 0); these bounds force a clamp.
            engine.setBounds({ minX: 1000, maxX: 3000, minY: 1000, maxY: 3000 });
            expect(onCoordsChange).toHaveBeenCalled();
            const coords = onCoordsChange.mock.calls[0][0];
            expect(coords.x).toBeGreaterThan(500);
            expect(coords.y).toBeGreaterThan(500);
        });
    });

    describe("gridAligned initial center snapping", () => {
        // Integers are cell centers (cell k spans [k-0.5, k+0.5]), so an even
        // tile count needs a half-integer center and an odd tile count needs
        // an integer center for pixel-perfect alignment.
        function centerFor(config: CanvasTileEngineConfig, center: Coords): Coords {
            const e = new CanvasTileEngine<Mount>({}, config, createMockRenderer(), center);
            return e.getCenterCoords();
        }

        const even = { scale: 15, size: { width: 300, height: 300 }, gridAligned: true }; // 20x20 tiles
        const odd = { scale: 20, size: { width: 380, height: 380 }, gridAligned: true }; // 19x19 tiles

        it("snaps an integer center down to the board center for even tile counts", () => {
            // A 0-based 20-cell board's true center is 9.5; a center computed
            // as N/2 = 10 must land there, not drift to 10.5.
            expect(centerFor(even, { x: 10, y: 10 })).toEqual({ x: 9.5, y: 9.5 });
        });

        it("keeps an already-aligned half-integer center for even tile counts", () => {
            expect(centerFor(even, { x: 9.5, y: 9.5 })).toEqual({ x: 9.5, y: 9.5 });
        });

        it("snaps to the nearest half-integer for even tile counts", () => {
            expect(centerFor(even, { x: 9.2, y: 9.8 })).toEqual({ x: 9.5, y: 9.5 });
            expect(centerFor(even, { x: 10.4, y: 10.6 })).toEqual({ x: 10.5, y: 10.5 });
        });

        it("snaps to the nearest integer for odd tile counts", () => {
            expect(centerFor(odd, { x: 9.4, y: 9.6 })).toEqual({ x: 9, y: 10 });
        });

        it("keeps an already-aligned integer center for odd tile counts", () => {
            expect(centerFor(odd, { x: 9, y: 9 })).toEqual({ x: 9, y: 9 });
        });

        it("does not snap when the tile count is not an integer", () => {
            const fractional = { scale: 7, size: { width: 300, height: 300 }, gridAligned: true };
            expect(centerFor(fractional, { x: 10.3, y: 10.3 })).toEqual({ x: 10.3, y: 10.3 });
        });

        it("does not snap when gridAligned is false", () => {
            const off = { ...even, gridAligned: false };
            expect(centerFor(off, { x: 10.3, y: 10.3 })).toEqual({ x: 10.3, y: 10.3 });
        });

        it("centers a gridToSize board exactly when its center is used", () => {
            // The fixed-board pattern: gridToSize + center => cells 0..N-1
            // exactly fill the viewport, i.e. visible world is [-0.5, N-0.5].
            const e = new CanvasTileEngine<Mount>({}, even, createMockRenderer(), { x: 9.5, y: 9.5 });
            expect(e.getVisibleBounds()).toEqual({ minX: -1, maxX: 20, minY: -1, maxY: 20 });
            expect(e.getCenterCoords()).toEqual({ x: 9.5, y: 9.5 });
        });
    });
});
