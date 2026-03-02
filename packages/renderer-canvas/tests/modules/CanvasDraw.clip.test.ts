import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CoordinateTransformer, ICamera, ImageItem, CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { CanvasDraw } from "../../src/modules/CanvasDraw";
import { Layer, DrawContext } from "../../src/modules/Layer";

/**
 * Minimal mock canvas context that records drawImage calls.
 */
function createMockCtx() {
    const drawImage = vi.fn();
    const save = vi.fn();
    const restore = vi.fn();
    const translate = vi.fn();
    const rotate = vi.fn();
    const ctx = { drawImage, save, restore, translate, rotate } as unknown as CanvasRenderingContext2D;
    return { ctx, drawImage, save, restore, translate, rotate };
}

function createCamera(scale = 50): ICamera {
    return {
        x: 0,
        y: 0,
        scale,
        pan: vi.fn(),
        zoom: vi.fn(),
        getCenter: vi.fn(),
        setCenter: vi.fn(),
        adjustForResize: vi.fn(),
        zoomByFactor: vi.fn(),
        setScale: vi.fn(),
        getVisibleBounds: vi.fn(),
    } as unknown as ICamera;
}

function createDrawContext(ctx: CanvasRenderingContext2D, camera: ICamera): DrawContext {
    return {
        ctx,
        camera,
        transformer: new CoordinateTransformer(camera),
        config: {
            scale: camera.scale,
            size: { width: 800, height: 600 },
        } as Required<CanvasTileEngineConfig>,
        topLeft: { x: -10, y: -10 },
    };
}

function createImg(width: number, height: number): HTMLImageElement {
    return { width, height } as unknown as HTMLImageElement;
}

/**
 * Install a global OffscreenCanvas mock whose 2d contexts record drawImage calls.
 * Returns an accessor for the most-recently created offscreen context's drawImage spy.
 */
function installOffscreenCanvasMock() {
    const spies: { drawImage: ReturnType<typeof vi.fn> }[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    (globalThis as any).OffscreenCanvas = class {
        width: number;
        height: number;
        constructor(w: number, h: number) {
            this.width = w;
            this.height = h;
        }
        getContext() {
            const drawImage = vi.fn();
            const save = vi.fn();
            const restore = vi.fn();
            const translate = vi.fn();
            const rotate = vi.fn();
            const clearRect = vi.fn();
            const entry = { drawImage, save, restore, translate, rotate, clearRect };
            spies.push(entry);
            return entry;
        }
    };

    return {
        /** The drawImage spy from the last OffscreenCanvas context created */
        get lastDrawImage() {
            return spies[spies.length - 1]?.drawImage;
        },
        get lastCtx() {
            return spies[spies.length - 1];
        },
    };
}

function removeOffscreenCanvasMock() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    delete (globalThis as any).OffscreenCanvas;
}

