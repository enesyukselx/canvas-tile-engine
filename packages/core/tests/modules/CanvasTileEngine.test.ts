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

    describe("hit testing through the engine draw API", () => {
        function createEngineWithDrawAPI() {
            let seq = 0;
            const drawAPI = {
                drawRect: (_items: unknown, layer: number = 1) => ({ id: Symbol(`rect-${seq++}`), layer }),
                drawCircle: (_items: unknown, layer: number = 1) => ({ id: Symbol(`circle-${seq++}`), layer }),
                drawImage: (_items: unknown, layer: number = 1) => ({ id: Symbol(`image-${seq++}`), layer }),
                drawStaticRect: (_items: unknown, _key: string, layer: number = 1) => ({
                    id: Symbol(`static-${seq++}`),
                    layer,
                }),
                removeDrawHandle: vi.fn(),
                clearLayer: vi.fn(),
                clearAll: vi.fn(),
            };
            const renderer = createMockRenderer();
            (renderer.getDrawAPI as ReturnType<typeof vi.fn>).mockReturnValue(drawAPI);
            return new CanvasTileEngine<Mount>({}, baseConfig, renderer);
        }

        // Event payloads report coords.raw in corner space: the cell of item k
        // spans [k, k+1] there (which is why snapped floors it). The engine
        // converts to item space internally, so these tests query in raw space -
        // the same values an onClick/onHover callback would receive.
        it("registers drawn items and finds them via hitTestFirst with raw coords", () => {
            const e = createEngineWithDrawAPI();
            e.drawRect({ x: 2, y: 2, size: 1 }, 1);

            // Raw center of cell (2,2) is (2.5, 2.5)
            const hit = e.hitTestFirst({ x: 2.5, y: 2.5 });
            expect(hit).toBeDefined();
            expect(hit!.kind).toBe("rect");
            expect(hit!.layer).toBe(1);
        });

        it("applies the raw-to-item half-cell offset at the API boundary", () => {
            const e = createEngineWithDrawAPI();
            e.drawRect({ x: 2, y: 2, size: 1 }, 1);

            // In raw space the item's cell spans [2, 3] on each axis
            expect(e.hitTestFirst({ x: 2.05, y: 2.05 })).toBeDefined();
            expect(e.hitTestFirst({ x: 2.95, y: 2.95 })).toBeDefined();
            // (1.95, 1.95) belongs to cell (1,1) - a hit here would mean the
            // offset was not applied
            expect(e.hitTestFirst({ x: 1.95, y: 1.95 })).toBeUndefined();
        });

        it("stops reporting items after removeDrawHandle and clearLayer", () => {
            const e = createEngineWithDrawAPI();
            const h = e.drawCircle({ x: 0, y: 0, size: 1 }, 2);
            e.drawRect({ x: 0, y: 0, size: 1 }, 3);

            expect(e.hitTest({ x: 0.5, y: 0.5 })).toHaveLength(2);

            e.removeDrawHandle(h);
            expect(e.hitTest({ x: 0.5, y: 0.5 })).toHaveLength(1);

            e.clearLayer(3);
            expect(e.hitTest({ x: 0.5, y: 0.5 })).toHaveLength(0);
        });

        it("includes static draw variants and clears everything on clearAll", () => {
            const e = createEngineWithDrawAPI();
            e.drawStaticRect([{ x: 1, y: 1, size: 1 }], "terrain", 0);

            expect(e.hitTestFirst({ x: 1.5, y: 1.5 })).toBeDefined();

            e.clearAll();
            expect(e.hitTestFirst({ x: 1.5, y: 1.5 })).toBeUndefined();
        });

        it("expands hit geometry with world-unit padding", () => {
            const e = createEngineWithDrawAPI();
            // Station-dot scenario: small marker, generous touch target
            e.drawCircle({ x: 0, y: 0, size: 0.95 }, 1);

            // Raw (1.5, 0.5) is 1.0 world units from the dot center; radius is 0.475
            expect(e.hitTestFirst({ x: 1.5, y: 0.5 })).toBeUndefined();
            expect(e.hitTestFirst({ x: 1.5, y: 0.5 }, { padding: 0.625 })).toBeDefined();
        });

        it("converts paddingPx with the current scale", () => {
            const e = createEngineWithDrawAPI();
            e.drawCircle({ x: 0, y: 0, size: 0.5 }, 1); // radius 0.25

            // Raw (1.2, 0.5) is 0.7 world units from the center -> needs 0.45+
            expect(e.hitTestFirst({ x: 1.2, y: 0.5 }, { paddingPx: 0.8 })).toBeDefined(); // scale 1 -> 0.8 world

            e.setScale(2);
            expect(e.hitTestFirst({ x: 1.2, y: 0.5 }, { paddingPx: 0.8 })).toBeUndefined(); // scale 2 -> 0.4 world
        });

        it("adds padding and paddingPx together", () => {
            const e = createEngineWithDrawAPI();
            e.drawCircle({ x: 0, y: 0, size: 0.5 }, 1); // radius 0.25
            e.setScale(2);

            // 0.3 world + 0.4px / scale 2 = 0.5 -> effective radius 0.75 covers 0.7
            expect(e.hitTestFirst({ x: 1.2, y: 0.5 }, { padding: 0.3, paddingPx: 0.4 })).toBeDefined();
            expect(e.hitTestFirst({ x: 1.2, y: 0.5 }, { padding: 0.3 })).toBeUndefined();
        });
    });
});
