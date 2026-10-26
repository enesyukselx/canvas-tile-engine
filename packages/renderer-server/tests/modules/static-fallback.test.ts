import { afterEach, describe, expect, it, vi } from "vitest";
import { CanvasTileEngine, CoordinateTransformer, type ICamera, type Rect } from "@canvas-tile-engine/core";
import { createCanvas, loadImage, type Canvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import pixelmatch from "pixelmatch";
import { CanvasDraw, type OffscreenCanvasFactory } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { Layer, type DrawContext } from "@canvas-tile-engine/renderer-shared/scene";
import { RendererServer } from "../../src/RendererServer";

type Draw = CanvasDraw<SKRSContext2D, Image, Canvas>;
type Kind = "rect" | "circle" | "image";
type Route = "cached" | "too wide" | "too tall" | "no offscreen" | "no context";
type Item = Rect & { img: Image };

const kinds: Kind[] = ["rect", "circle", "image"];
const fallbackRoutes: Route[] = ["too wide", "too tall", "no offscreen", "no context"];
const createOffscreen: OffscreenCanvasFactory<SKRSContext2D, Canvas> = (width, height) => {
    const canvas = createCanvas(width, height);
    return { canvas, ctx: canvas.getContext("2d") };
};

async function makeImage() {
    const canvas = createCanvas(10, 10);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(0, 0, 10, 10);
    return loadImage(canvas.toBuffer("image/png"));
}

function register(draw: Draw, kind: Kind, items: Item[], isStatic = true) {
    switch (kind) {
        case "rect":
            return isStatic ? draw.drawStaticRect(items, "test") : draw.drawRect(items);
        case "circle":
            return isStatic ? draw.drawStaticCircle(items, "test") : draw.drawCircle(items);
        case "image":
            return isStatic ? draw.drawStaticImage(items, "test") : draw.drawImage(items);
    }
}

function setup(route: Route) {
    const camera = { x: 0, y: 0, scale: 10 } as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<DrawContext<SKRSContext2D>>();
    const factory = vi.fn(route === "no context" ? () => null : createOffscreen);
    const draw = new CanvasDraw<SKRSContext2D, Image, Canvas>(
        layers,
        transformer,
        camera,
        route === "no offscreen" ? null : factory,
    );
    const canvas = createCanvas(120, 120);
    const ctx = canvas.getContext("2d");
    const render = (scale = 10) => {
        (camera as { scale: number }).scale = scale;
        ctx.clearRect(0, 0, 120, 120);
        layers.drawAll({
            ctx,
            camera,
            transformer,
            config: { size: { width: 120, height: 120 }, scale } as never,
            topLeft: { x: 0, y: 0 },
        });
        return ctx.getImageData(0, 0, 120, 120).data;
    };
    return { draw, factory, render };
}

function withDistantItem(route: Route, item: Item): Item[] {
    if (route === "too wide") {
        return [item, { ...item, x: 2000 }];
    }
    if (route === "too tall") {
        return [item, { ...item, y: 2000 }];
    }
    return [item];
}

function expectSamePainting(actual: Uint8ClampedArray, expected: Uint8ClampedArray) {
    // Match the snapshot suite's color tolerance for cache compositing and
    // antialiasing, but require zero perceptually different pixels.
    expect(pixelmatch(actual, expected, null, 120, 120, { threshold: 0.1, includeAA: true })).toBe(0);
    expect(actual.some((channel) => channel !== 0)).toBe(true);
}

afterEach(() => vi.restoreAllMocks());

describe.each(fallbackRoutes)("static sizing with %s", (route) => {
    it.each(kinds)("keeps %s pixels equal to the cached world-sized drawing", async (kind) => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const img = await makeImage();
        const dimensions: Partial<Rect>[] = [{ size: 1, sizePx: 60 }, { size: 2, sizePx: 4 }, { sizePx: 60 }];
        if (kind === "rect") {
            dimensions.push(
                { size: 1, widthPx: 70, heightPx: 80 },
                { size: 2, width: 3, height: 1, sizePx: 60, widthPx: 70, heightPx: 80 },
                { widthPx: 70, height: 2 },
                { width: 2, heightPx: 80 },
            );
        }

        for (const dimension of dimensions) {
            const item: Item = Object.freeze({ x: 2, y: 2, ...dimension, img, style: { fillStyle: "#ff0000" } });
            const original = { ...item };
            const fallback = setup(route);
            register(fallback.draw, kind, withDistantItem(route, item));
            const cached = setup("cached");
            register(cached.draw, kind, [item]);

            expectSamePainting(fallback.render(), cached.render());
            expect(cached.factory).toHaveBeenCalledOnce();
            expect(fallback.factory).toHaveBeenCalledTimes(route === "no context" ? 1 : 0);

            // The uncached registration continues to use world sizes on zoom.
            const { sizePx: _sizePx, widthPx: _widthPx, heightPx: _heightPx, ...worldItem } = item;
            const world = setup("cached");
            register(world.draw, kind, [worldItem], false);
            expect(Buffer.from(fallback.render(20)).equals(Buffer.from(world.render(20)))).toBe(true);
            expect(item).toEqual(original);
        }
    });
});

