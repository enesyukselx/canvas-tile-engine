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

    describe("setScale anchoring", () => {
        it("keeps the viewport center fixed, matching goScale", () => {
            engine.setCenter({ x: 12, y: 34 });
            engine.setScale(2);
            const after = engine.getCenter();
            expect(after.x).toBeCloseTo(12);
            expect(after.y).toBeCloseTo(34);
        });

        it("produces the same view as goScale with zero duration", () => {
            engine.setCenter({ x: 5, y: 7 });
            engine.setScale(1.5);
            const viaSet = { center: engine.getCenter(), scale: engine.getScale() };

            const other = createEngine();
            other.setCenter({ x: 5, y: 7 });
            other.goScale(1.5, 0);

            expect(other.getScale()).toBe(viaSet.scale);
            expect(other.getCenter().x).toBeCloseTo(viaSet.center.x);
            expect(other.getCenter().y).toBeCloseTo(viaSet.center.y);
        });
    });

    // Node has no requestAnimationFrame, so goScale completes instantly here;
    // frame-by-frame interpolation is covered by the AnimationController tests.
    describe("goScale", () => {
        it("reaches the target scale and fires onZoom", () => {
            engine.goScale(1.5, 0);
            expect(engine.getScale()).toBe(1.5);
            expect(onZoom).toHaveBeenCalledWith(1.5);
        });

        it("clamps the target to maxScale", () => {
            engine.goScale(10, 0);
            expect(engine.getScale()).toBe(2);
        });

        it("does not fire onZoom when already at the target scale", () => {
            engine.goScale(1, 0);
            expect(onZoom).not.toHaveBeenCalled();
        });

        it("keeps the viewport center fixed while zooming", () => {
            const before = engine.getCenter();
            engine.goScale(2, 0);
            const after = engine.getCenter();
            expect(after.x).toBeCloseTo(before.x);
            expect(after.y).toBeCloseTo(before.y);
        });

        it("calls onComplete when the animation finishes", () => {
            const onComplete = vi.fn();
            engine.goScale(1.5, 0, onComplete);
            expect(onComplete).toHaveBeenCalled();
        });

        it("rejects invalid scale values", () => {
            expect(() => engine.goScale(-1)).toThrow();
            expect(() => engine.goScale(NaN)).toThrow();
        });
    });

    describe("setScaleLimits", () => {
        it("updates the limits used by zoom clamping", () => {
            engine.setScaleLimits(0.5, 4);
            engine.setScale(3);
            expect(engine.getScale()).toBe(3);
        });

        it("reflects the new limits in getConfig", () => {
            engine.setScaleLimits(0.25, 8);
            const config = engine.getConfig();
            expect(config.minScale).toBe(0.25);
            expect(config.maxScale).toBe(8);
        });

        it("clamps the current scale into the new range and fires onZoom", () => {
            engine.setScaleLimits(1.5, 4);
            expect(engine.getScale()).toBe(1.5);
            expect(onZoom).toHaveBeenCalledWith(1.5);
        });

        it("does not fire onZoom when the current scale stays in range", () => {
            engine.setScaleLimits(0.25, 8);
            expect(onZoom).not.toHaveBeenCalled();
        });

        it("rejects invalid limits without touching the camera", () => {
            expect(() => engine.setScaleLimits(4, 2)).toThrow();
            expect(() => engine.setScaleLimits(0, 2)).toThrow();
            expect(() => engine.setScaleLimits(NaN, 2)).toThrow();
            engine.setScale(10); // still clamped by the original maxScale 2
            expect(engine.getScale()).toBe(2);
        });
    });

    describe("center API (getCenter / setCenter / goCenter)", () => {
        it("setCenter moves the view center instantly and fires onCoordsChange", () => {
            engine.setCenter({ x: 25, y: 40 });
            expect(engine.getCenter()).toEqual({ x: 25, y: 40 });
            expect(onCoordsChange).toHaveBeenCalledWith({ x: 25, y: 40 });
        });

        // Node has no requestAnimationFrame, so goCenter completes instantly.
        it("goCenter animates to the target center", () => {
            const onComplete = vi.fn();
            engine.goCenter(10, 20, 0, onComplete);
            expect(engine.getCenter()).toEqual({ x: 10, y: 20 });
            expect(onComplete).toHaveBeenCalled();
        });

        it("setCenter and goCenter reject non-finite coordinates", () => {
            expect(() => engine.setCenter({ x: NaN, y: 0 })).toThrow();
            expect(() => engine.goCenter(0, Infinity)).toThrow();
        });
    });

    describe("fitBounds", () => {
        // Wide limits so the fit math is observable without clamping.
        const wideLimits: CanvasTileEngineConfig = { ...baseConfig, minScale: 0.01, maxScale: 1000 };

        it("centers on the bounds and picks the scale that fits the tighter axis", () => {
            const e = createEngine(wideLimits);
            e.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, { durationMs: 0 });
            // min(800 / 100, 600 / 50) = 8
            expect(e.getScale()).toBe(8);
            expect(e.getCenter().x).toBeCloseTo(50);
            expect(e.getCenter().y).toBeCloseTo(25);
        });

        it("applies padding on every side", () => {
            const e = createEngine(wideLimits);
            e.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, { padding: 10, durationMs: 0 });
            // min(800 / 120, 600 / 70)
            expect(e.getScale()).toBeCloseTo(800 / 120);
        });

        it("paddingPx shrinks the viewport instead of growing the bounds", () => {
            const e = createEngine(wideLimits);
            e.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, { paddingPx: 40, durationMs: 0 });
            // min((800 - 80) / 100, (600 - 80) / 50) = 7.2
            expect(e.getScale()).toBeCloseTo(7.2);
        });

        it("paddingPx keeps the same pixel margin regardless of content size", () => {
            const e = createEngine(wideLimits);
            e.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, { paddingPx: 40, durationMs: 0 });
            const small = e.getScale();
            // 10x larger content, same paddingPx: margin stays 40px, so the
            // scale is exactly 10x smaller (world padding would need a manual
            // 10x to achieve this).
            e.fitBounds({ minX: 0, maxX: 1000, minY: 0, maxY: 500 }, { paddingPx: 40, durationMs: 0 });
            expect(e.getScale()).toBeCloseTo(small / 10);
        });

        it("paddingPx wins over world padding", () => {
            const e = createEngine(wideLimits);
            e.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, { padding: 10, paddingPx: 40, durationMs: 0 });
            expect(e.getScale()).toBeCloseTo(7.2); // not 800 / 120
        });

        it("clamps a paddingPx that would consume the viewport", () => {
            const e = createEngine(wideLimits);
            // 2 * 500 exceeds both viewport axes; the fit area floors at 1px
            // per axis and the result rides the scale limits instead of
            // going negative or non-finite.
            e.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, { paddingPx: 500, durationMs: 0 });
            expect(e.getScale()).toBe(0.01); // wideLimits minScale
        });

        it("clamps the scale to the limits", () => {
            engine.fitBounds({ minX: 0, maxX: 1, minY: 0, maxY: 1 }, { durationMs: 0 });
            expect(engine.getScale()).toBe(2); // maxScale
            engine.fitBounds({ minX: -10000, maxX: 10000, minY: -10000, maxY: 10000 }, { durationMs: 0 });
            expect(engine.getScale()).toBe(0.5); // minScale
        });

        it("respects limits updated via setScaleLimits", () => {
            engine.setScaleLimits(0.5, 4);
            engine.fitBounds({ minX: 0, maxX: 1, minY: 0, maxY: 1 }, { durationMs: 0 });
            expect(engine.getScale()).toBe(4);
        });

        it("fires onZoom and onCoordsChange", () => {
            engine.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, { durationMs: 0 });
            expect(onZoom).toHaveBeenCalledWith(2); // clamped to maxScale
            expect(onCoordsChange).toHaveBeenCalled();
        });

        // Node has no requestAnimationFrame, so the animated path (default
        // 500ms) completes instantly here.
        it("animated fit reaches the target and calls onComplete", () => {
            const onComplete = vi.fn();
            const e = createEngine(wideLimits);
            e.fitBounds({ minX: 0, maxX: 100, minY: 0, maxY: 50 }, { onComplete });
            expect(e.getScale()).toBe(8);
            expect(e.getCenter().x).toBeCloseTo(50);
            expect(e.getCenter().y).toBeCloseTo(25);
            expect(onComplete).toHaveBeenCalled();
        });

        it("rejects invalid bounds and padding", () => {
            expect(() => engine.fitBounds({ minX: 10, maxX: 0, minY: 0, maxY: 10 })).toThrow();
            expect(() => engine.fitBounds({ minX: 0, maxX: 0, minY: 0, maxY: 10 })).toThrow();
            expect(() => engine.fitBounds({ minX: 0, maxX: Infinity, minY: 0, maxY: 10 })).toThrow();
            expect(() => engine.fitBounds({ minX: 0, maxX: 10, minY: 0, maxY: NaN })).toThrow();
            expect(() => engine.fitBounds({ minX: 0, maxX: 10, minY: 0, maxY: 10 }, { padding: -1 })).toThrow();
            expect(() => engine.fitBounds({ minX: 0, maxX: 10, minY: 0, maxY: 10 }, { paddingPx: -1 })).toThrow();
            expect(() => engine.fitBounds({ minX: 0, maxX: 10, minY: 0, maxY: 10 }, { paddingPx: NaN })).toThrow();
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

    describe("programmatic resize fires onResize once", () => {
        // Every renderer's resizeWithAnimation completion invokes its own
        // onResize (the engine setter mirrors the user callback into the
        // renderer) and then the engine-supplied onComplete. The engine must
        // not invoke the callback again from onComplete.
        function createEngineWithResizingRenderer() {
            const renderer = createMockRenderer();
            (renderer.resizeWithAnimation as ReturnType<typeof vi.fn>).mockImplementation(
                (_w: number, _h: number, _d: number, onComplete?: () => void) => {
                    renderer.onResize?.();
                    onComplete?.();
                },
            );
            return new CanvasTileEngine<Mount>({}, baseConfig, renderer);
        }

        it("invokes the user onResize callback exactly once", () => {
            const e = createEngineWithResizingRenderer();
            const onResize = vi.fn();
            e.onResize = onResize;

            e.resize(400, 300, 0);
            expect(onResize).toHaveBeenCalledTimes(1);
        });

        it("invokes onResize before the caller's onComplete", () => {
            const e = createEngineWithResizingRenderer();
            const order: string[] = [];
            e.onResize = () => order.push("onResize");

            e.resize(400, 300, 0, () => order.push("onComplete"));
            expect(order).toEqual(["onResize", "onComplete"]);
        });
    });

    describe("gridAligned initial center snapping", () => {
        // Integers are cell centers (cell k spans [k-0.5, k+0.5]), so an even
        // tile count needs a half-integer center and an odd tile count needs
        // an integer center for pixel-perfect alignment.
        function centerFor(config: CanvasTileEngineConfig, center: Coords): Coords {
            const e = new CanvasTileEngine<Mount>({}, config, createMockRenderer(), center);
            return e.getCenter();
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
            expect(e.getCenter()).toEqual({ x: 9.5, y: 9.5 });
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
                clearStaticCache: vi.fn(),
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

    describe("id-based draw registration replace", () => {
        function createEngineWithDrawAPI() {
            let seq = 0;
            const drawAPI = {
                addDrawFunction: (_fn: unknown, layer: number = 1) => ({ id: Symbol(`fn-${seq++}`), layer }),
                drawRect: (_items: unknown, layer: number = 1) => ({ id: Symbol(`rect-${seq++}`), layer }),
                drawCircle: (_items: unknown, layer: number = 1) => ({ id: Symbol(`circle-${seq++}`), layer }),
                drawStaticRect: (_items: unknown, _key: string, layer: number = 1) => ({
                    id: Symbol(`static-${seq++}`),
                    layer,
                }),
                drawGridLines: (_cellSize: number, _style: unknown, layer: number = 0) => ({
                    id: Symbol(`grid-${seq++}`),
                    layer,
                }),
                removeDrawHandle: vi.fn(),
                clearLayer: vi.fn(),
                clearAll: vi.fn(),
                clearStaticCache: vi.fn(),
            };
            const renderer = createMockRenderer();
            (renderer.getDrawAPI as ReturnType<typeof vi.fn>).mockReturnValue(drawAPI);
            return { e: new CanvasTileEngine<Mount>({}, baseConfig, renderer), drawAPI };
        }

        it("replaces the previous registration when the same id is reused", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            const first = e.drawRect({ x: 2, y: 2, size: 1 }, 1, { id: "seats" });
            e.drawRect({ x: 5, y: 5, size: 1 }, 1, { id: "seats" });

            expect(drawAPI.removeDrawHandle).toHaveBeenCalledTimes(1);
            expect(drawAPI.removeDrawHandle).toHaveBeenCalledWith(first);
            expect(e.hitTestFirst({ x: 2.5, y: 2.5 })).toBeUndefined();
            expect(e.hitTestFirst({ x: 5.5, y: 5.5 })).toBeDefined();
        });

        it("accumulates as before when no id is given", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            e.drawRect({ x: 2, y: 2, size: 1 }, 1);
            e.drawRect({ x: 2, y: 2, size: 1 }, 1);

            expect(drawAPI.removeDrawHandle).not.toHaveBeenCalled();
            expect(e.hitTest({ x: 2.5, y: 2.5 })).toHaveLength(2);
        });

        it("shares one id namespace across draw kinds and layers", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            const rect = e.drawRect({ x: 2, y: 2, size: 1 }, 1, { id: "marker" });
            e.drawCircle({ x: 7, y: 7, size: 1 }, 4, { id: "marker" });

            expect(drawAPI.removeDrawHandle).toHaveBeenCalledWith(rect);
            expect(e.hitTestFirst({ x: 2.5, y: 2.5 })).toBeUndefined();
            const hit = e.hitTestFirst({ x: 7.5, y: 7.5 });
            expect(hit!.kind).toBe("circle");
            expect(hit!.layer).toBe(4);
        });

        it("frees the id when its handle is removed manually", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            const h = e.drawRect({ x: 2, y: 2, size: 1 }, 1, { id: "seats" });
            e.removeDrawHandle(h);
            drawAPI.removeDrawHandle.mockClear();

            e.drawRect({ x: 5, y: 5, size: 1 }, 1, { id: "seats" });
            // A fresh registration: nothing stale left to replace
            expect(drawAPI.removeDrawHandle).not.toHaveBeenCalled();
            expect(e.hitTestFirst({ x: 5.5, y: 5.5 })).toBeDefined();
        });

        it("frees ids on clearLayer, leaving other layers tracked", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            e.drawRect({ x: 2, y: 2, size: 1 }, 1, { id: "a" });
            const kept = e.drawRect({ x: 3, y: 3, size: 1 }, 2, { id: "b" });
            e.clearLayer(1);

            e.drawRect({ x: 5, y: 5, size: 1 }, 1, { id: "a" });
            expect(drawAPI.removeDrawHandle).not.toHaveBeenCalled();

            e.drawRect({ x: 6, y: 6, size: 1 }, 2, { id: "b" });
            expect(drawAPI.removeDrawHandle).toHaveBeenCalledWith(kept);
        });

        it("replaces static draws on the same cacheKey and invalidates the cache", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            const first = e.drawStaticRect([{ x: 1, y: 1, size: 1 }], "terrain", 0);
            e.drawStaticRect([{ x: 4, y: 4, size: 1 }], "terrain", 0);

            expect(drawAPI.removeDrawHandle).toHaveBeenCalledWith(first);
            expect(drawAPI.clearStaticCache).toHaveBeenCalledWith("terrain");
            expect(e.hitTestFirst({ x: 1.5, y: 1.5 })).toBeUndefined();
            expect(e.hitTestFirst({ x: 4.5, y: 4.5 })).toBeDefined();
        });

        it("drops the static cache when the registration is removed by handle", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            const h = e.drawStaticRect([{ x: 1, y: 1, size: 1 }], "terrain", 0);
            e.removeDrawHandle(h);
            expect(drawAPI.clearStaticCache).toHaveBeenCalledWith("terrain");
        });

        it("drops static caches on clearLayer for registrations on that layer", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            e.drawStaticRect([{ x: 1, y: 1, size: 1 }], "terrain", 0);
            e.drawStaticRect([{ x: 2, y: 2, size: 1 }], "props", 3);
            e.clearLayer(0);

            expect(drawAPI.clearStaticCache).toHaveBeenCalledWith("terrain");
            expect(drawAPI.clearStaticCache).not.toHaveBeenCalledWith("props");
        });

        it("clears all static caches and the id registry on clearAll", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            e.drawStaticRect([{ x: 1, y: 1, size: 1 }], "terrain", 0);
            e.drawRect({ x: 2, y: 2, size: 1 }, 1, { id: "seats" });
            e.clearAll();

            expect(drawAPI.clearStaticCache).toHaveBeenCalledWith();
            drawAPI.removeDrawHandle.mockClear();
            e.drawRect({ x: 5, y: 5, size: 1 }, 1, { id: "seats" });
            expect(drawAPI.removeDrawHandle).not.toHaveBeenCalled();
        });

        it("tracks ids for grid lines and custom draw functions", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            const grid = e.drawGridLines(5, 1, "black", 0, { id: "grid" });
            e.drawGridLines(10, 1, "black", 0, { id: "grid" });
            expect(drawAPI.removeDrawHandle).toHaveBeenCalledWith(grid);

            const fn = e.addDrawFunction(() => {}, 1, { id: "hud" });
            e.addDrawFunction(() => {}, 1, { id: "hud" });
            expect(drawAPI.removeDrawHandle).toHaveBeenCalledWith(fn);
        });
    });

    describe("styleOf paint-time decoration", () => {
        function createEngineWithDrawAPI() {
            let seq = 0;
            const drawAPI = {
                drawRect: vi.fn((_items: unknown, layer: number = 1, _options?: unknown) => ({
                    id: Symbol(`rect-${seq++}`),
                    layer,
                })),
                drawCircle: vi.fn((_items: unknown, layer: number = 1, _options?: unknown) => ({
                    id: Symbol(`circle-${seq++}`),
                    layer,
                })),
                drawText: vi.fn((_items: unknown, layer: number = 2, _options?: unknown) => ({
                    id: Symbol(`text-${seq++}`),
                    layer,
                })),
                drawLine: vi.fn((_items: unknown, _style: unknown, layer: number = 1, _options?: unknown) => ({
                    id: Symbol(`line-${seq++}`),
                    layer,
                })),
                drawPath: vi.fn((_items: unknown, layer: number = 1, _options?: unknown) => ({
                    id: Symbol(`path-${seq++}`),
                    layer,
                })),
                removeDrawHandle: vi.fn(),
                clearLayer: vi.fn(),
                clearAll: vi.fn(),
                clearStaticCache: vi.fn(),
            };
            const renderer = createMockRenderer();
            (renderer.getDrawAPI as ReturnType<typeof vi.fn>).mockReturnValue(drawAPI);
            return { e: new CanvasTileEngine<Mount>({}, baseConfig, renderer), drawAPI };
        }

        it("threads styleOf through to the renderer draw API on every draw kind", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            const shape = () => ({ fillStyle: "#f00" });
            const text = () => ({ fillStyle: "#f00" });
            const line = () => ({ strokeStyle: "#f00" });
            const path = () => ({ fillStyle: "#f00" });

            e.drawRect({ x: 1, y: 1, size: 1 }, 1, { styleOf: shape });
            expect(drawAPI.drawRect.mock.calls[0][2]).toEqual({ styleOf: shape });

            e.drawCircle({ x: 1, y: 1, size: 1 }, 1, { styleOf: shape });
            expect(drawAPI.drawCircle.mock.calls[0][2]).toEqual({ styleOf: shape });

            e.drawText({ x: 1, y: 1, text: "a" }, 2, { styleOf: text });
            expect(drawAPI.drawText.mock.calls[0][2]).toEqual({ styleOf: text });

            e.drawLine({ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }, undefined, 1, { styleOf: line });
            expect(drawAPI.drawLine.mock.calls[0][3]).toEqual({ styleOf: line });

            e.drawPath(
                {
                    points: [
                        { x: 0, y: 0 },
                        { x: 1, y: 1 },
                    ],
                },
                1,
                { styleOf: path },
            );
            expect(drawAPI.drawPath.mock.calls[0][2]).toEqual({ styleOf: path });
        });

        it("registers hit-test geometry regardless of styleOf", () => {
            const { e } = createEngineWithDrawAPI();
            e.drawRect({ x: 2, y: 2, size: 1 }, 1, { styleOf: () => ({ fillStyle: "#f00" }) });
            expect(e.hitTestFirst({ x: 2.5, y: 2.5 })).toBeDefined();
        });

        it("composes with id-based replace", () => {
            const { e, drawAPI } = createEngineWithDrawAPI();
            const first = e.drawRect({ x: 2, y: 2, size: 1 }, 1, { id: "tiles", styleOf: () => undefined });
            e.drawRect({ x: 5, y: 5, size: 1 }, 1, { id: "tiles" });

            expect(drawAPI.removeDrawHandle).toHaveBeenCalledTimes(1);
            expect(drawAPI.removeDrawHandle).toHaveBeenCalledWith(first);
        });
    });
});