describe("CanvasDraw.drawImage – clip support", () => {
    let layer: Layer;
    let camera: ICamera;
    let draw: CanvasDraw;

    beforeEach(() => {
        camera = createCamera(50);
        layer = new Layer();
        draw = new CanvasDraw(layer, new CoordinateTransformer(camera), camera);
    });

    it("uses 5-arg drawImage when clip is not provided", () => {
        const img = createImg(64, 64);
        const item: ImageItem = { x: 0, y: 0, size: 1, img };

        draw.drawImage(item, 1);

        const { ctx, drawImage } = createMockCtx();
        const dc = createDrawContext(ctx, camera);
        layer.drawAll(dc);

        expect(drawImage).toHaveBeenCalledTimes(1);
        // 5-arg form: (img, dx, dy, dw, dh)
        expect(drawImage.mock.calls[0]).toHaveLength(5);
        expect(drawImage.mock.calls[0][0]).toBe(img);
    });

    it("uses 9-arg drawImage when clip is provided", () => {
        const img = createImg(256, 256);
        const item: ImageItem = {
            x: 0,
            y: 0,
            size: 1,
            img,
            clip: { x: 32, y: 64, w: 32, h: 32 },
        };

        draw.drawImage(item, 1);

        const { ctx, drawImage } = createMockCtx();
        const dc = createDrawContext(ctx, camera);
        layer.drawAll(dc);

        expect(drawImage).toHaveBeenCalledTimes(1);
        // 9-arg form: (img, sx, sy, sw, sh, dx, dy, dw, dh)
        const call = drawImage.mock.calls[0];
        expect(call).toHaveLength(9);
        expect(call[0]).toBe(img);
        expect(call[1]).toBe(32); // sx
        expect(call[2]).toBe(64); // sy
        expect(call[3]).toBe(32); // sw
        expect(call[4]).toBe(32); // sh
    });

    it("derives aspect ratio from clip dimensions", () => {
        const img = createImg(256, 256);
        // clip is 64 wide x 32 tall → aspect 2:1
        const item: ImageItem = {
            x: 0,
            y: 0,
            size: 1,
            img,
            clip: { x: 0, y: 0, w: 64, h: 32 },
        };

        draw.drawImage(item, 1);

        const { ctx, drawImage } = createMockCtx();
        const dc = createDrawContext(ctx, camera);
        layer.drawAll(dc);

        const call = drawImage.mock.calls[0];
        // dw (arg[7]) and dh (arg[8])
        const dw = call[7] as number;
        const dh = call[8] as number;
        // aspect > 1 → dh = pxSize / aspect, dw = pxSize
        expect(dw).toBeGreaterThan(dh);
        expect(dw / dh).toBeCloseTo(2, 5);
    });

    it("skips drawing when clip.w is zero", () => {
        const img = createImg(256, 256);
        const item: ImageItem = {
            x: 0,
            y: 0,
            size: 1,
            img,
            clip: { x: 0, y: 0, w: 0, h: 32 },
        };

        draw.drawImage(item, 1);

        const { ctx, drawImage } = createMockCtx();
        const dc = createDrawContext(ctx, camera);
        layer.drawAll(dc);

        expect(drawImage).not.toHaveBeenCalled();
    });

    it("skips drawing when clip.h is zero", () => {
        const img = createImg(256, 256);
        const item: ImageItem = {
            x: 0,
            y: 0,
            size: 1,
            img,
            clip: { x: 0, y: 0, w: 32, h: 0 },
        };

        draw.drawImage(item, 1);

        const { ctx, drawImage } = createMockCtx();
        const dc = createDrawContext(ctx, camera);
        layer.drawAll(dc);

        expect(drawImage).not.toHaveBeenCalled();
    });

    it("skips drawing when clip dimensions are negative", () => {
        const img = createImg(256, 256);
        const item: ImageItem = {
            x: 0,
            y: 0,
            size: 1,
            img,
            clip: { x: 0, y: 0, w: -10, h: 32 },
        };

        draw.drawImage(item, 1);

        const { ctx, drawImage } = createMockCtx();
        const dc = createDrawContext(ctx, camera);
        layer.drawAll(dc);

        expect(drawImage).not.toHaveBeenCalled();
    });

    it("skips drawing when img dimensions are zero (no clip)", () => {
        const img = createImg(0, 0);
        const item: ImageItem = { x: 0, y: 0, size: 1, img };

        draw.drawImage(item, 1);

        const { ctx, drawImage } = createMockCtx();
        const dc = createDrawContext(ctx, camera);
        layer.drawAll(dc);

        expect(drawImage).not.toHaveBeenCalled();
    });

    it("uses 9-arg drawImage with rotation when clip is provided", () => {
        const img = createImg(256, 256);
        const item: ImageItem = {
            x: 0,
            y: 0,
            size: 1,
            img,
            clip: { x: 0, y: 0, w: 32, h: 32 },
            rotate: 45,
        };

        draw.drawImage(item, 1);

        const { ctx, drawImage, save, rotate, restore } = createMockCtx();
        const dc = createDrawContext(ctx, camera);
        layer.drawAll(dc);

        expect(save).toHaveBeenCalled();
        expect(rotate).toHaveBeenCalled();
        expect(drawImage).toHaveBeenCalledTimes(1);
        // 9-arg form with rotation
        expect(drawImage.mock.calls[0]).toHaveLength(9);
        expect(restore).toHaveBeenCalled();
    });
});