describe("static fallback contracts", () => {
    it.each(kinds)("leaves dynamic %s pixel sizing unchanged for the same source item", async (kind) => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const item: Item = { x: 2, y: 2, size: 1, sizePx: 60, img: await makeImage(), style: { fillStyle: "#ff0000" } };
        const stat = setup("no offscreen");
        register(stat.draw, kind, [item]);
        const dynamic = setup("cached");
        register(dynamic.draw, kind, [item], false);
        const staticPixels = stat.render();
        const dynamicPixels = dynamic.render();
        // (45,25) is inside a 60px shape but outside the static 10px shape.
        const alphaIndex = (25 * 120 + 45) * 4 + 3;
        expect(staticPixels[alphaIndex]).toBe(0);
        expect(dynamicPixels[alphaIndex]).toBe(255);
        expect(item.sizePx).toBe(60);
    });

    it.each(kinds)("draws no pixels for an empty static %s registration", (kind) => {
        const { draw, factory, render } = setup("cached");
        register(draw, kind, []);
        expect(render().every((channel) => channel === 0)).toBe(true);
        expect(factory).not.toHaveBeenCalled();
    });

    it.each(kinds)("keeps oversized static %s painting and engine hit testing aligned", async (kind) => {
        vi.spyOn(console, "warn").mockImplementation(() => {});
        const renderer = new RendererServer();
        const engine = new CanvasTileEngine(
            {},
            { scale: 10, size: { width: 120, height: 120 }, backgroundColor: "#ffffff" },
            renderer,
        );
        const item: Item = { x: 0, y: 0, size: 1, sizePx: 60, img: await makeImage(), style: { fillStyle: "#ff0000" } };
        const items = [item, { ...item, x: 2000 }];
        try {
            switch (kind) {
                case "rect":
                    engine.drawStaticRect(items, "oversized");
                    break;
                case "circle":
                    engine.drawStaticCircle(items, "oversized");
                    break;
                case "image":
                    engine.drawStaticImage(items, "oversized");
                    break;
            }
            engine.onDraw = (_ctx, _topLeft, _config, transform) => {
                const center = transform.worldToScreen(item.x, item.y);
                for (const offset of [0, 20]) {
                    const x = Math.floor(center.x + offset);
                    const y = Math.floor(center.y);
                    const pixel = renderer.getContext().getImageData(x, y, 1, 1).data;
                    const hit = engine.hitTestFirst(transform.screenToWorld(x + 0.5, y + 0.5));
                    expect(pixel[1] === 0).toBe(offset === 0);
                    expect(hit?.item).toBe(offset === 0 ? item : undefined);
                }
            };
            engine.render();
            engine.setScale(20);
            engine.render();
        } finally {
            engine.destroy();
        }
    });
});
