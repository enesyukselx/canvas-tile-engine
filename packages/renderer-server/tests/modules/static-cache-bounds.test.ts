import { describe, expect, it } from "vitest";
import { CoordinateTransformer, type Circle, type ICamera, type ImageItem, type Rect } from "@canvas-tile-engine/core";
import { createCanvas, type Canvas, type SKRSContext2D } from "@napi-rs/canvas";
import { CanvasDraw } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { Layer, type DrawContext } from "@canvas-tile-engine/renderer-shared/scene";

type Draw = CanvasDraw<SKRSContext2D, Canvas, Canvas>;

// Exercise the real raster pipeline shared by browser Canvas2D and server,
// including cache allocation, painting, viewport clamping, and final blit.
function pixels(register: (draw: Draw) => void, scale = 10, pan = 0) {
    const canvas = createCanvas(400, 400);
    const ctx = canvas.getContext("2d");
    const camera = { x: -200 / scale + pan, y: -200 / scale + pan, scale } as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<DrawContext<SKRSContext2D>>();
    const draw = new CanvasDraw<SKRSContext2D, Canvas, Canvas>(layers, transformer, camera, (width, height) => {
        const offscreen = createCanvas(width, height);
        return { canvas: offscreen, ctx: offscreen.getContext("2d") };
    });
    register(draw);
    layers.drawAll({
        ctx,
        camera,
        transformer,
        config: { size: { width: 400, height: 400 }, scale } as never,
        topLeft: { x: camera.x, y: camera.y },
    });
    return ctx.getImageData(0, 0, 400, 400).data;
}

function expectSamePixels(dynamic: Uint8ClampedArray, cached: Uint8ClampedArray) {
    let changed = 0;
    let painted = 0;
    for (let i = 0; i < dynamic.length; i += 4) {
        if (dynamic[i + 3] !== 0) {
            painted++;
        }
        if (
            dynamic[i] !== cached[i] ||
            dynamic[i + 1] !== cached[i + 1] ||
            dynamic[i + 2] !== cached[i + 2] ||
            dynamic[i + 3] !== cached[i + 3]
        ) {
            changed++;
        }
    }
    expect(painted).toBeGreaterThan(100);
    expect(changed).toBe(0);
}

const rects: Array<[string, Rect]> = [
    ["size-10 rectangle rotated 45 degrees (audit H06)", { x: 0, y: 0, size: 10, rotate: 45 }],
    ["non-square rotated rectangle", { x: -2, y: -3, width: 20, height: 4, rotate: 33 }],
    ["self origin at top left", { x: -3, y: -4, size: 10, origin: { mode: "self", x: 0, y: 0 }, rotate: 45 }],
    ["self origin at bottom right", { x: 4, y: 3, width: 12, height: 6, origin: { mode: "self", x: 1, y: 1 } }],
    [
        "wide world stroke and rotated miter corners",
        { x: 0, y: 0, size: 10, rotate: 45, style: { strokeStyle: "red", lineWidth: 8 } },
    ],
    [
        "pixel stroke overrides world stroke",
        { x: 0, y: 0, width: 12, height: 4, rotate: 30, style: { strokeStyle: "red", lineWidth: 1, lineWidthPx: 70 } },
    ],
    ["rotated cell origin", { x: 0, y: 0, size: 10, rotate: 45, origin: { x: 0, y: 1 } }],
    [
        "subpixel stroke with Canvas2D's one-pixel footprint",
        { x: 0, y: 0, size: 10, rotate: 45, style: { strokeStyle: "red", lineWidthPx: 0.25 } },
    ],
];

describe("static cache painted bounds", () => {
    it.each(rects)("matches every dynamic pixel for %s", (_name, item) => {
        const rect = { ...item, style: { fillStyle: "red", ...item.style } };
        expectSamePixels(
            pixels((draw) => draw.drawRect(rect)),
            pixels((draw) => draw.drawStaticRect([rect], "rect")),
        );
    });

    it.each([5, 10, 20])("preserves the clipped corners after viewport clamping at scale %s", (scale) => {
        const rect = { x: 0, y: 0, size: 10, rotate: 45, style: { fillStyle: "red" } };
        expectSamePixels(
            pixels((draw) => draw.drawRect(rect), scale, 2),
            pixels((draw) => draw.drawStaticRect([rect], "rect"), scale, 2),
        );
    });

    it.each(["world", "pixel"])("includes a self-anchored circle's wide %s stroke", (unit) => {
        const circle: Circle = {
            x: -4,
            y: -4,
            size: 10,
            origin: { mode: "self", x: 0, y: 0 },
            style: {
                fillStyle: "red",
                strokeStyle: "red",
                ...(unit === "world" ? { lineWidth: 8 } : { lineWidthPx: 80 }),
            },
        };
        expectSamePixels(
            pixels((draw) => draw.drawCircle(circle)),
            pixels((draw) => draw.drawStaticCircle([circle], "circle")),
        );
    });

    it.each([
        [32, 32, false],
        [32, 16, false],
        [16, 32, false],
        [32, 32, true],
    ] as const)("preserves a rotated %sx%s image (sprite=%s)", (width, height, sprite) => {
        const img = createCanvas(width, height);
        const ctx = img.getContext("2d");
        ctx.fillStyle = "red";
        ctx.fillRect(0, 0, width, height);
        const item: ImageItem<Canvas> = {
            x: -4,
            y: -4,
            size: 10,
            rotate: 45,
            origin: { mode: "self", x: 0, y: 0 },
            img,
            flipX: true,
            ...(sprite ? { sprite: { x: 0, y: 0, w: 32, h: 16 } } : {}),
        };
        expectSamePixels(
            pixels((draw) => draw.drawImage(item)),
            pixels((draw) => draw.drawStaticImage([item], "image")),
        );
    });
});