describe("CanvasDraw.drawStaticImage – clip support", () => {
    let layer: Layer;
    let camera: ICamera;
    let draw: CanvasDraw;
    let offscreenMock: ReturnType<typeof installOffscreenCanvasMock>;

    beforeEach(() => {
        offscreenMock = installOffscreenCanvasMock();
        camera = createCamera(50);
        layer = new Layer();
        // Construct CanvasDraw *after* the mock is installed so staticCacheSupported = true
        draw = new CanvasDraw(layer, new CoordinateTransformer(camera), camera);
    });

    afterEach(() => {
        removeOffscreenCanvasMock();
    });

    it("uses 5-arg drawImage on the offscreen context when clip is not provided", () => {
        const img = createImg(64, 64);
        const items: ImageItem[] = [{ x: 0, y: 0, size: 1, img }];

        draw.drawStaticImage(items, "test-no-clip", 1);

        const drawImage = offscreenMock.lastDrawImage;
        expect(drawImage).toHaveBeenCalledTimes(1);
        // 5-arg form: (img, dx, dy, dw, dh)
        expect(drawImage.mock.calls[0]).toHaveLength(5);
        expect(drawImage.mock.calls[0][0]).toBe(img);
    });

    it("uses 9-arg drawImage on the offscreen context when clip is provided", () => {
        const img = createImg(256, 256);
        const items: ImageItem[] = [
            { x: 0, y: 0, size: 1, img, clip: { x: 32, y: 64, w: 32, h: 32 } },
        ];

        draw.drawStaticImage(items, "test-clip", 1);

        const drawImage = offscreenMock.lastDrawImage;
        expect(drawImage).toHaveBeenCalledTimes(1);
        // 9-arg form: (img, sx, sy, sw, sh, dx, dy, dw, dh)
        const call = drawImage.mock.calls[0];
        expect(call).toHaveLength(9);
        expect(call[0]).toBe(img);
        expect(call[1]).toBe(32); // sx
        expect(call[2]).toBe(64); // sy
        expect(call[3]).toBe(32); // sw
        expect(call[4]).toBe(32); // sh
    });

    it("skips drawing on the offscreen context when clip.w is zero", () => {
        const img = createImg(256, 256);
        const items: ImageItem[] = [
            { x: 0, y: 0, size: 1, img, clip: { x: 0, y: 0, w: 0, h: 32 } },
        ];

        draw.drawStaticImage(items, "test-zero-w", 1);

        const drawImage = offscreenMock.lastDrawImage;
        expect(drawImage).not.toHaveBeenCalled();
    });

    it("skips drawing on the offscreen context when clip.h is zero", () => {
        const img = createImg(256, 256);
        const items: ImageItem[] = [
            { x: 0, y: 0, size: 1, img, clip: { x: 0, y: 0, w: 32, h: 0 } },
        ];

        draw.drawStaticImage(items, "test-zero-h", 1);

        const drawImage = offscreenMock.lastDrawImage;
        expect(drawImage).not.toHaveBeenCalled();
    });

    it("skips drawing on the offscreen context when clip dimensions are negative", () => {
        const img = createImg(256, 256);
        const items: ImageItem[] = [
            { x: 0, y: 0, size: 1, img, clip: { x: 0, y: 0, w: -10, h: 32 } },
        ];

        draw.drawStaticImage(items, "test-neg", 1);

        const drawImage = offscreenMock.lastDrawImage;
        expect(drawImage).not.toHaveBeenCalled();
    });
});
