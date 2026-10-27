import { describe, expect, it, vi } from "vitest";
import { CoordinateTransformer, type ICamera, type Rect } from "@canvas-tile-engine/core";
import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { CanvasDraw, type OffscreenCanvasFactory } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { Layer, type DrawContext } from "@canvas-tile-engine/renderer-shared/scene";

type Draw = CanvasDraw<SKRSContext2D, Canvas, Canvas>;
type Kind = "rect" | "circle" | "image";
type Item = Rect & { img: Canvas };

const RED = [255, 0, 0, 255];
const BLUE = [0, 0, 255, 255];

function solidImage(color: string) {
    const img = createCanvas(10, 10);
    const ctx = img.getContext("2d");
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 10, 10);
    return img;
}

function item(color: string): Item {
    return { x: 2, y: 2, size: 1, img: solidImage(color), style: { fillStyle: color } };
}

function registerStatic(draw: Draw, kind: Kind, items: Item[], cacheKey: string) {
    switch (kind) {
        case "rect":
            return draw.drawStaticRect(items, cacheKey);
        case "circle":
            return draw.drawStaticCircle(items, cacheKey);
        case "image":
            return draw.drawStaticImage(items, cacheKey);
    }
}

// Drives the draw API directly, bypassing the engine's replace-on-same-key
// path, which clears the cache before every re-registration.
function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<DrawContext<SKRSContext2D>>();
    const factory = vi.fn<OffscreenCanvasFactory<SKRSContext2D, Canvas>>((width, height) => {
        const canvas = createCanvas(width, height);
        return { canvas, ctx: canvas.getContext("2d") };
    });
    const draw = new CanvasDraw<SKRSContext2D, Canvas, Canvas>(layers, transformer, camera, factory);
    const canvas = createCanvas(120, 120);
    const ctx = canvas.getContext("2d");
    // Center of the cell at world (2, 2): (2 + 0.5) * 10.
    const centerPixel = () => {
        ctx.clearRect(0, 0, 120, 120);
        layers.drawAll({
            ctx,
            camera,
            transformer,
            config: { size: { width: 120, height: 120 }, scale: camera.scale } as never,
            topLeft: { x: camera.x, y: camera.y },
        });
        return Array.from(ctx.getImageData(25, 25, 1, 1).data);
    };
    return { draw, factory, centerPixel };
}

describe("static cache re-registration", () => {
    it.each<Kind>(["rect", "circle", "image"])(
        "renders the new %s items when a cacheKey is reused at the same bounds and scale",
        (kind) => {
            const { draw, factory, centerPixel } = setup();

            const first = registerStatic(draw, kind, [item("#ff0000")], "k");
            expect(centerPixel()).toEqual(RED);

            // Same footprint and camera scale, different content, no
            // clearStaticCache in between.
            draw.removeDrawHandle(first);
            registerStatic(draw, kind, [item("#0000ff")], "k");

            expect(centerPixel()).toEqual(BLUE);
            expect(factory).toHaveBeenCalledTimes(2);
        },
    );
});
