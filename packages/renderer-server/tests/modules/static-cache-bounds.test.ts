import { describe, expect, it, vi } from "vitest";
import {
    CanvasTileEngine,
    CoordinateTransformer,
    type Circle,
    type ICamera,
    type ImageItem,
    type Rect,
} from "@canvas-tile-engine/core";
import { createCanvas, loadImage, type Canvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import pixelmatch from "pixelmatch";
import { CanvasDraw } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { Layer, type DrawContext } from "@canvas-tile-engine/renderer-shared/scene";
import { RendererServer } from "../../src/RendererServer";
import type { ServerMount } from "../../src/types";

// Exact-pixel napi rendering at three pixel ratios is the heaviest suite in
// the package; under turbo's parallel runs the 5 s default is too tight.
vi.setConfig({ testTimeout: 20_000 });

type Draw = CanvasDraw<SKRSContext2D, Canvas, Canvas>;

// Exercise the real raster pipeline shared by browser Canvas2D and server,
// including cache allocation, painting, viewport clamping, and final blit.
// `pixelRatio` backs the 400x400 CSS-px canvas at that many physical pixels
// per CSS pixel, the way both renderers do (devicePixelRatio / pixelRatio).
function pixels(register: (draw: Draw) => void, scale = 10, pan = 0, pixelRatio = 1) {
    const physical = Math.round(400 * pixelRatio);
    const canvas = createCanvas(physical, physical);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    const camera = { x: -200 / scale + pan, y: -200 / scale + pan, scale } as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<DrawContext<SKRSContext2D>>();
    const draw = new CanvasDraw<SKRSContext2D, Canvas, Canvas>(
        layers,
        transformer,
        camera,
        (width, height) => {
            const offscreen = createCanvas(width, height);
            return { canvas: offscreen, ctx: offscreen.getContext("2d") };
        },
        () => pixelRatio,
    );
    register(draw);
    layers.drawAll({
        ctx,
        camera,
        transformer,
        config: { size: { width: 400, height: 400 }, scale } as never,
        topLeft: { x: camera.x, y: camera.y },
    });
    return ctx.getImageData(0, 0, physical, physical).data;
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

/** One-pixel color stripes: any resampling of the cache smears them. */
function stripes(width: number, height: number) {
    const img = createCanvas(width, height);
    const ctx = img.getContext("2d");
    for (let x = 0; x < width; x++) {
        ctx.fillStyle = x % 2 === 0 ? "#ff0000" : "#0000ff";
        ctx.fillRect(x, 0, 1, height);
    }
    return img;
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

// A canvas backed at a pixel ratio holds `scale * ratio` physical pixels per
// world unit. A cache rendered at CSS resolution is upscaled by the blit and
// every edge comes out soft, so each case must match the dynamic drawing pixel
// for pixel at every ratio, fractional ones included (issue #262).
describe.each([1, 2, 1.5])("static cache painted bounds at pixel ratio %s", (pixelRatio) => {
    const at = (register: (draw: Draw) => void, scale = 10, pan = 0) => pixels(register, scale, pan, pixelRatio);

    it.each(rects)("matches every dynamic pixel for %s", (_name, item) => {
        const rect = { ...item, style: { fillStyle: "red", ...item.style } };
        expectSamePixels(
            at((draw) => draw.drawRect(rect)),
            at((draw) => draw.drawStaticRect([rect], "rect")),
        );
    });

    it.each([5, 10, 20])("preserves the clipped corners after viewport clamping at scale %s", (scale) => {
        const rect = { x: 0, y: 0, size: 10, rotate: 45, style: { fillStyle: "red" } };
        expectSamePixels(
            at((draw) => draw.drawRect(rect), scale, 2),
            at((draw) => draw.drawStaticRect([rect], "rect"), scale, 2),
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
            at((draw) => draw.drawCircle(circle)),
            at((draw) => draw.drawStaticCircle([circle], "circle")),
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
            at((draw) => draw.drawImage(item)),
            at((draw) => draw.drawStaticImage([item], "image")),
        );
    });

    it("keeps an image's one-pixel detail", () => {
        // 64 source columns over 10 world units: at ratio 2 the dynamic draw
        // resolves 200 physical columns, which a 1x cache can only smear.
        const item: ImageItem<Canvas> = { x: -4, y: -4, size: 10, img: stripes(64, 32) };
        expectSamePixels(
            at((draw) => draw.drawImage(item)),
            at((draw) => draw.drawStaticImage([item], "image")),
        );
    });
});

describe("RendererServer static caches", () => {
    // End to end through the renderer, so its `pixelRatio` has to reach the
    // cache: `renderToBuffer({ pixelRatio: 2 })` is the documented crisp path.
    // The opaque background and two-color shapes composite the cache over
    // painted pixels, so this uses the fallback suite's perceptual tolerance.
    function render(register: (engine: CanvasTileEngine<ServerMount, Image>) => void) {
        const renderer = new RendererServer({ pixelRatio: 2 });
        const engine = new CanvasTileEngine(
            {},
            { scale: 10, size: { width: 160, height: 120 }, backgroundColor: "#ffffff" },
            renderer,
        );
        try {
            register(engine);
            engine.render();
            const canvas = renderer.getCanvas();
            expect([canvas.width, canvas.height]).toEqual([320, 240]);
            return renderer.getContext().getImageData(0, 0, 320, 240).data;
        } finally {
            engine.destroy();
        }
    }

    it("renders rect, circle, and image static layers at the output pixel ratio", async () => {
        const rect: Rect = {
            x: -4,
            y: -3,
            width: 5,
            height: 3,
            rotate: 20,
            style: { fillStyle: "#ff0000", strokeStyle: "#000000", lineWidth: 0.2 },
        };
        const circle: Circle = { x: 3, y: -2, size: 3, style: { fillStyle: "#00ff00", strokeStyle: "#0000ff" } };
        const image: ImageItem<Image> = {
            x: 0,
            y: 3,
            size: 4,
            rotate: 30,
            img: await loadImage(stripes(32, 32).toBuffer("image/png")),
        };
        const dynamic = render((engine) => {
            engine.drawRect(rect, 1);
            engine.drawCircle(circle, 2);
            engine.drawImage(image, 3);
        });
        const cached = render((engine) => {
            engine.drawStaticRect([rect], "rect", 1);
            engine.drawStaticCircle([circle], "circle", 2);
            engine.drawStaticImage([image], "image", 3);
        });
        expect(pixelmatch(cached, dynamic, null, 320, 240, { threshold: 0.1, includeAA: true })).toBe(0);
        expect(dynamic.some((channel, i) => i % 4 !== 3 && channel !== 255)).toBe(true);
    });
});
