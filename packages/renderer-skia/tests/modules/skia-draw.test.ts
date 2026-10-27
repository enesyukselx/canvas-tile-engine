import { beforeEach, describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera, type Circle, type Rect } from "@canvas-tile-engine/core";
import type { SkCanvas } from "@shopify/react-native-skia";
import { COLOR_CACHE_LIMIT, SkiaDraw } from "../../src/modules/SkiaDraw";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import type { SkiaDrawContext } from "../../src/types";
import {
    colorParseCalls,
    gradientCalls,
    makeRecordingCanvas,
    matchFontCalls,
    type MockPicture,
} from "../mocks/react-native-skia";

interface Op {
    op: string;
    [key: string]: unknown;
}

// Recording canvas: paints are shared and mutated between draws, so state is
// captured at call time (mirroring Skia's snapshot-on-record semantics).
function makeCanvas() {
    const { canvas, ops } = makeRecordingCanvas();
    return { canvas: canvas as unknown as SkCanvas, ops: ops as Op[] };
}

function setup(scale = 10) {
    const camera = { x: 0, y: 0, scale } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<SkiaDrawContext>();
    const draw = new SkiaDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    const render = (canvas: SkCanvas) =>
        layers.drawAll({
            ctx: canvas,
            camera,
            transformer,
            config,
            topLeft: { x: 0, y: 0 },
        });
    return { draw, render, camera };
}

beforeEach(() => {
    colorParseCalls.length = 0;
    matchFontCalls.length = 0;
    gradientCalls.length = 0;
});

describe("SkiaDraw grid intervals", () => {
    it.each([-1, -0.25, 0, -0, NaN, Infinity, -Infinity, "1", null, undefined])(
        "rejects invalid cellSize %s synchronously without registering a draw",
        (cellSize) => {
            const { draw, render } = setup();
            const { canvas, ops } = makeCanvas();

            expect(() => draw.drawGridLines(cellSize as number, { lineWidth: 1, strokeStyle: "#000" })).toThrow(
                new RangeError("[CanvasTileEngine] cellSize must be a positive finite number"),
            );
            render(canvas);
            expect(ops).toHaveLength(0);
        },
    );

    it.each([0.5, 2])("renders positive cellSize %s and returns a removable handle", (cellSize) => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        const handle = draw.drawGridLines(cellSize, { lineWidth: 1, strokeStyle: "#000" }, 3);
        expect(handle.layer).toBe(3);
        render(canvas);
        const lineCount = 2 * (10 / cellSize + 1);
        expect(ops.filter((op) => op.op === "line")).toHaveLength(lineCount);

        draw.removeDrawHandle(handle);
        render(canvas);
        expect(ops).toHaveLength(lineCount);
    });
});

// Grid density contract shared by all renderers (mirrored in the server and
// webgl suites): lines never get closer than 2px, so the drawLine (JSI) call
// count is bounded by the 100x100px viewport rather than by 1 / scale.
describe("SkiaDraw grid line density", () => {
    function renderGridLines(cellSize: number, scale: number) {
        const { draw, render } = setup(scale);
        const { canvas, ops } = makeCanvas();
        draw.drawGridLines(cellSize, { lineWidth: 1, strokeStyle: "#000" });
        render(canvas);
        return ops.filter((op) => op.op === "line") as Array<Op & { x1: number; x2: number }>;
    }
    const verticalXs = (lines: Array<{ x1: number; x2: number }>) =>
        lines.filter((l) => l.x1 === l.x2).map((l) => l.x1);

    it("bounds the line count when zoomed far out", () => {
        // 100px at scale 0.1 spans 1000 cells: 1001 lines per axis, 0.1px apart.
        const lines = renderGridLines(1, 0.1);

        expect(lines.length).toBeLessThanOrEqual(2 * (100 / 2 + 2));
        const xs = verticalXs(lines);
        for (let i = 1; i < xs.length; i++) {
            expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(2);
        }
    });

    it.each([
        [0.5, 10],
        [1, 2], // exactly 2px apart: still every line
    ])("keeps every line and its position for cellSize %s at scale %s", (cellSize, scale) => {
        const spacing = cellSize * scale;
        const perAxis = 100 / spacing + 1;
        const lines = renderGridLines(cellSize, scale);

        expect(lines).toHaveLength(2 * perAxis);
        expect(verticalXs(lines)).toEqual(Array.from({ length: perAxis }, (_, i) => i * spacing));
    });
});

describe("resolveRadius roundRect semantics", () => {
    const rectWithRadius = (radius: number | number[]) => ({
        x: 1,
        y: 1,
        size: 1,
        radius,
        style: { fillStyle: "#f00" },
    });

    function drawAndGetRRect(radius: number | number[]): Op {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawRect(rectWithRadius(radius), 1);
        render(canvas);
        expect(ops).toHaveLength(1);
        return ops[0];
    }

    // Radii are world units: px = radius * scale (scale is 10 in setup).
    it("expands a single-element array to all four corners", () => {
        const op = drawAndGetRRect([1]);
        // Uniform radius goes through RRectXY
        expect(op.op).toBe("rrect");
        expect(op.rrect).toMatchObject({ rx: 10, ry: 10 });
    });

    it("expands a two-element array as [tl+br, tr+bl]", () => {
        const op = drawAndGetRRect([1, 0.5]);
        expect(op.op).toBe("rrect");
        expect(op.rrect).toMatchObject({
            topLeft: { x: 10, y: 10 },
            topRight: { x: 5, y: 5 },
            bottomRight: { x: 10, y: 10 },
            bottomLeft: { x: 5, y: 5 },
        });
    });

    it("expands a three-element array as [tl, tr+bl, br]", () => {
        const op = drawAndGetRRect([1, 0.5, 0.2]);
        expect(op.op).toBe("rrect");
        expect(op.rrect).toMatchObject({
            topLeft: { x: 10, y: 10 },
            topRight: { x: 5, y: 5 },
            bottomRight: { x: 2, y: 2 },
            bottomLeft: { x: 5, y: 5 },
        });
    });

    it("draws a plain rect when no radius is given", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawRect({ x: 1, y: 1, size: 1, style: { fillStyle: "#f00" } }, 1);
        render(canvas);
        expect(ops[0].op).toBe("rect");
    });
});

describe("color caching", () => {
    it("parses each distinct color string only once across frames", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();
        draw.drawRect(
            [
                { x: 1, y: 1, size: 1, style: { fillStyle: "#ff0000" } },
                { x: 3, y: 3, size: 1, style: { fillStyle: "#ff0000" } },
                { x: 5, y: 5, size: 1, style: { fillStyle: "#00ff00" } },
            ],
            1,
        );
        render(canvas);
        render(canvas); // second frame reuses the cache too

        expect(colorParseCalls.filter((c) => c === "#ff0000")).toHaveLength(1);
        expect(colorParseCalls.filter((c) => c === "#00ff00")).toHaveLength(1);
    });

    // A `styleOf` that computes a color string per frame would otherwise leave
    // one permanent cache entry behind per frame, for the renderer's lifetime.
    it("bounds the cache, evicting the least recently used color", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();

        let hue = 0;
        draw.drawRect({ x: 1, y: 1, size: 1 }, 1, {
            styleOf: () => ({ fillStyle: `hsl(${hue}, 70%, 50%)` }),
        });

        for (; hue <= COLOR_CACHE_LIMIT; hue++) {
            render(canvas);
        }
        expect(colorParseCalls).toHaveLength(COLOR_CACHE_LIMIT + 1);

        // The first frame's color is the least recently used of the overflowing
        // set, so drawing it again is a miss.
        hue = 0;
        render(canvas);
        expect(colorParseCalls.filter((c) => c === "hsl(0, 70%, 50%)")).toHaveLength(2);
    });
});

describe("text rendering", () => {
    it("resolves black per item after styleOf, preserving explicit and decorated colors", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        let decorated = true;

        draw.drawText(
            [
                { x: 1, y: 1, text: "default" },
                { x: 2, y: 1, text: "explicit", style: { fillStyle: "#ff0000" } },
                { x: 3, y: 1, text: "after", rotate: 30, style: {} },
                { x: 4, y: 1, text: "font-only", style: { fillStyle: "#ff0000" } },
                { x: 5, y: 1, text: "override", style: { fillStyle: "#ff0000" } },
                { x: 6, y: 1, text: "reset", style: { fillStyle: "#ff0000" } },
            ],
            2,
            {
                styleOf: (item) => {
                    if (item.text === "font-only") {
                        return { fontWeight: "bold" };
                    }
                    if (item.text === "override" && decorated) {
                        return { fillStyle: "#0000ff" };
                    }
                    if (item.text === "reset") {
                        return { fillStyle: undefined };
                    }
                    return undefined;
                },
            },
        );

        const colors = () => ops.filter((op) => op.op === "text").map((op) => op.color);
        render(canvas);
        expect(colors()).toEqual(
            ["#000000", "#ff0000", "#000000", "#ff0000", "#0000ff", "#000000"].map((parsed) => ({ parsed })),
        );

        decorated = false;
        ops.length = 0;
        render(canvas);
        expect(colors()).toEqual(
            ["#000000", "#ff0000", "#000000", "#ff0000", "#ff0000", "#000000"].map((parsed) => ({ parsed })),
        );
    });

    it("uses the exact (unrounded) scaled font size", () => {
        const { draw, render } = setup(11.5);
        const { canvas, ops } = makeCanvas();
        draw.drawText({ x: 1, y: 1, size: 1, text: "hi", style: { fillStyle: "#000" } }, 2);
        render(canvas);

        const textOp = ops.find((o) => o.op === "text");
        expect(textOp?.fontSize).toBe(1 * 11.5);
    });

    // Font sizing contract shared by all renderers: px = fontPx ?? size * scale.
    // Mirrors the fixture values in the canvas, webgl, and server suites.
    it("renders size in world units (px = size * scale)", () => {
        const { draw, render } = setup(10);
        const { canvas, ops } = makeCanvas();
        draw.drawText(
            [
                { x: 1, y: 1, text: "default", style: { fillStyle: "#000" } },
                {
                    x: 2,
                    y: 1,
                    text: "sized",
                    size: 2,
                    style: { fillStyle: "#000" },
                },
            ],
            2,
        );
        render(canvas);

        const sizes = ops.filter((o) => o.op === "text").map((o) => o.fontSize);
        expect(sizes).toEqual([10, 20]);
    });

    it("uses fontPx as a zoom-independent pixel size that wins over size", () => {
        for (const scale of [10, 50]) {
            const { draw, render } = setup(scale);
            const { canvas, ops } = makeCanvas();
            draw.drawText(
                [
                    {
                        x: 1,
                        y: 1,
                        text: "fixed",
                        fontPx: 14,
                        style: { fillStyle: "#000" },
                    },
                    {
                        x: 2,
                        y: 1,
                        text: "both",
                        size: 2,
                        fontPx: 14,
                        style: { fillStyle: "#000" },
                    },
                ],
                2,
            );
            render(canvas);

            const sizes = ops.filter((o) => o.op === "text").map((o) => o.fontSize);
            expect(sizes).toEqual([14, 14]);
        }
    });

    it("culls with measured text width rather than a font-size estimate", () => {
        const { draw, render } = setup(10);
        const { canvas, ops } = makeCanvas();
        // The mock measures six pixels per character independently of size.
        // A long label reaches the viewport even though its anchor is outside.
        draw.drawText(
            [
                { x: 20, y: 1, text: "culled", style: { fillStyle: "#000" } },
                {
                    x: 20,
                    y: 1,
                    text: "visible".repeat(6),
                    fontPx: 140,
                    style: { fillStyle: "#000" },
                },
            ],
            2,
        );
        render(canvas);

        const texts = ops.filter((o) => o.op === "text").map((o) => o.text);
        expect(texts).toEqual(["visible".repeat(6)]);
    });

    it("caches one font per family regardless of size", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();
        draw.drawText(
            [
                {
                    x: 1,
                    y: 1,
                    size: 1,
                    text: "a",
                    style: { fillStyle: "#000" },
                },
                {
                    x: 3,
                    y: 3,
                    size: 2,
                    text: "b",
                    style: { fillStyle: "#000" },
                },
            ],
            2,
        );
        render(canvas);
        render(canvas);

        expect(matchFontCalls).toHaveLength(1);
    });
});

describe("image opacity", () => {
    const fakeImage = {
        width: () => 10,
        height: () => 10,
    } as unknown as import("@shopify/react-native-skia").SkImage;

    // Image opacity contract shared by all renderers: alpha = opacity ?? 1.
    // Mirrors the fixture values in the canvas, webgl, and server suites.
    it("applies item opacity via paint alpha and restores it", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        draw.drawImage(
            [
                { x: 1, y: 1, img: fakeImage, opacity: 0.5 },
                { x: 3, y: 3, img: fakeImage },
                {
                    x: 5,
                    y: 5,
                    img: fakeImage,
                    sprite: { x: 0, y: 0, w: 5, h: 5 },
                    opacity: 0.25,
                },
            ],
            1,
        );
        render(canvas);

        const alphas = ops.filter((o) => o.op === "image").map((o) => o.alpha);
        expect(alphas).toEqual([0.5, 1, 0.25]);
    });

    it("records opacity into static pictures", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        draw.drawStaticImage([{ x: 1, y: 1, img: fakeImage, opacity: 0.5 }], "cache-img-opacity", 1);
        render(canvas);

        const picture = ops.find((o) => o.op === "picture")?.picture as MockPicture;
        const alphas = picture.ops.filter((o) => o.op === "image").map((o) => (o as Op).alpha);
        expect(alphas).toEqual([0.5]);
    });
});

describe("static picture cache", () => {
    const items = [
        { x: 1, y: 1, size: 1, style: { fillStyle: "#f00" } },
        { x: 3, y: 3, size: 1, style: { fillStyle: "#0f0" } },
    ];

    it("replays one cached picture per frame instead of per-item draw calls", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawStaticRect(items, "cache-a", 1);
        render(canvas);
        render(canvas);

        // No per-item rects hit the frame canvas — only picture replays.
        expect(ops.filter((o) => o.op === "rect")).toHaveLength(0);
        const pictureOps = ops.filter((o) => o.op === "picture");
        expect(pictureOps).toHaveLength(2);
        // Both frames replay the same recording.
        expect(pictureOps[0].picture).toBe(pictureOps[1].picture);
        const picture = pictureOps[0].picture as MockPicture;
        expect(picture.ops.filter((o) => o.op === "rect")).toHaveLength(2);
    });

    it("records geometry identical to the dynamic path", () => {
        const dynamic = setup();
        const dynamicCanvas = makeCanvas();
        dynamic.draw.drawRect(items, 1);
        dynamic.render(dynamicCanvas.canvas);
        const dynamicRects = dynamicCanvas.ops.filter((o) => o.op === "rect").map((o) => o.rect);

        const stat = setup();
        const staticCanvas = makeCanvas();
        stat.draw.drawStaticRect(items, "cache-b", 1);
        stat.render(staticCanvas.canvas);
        const picture = staticCanvas.ops.find((o) => o.op === "picture")?.picture as MockPicture;
        const staticRects = picture.ops.filter((o) => o.op === "rect").map((o) => o.rect);

        expect(staticRects).toEqual(dynamicRects);
    });

    it("ignores pixel sizes in all static picture primitives", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        const fakeImage = {
            width: () => 10,
            height: () => 10,
        } as unknown as import("@shopify/react-native-skia").SkImage;
        const item = Object.freeze({ x: 2, y: 2, size: 1, sizePx: 60, style: { fillStyle: "#f00" } });
        draw.drawStaticRect([{ ...item, width: 2, height: 1, widthPx: 70, heightPx: 80 }], "rect");
        draw.drawStaticCircle([item], "circle");
        draw.drawStaticImage([{ ...item, img: fakeImage }], "image");
        render(canvas);

        const recorded = ops.filter((o) => o.op === "picture").flatMap((o) => (o.picture as MockPicture).ops);
        expect(recorded.find((o) => o.op === "rect")?.rect).toEqual({ x: 15, y: 20, width: 20, height: 10 });
        expect(recorded.find((o) => o.op === "circle")).toMatchObject({ cx: 25, cy: 25, r: 5 });
        expect(recorded.find((o) => o.op === "image")?.dest).toEqual({ x: 20, y: 20, width: 10, height: 10 });
        expect(item.sizePx).toBe(60);
    });

    it("replays with the scale ratio when the camera zooms after recording", () => {
        const { draw, render, camera } = setup(10);
        const { canvas, ops } = makeCanvas();
        draw.drawStaticRect(items, "cache-c", 1);
        render(canvas);
        (camera as { scale: number }).scale = 20;
        render(canvas);

        const scaleOps = ops.filter((o) => o.op === "scale");
        expect(scaleOps[0]).toMatchObject({ sx: 1, sy: 1 });
        expect(scaleOps[1]).toMatchObject({ sx: 2, sy: 2 });
    });

    it("re-records after clearStaticCache, reuses otherwise", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        const first = draw.drawStaticRect(items, "cache-d", 1);
        render(canvas);
        draw.removeDrawHandle(first);

        // Same cacheKey without clearing → same picture instance.
        const second = draw.drawStaticRect(items, "cache-d", 1);
        render(canvas);
        draw.removeDrawHandle(second);

        // After clearing → a fresh recording.
        draw.clearStaticCache("cache-d");
        draw.drawStaticRect(items, "cache-d", 1);
        render(canvas);

        const pictures = ops.filter((o) => o.op === "picture").map((o) => o.picture);
        expect(pictures).toHaveLength(3);
        expect(pictures[1]).toBe(pictures[0]);
        expect(pictures[2]).not.toBe(pictures[0]);
    });

    it("covers per-axis width/height in the cull rect", () => {
        // A rect wider than its `size` must still record inside its own cull
        // rect: Skia is free to quick-reject or clip anything outside it.
        const { draw, render } = setup(10);
        const { canvas, ops } = makeCanvas();
        draw.drawStaticRect([{ x: 0, y: 0, width: 8, height: 2, style: { fillStyle: "#f00" } }], "cache-wh", 1);
        render(canvas);

        const picture = ops.find((o) => o.op === "picture")?.picture as MockPicture;
        const cull = picture.bounds as { x: number; y: number; width: number; height: number };
        const rect = (picture.ops.find((o) => o.op === "rect") as Op).rect as {
            x: number;
            y: number;
            width: number;
            height: number;
        };

        expect(cull.x).toBeLessThanOrEqual(rect.x);
        expect(cull.y).toBeLessThanOrEqual(rect.y);
        expect(cull.x + cull.width).toBeGreaterThanOrEqual(rect.x + rect.width);
        expect(cull.y + cull.height).toBeGreaterThanOrEqual(rect.y + rect.height);
    });

    it("draws nothing for an empty item list", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawStaticRect([], "cache-e", 1);
        render(canvas);
        expect(ops).toHaveLength(0);
    });
});

describe("static picture painted bounds", () => {
    interface Box {
        x: number;
        y: number;
        width: number;
        height: number;
    }

    interface Bounds {
        minX: number;
        minY: number;
        maxX: number;
        maxY: number;
    }

    function recordedPicture(ops: Op[]): MockPicture {
        const picture = ops.find((op) => op.op === "picture")?.picture as MockPicture;
        expect(picture).toBeDefined();
        return picture;
    }

    // Inspect the actual recording, independently of the production bounds
    // helper. A rectangle's stroke box must rotate with its geometry: adding
    // half the stroke width after rotation misses its outer mitered corners.
    function rotatedBounds(box: Box, picture: MockPicture, halfStroke = 0): Bounds {
        const rotation = picture.ops.find((op) => op.op === "rotate");
        const radians = ((rotation?.deg as number | undefined) ?? 0) * (Math.PI / 180);
        const cx = (rotation?.px as number | undefined) ?? box.x + box.width / 2;
        const cy = (rotation?.py as number | undefined) ?? box.y + box.height / 2;
        const corners = [
            [box.x - halfStroke, box.y - halfStroke],
            [box.x + box.width + halfStroke, box.y - halfStroke],
            [box.x + box.width + halfStroke, box.y + box.height + halfStroke],
            [box.x - halfStroke, box.y + box.height + halfStroke],
        ].map(([x, y]) => ({
            x: cx + (x - cx) * Math.cos(radians) - (y - cy) * Math.sin(radians),
            y: cy + (x - cx) * Math.sin(radians) + (y - cy) * Math.cos(radians),
        }));
        return {
            minX: Math.min(...corners.map((point) => point.x)),
            minY: Math.min(...corners.map((point) => point.y)),
            maxX: Math.max(...corners.map((point) => point.x)),
            maxY: Math.max(...corners.map((point) => point.y)),
        };
    }

    function expectPaddedCull(picture: MockPicture, painted: Bounds) {
        const cull = picture.bounds as Box;
        const right = cull.x + cull.width;
        const bottom = cull.y + cull.height;
        // One raster pixel of antialias padding, then outward pixel snapping.
        // Keep each margin below two pixels so a fixed world-unit heuristic
        // or a very loose enclosing square cannot satisfy the regression.
        for (const margin of [
            painted.minX - cull.x,
            painted.minY - cull.y,
            right - painted.maxX,
            bottom - painted.maxY,
        ]) {
            expect(margin).toBeGreaterThanOrEqual(1 - 1e-9);
            expect(margin).toBeLessThan(2 + 1e-9);
        }
        for (const edge of [cull.x, cull.y, right, bottom]) {
            expect(edge).toBeCloseTo(Math.round(edge), 9);
        }
    }

    it.each<{ name: string; scale: number; item: Rect; strokeWidth: number }>([
        {
            name: "a large rotated nonsquare fill at negative fractional coordinates",
            scale: 7.5,
            item: { x: -12.25, y: -8.75, width: 32, height: 20, rotate: 45, style: { fillStyle: "#f00" } },
            strokeWidth: 0,
        },
        {
            name: "a self-origin rectangle with a thick world-unit stroke",
            scale: 6.25,
            item: {
                x: -18.3,
                y: -4.2,
                width: 18,
                height: 4,
                origin: { mode: "self", x: 0, y: 1 },
                rotate: -33,
                style: { strokeStyle: "#f00", lineWidth: 6 },
            },
            strokeWidth: 37.5,
        },
        {
            name: "a shifted cell origin and pixel stroke overriding world width",
            scale: 3.5,
            item: {
                x: -4.3,
                y: 2.1,
                width: 2,
                height: 12,
                sizePx: 1000,
                widthPx: 2000,
                heightPx: 3000,
                origin: { mode: "cell", x: -2, y: 3 },
                rotate: 70,
                style: { strokeStyle: "#00f", lineWidth: 100, lineWidthPx: 48 },
            },
            strokeWidth: 48,
        },
        {
            name: "the default one-pixel stroke at a sub-unit recording scale",
            scale: 0.5,
            item: { x: -2.3, y: -5.7, width: 2, height: 4, style: { strokeStyle: "#000" } },
            strokeWidth: 1,
        },
    ])("contains $name", ({ scale, item, strokeWidth }) => {
        const { draw, render } = setup(scale);
        const { canvas, ops } = makeCanvas();
        draw.drawStaticRect([item], "painted-rect", 1);
        render(canvas);

        const picture = recordedPicture(ops);
        const rectOp = picture.ops.find((op) => op.op === "rect") as Op;
        const rect = rectOp.rect as Box;
        // Static geometry continues to use world dimensions, even if the
        // item also contains dynamic-path sizePx/widthPx/heightPx fields.
        expect(rect.width).toBe((item.width ?? item.size ?? 1) * scale);
        expect(rect.height).toBe((item.height ?? item.size ?? 1) * scale);
        if (strokeWidth > 0) {
            expect(rectOp.strokeWidth).toBe(strokeWidth);
        }
        expectPaddedCull(picture, rotatedBounds(rect, picture, strokeWidth / 2));
    });

    it.each<{ name: string; scale: number; item: Circle; strokeWidth: number }>([
        {
            name: "a self-origin circle and its thick world stroke",
            scale: 4.5,
            item: {
                x: -14.1,
                y: -8.3,
                size: 12,
                sizePx: 2000,
                origin: { mode: "self", x: 0, y: 1 },
                style: { strokeStyle: "#0f0", lineWidth: 8 },
            },
            strokeWidth: 36,
        },
        {
            name: "a shifted cell-origin circle with a pixel stroke",
            scale: 2.75,
            item: {
                x: -10.2,
                y: 3.1,
                size: 4,
                origin: { x: -3, y: 2 },
                style: { strokeStyle: "#00f", lineWidth: 20, lineWidthPx: 50 },
            },
            strokeWidth: 50,
        },
    ])("contains $name", ({ scale, item, strokeWidth }) => {
        const { draw, render } = setup(scale);
        const { canvas, ops } = makeCanvas();
        draw.drawStaticCircle([item], "painted-circle", 1);
        render(canvas);

        const picture = recordedPicture(ops);
        const circle = picture.ops.find((op) => op.op === "circle") as Op;
        expect(circle.r).toBe(((item.size ?? 1) * scale) / 2);
        expect(circle.strokeWidth).toBe(strokeWidth);
        const radius = (circle.r as number) + strokeWidth / 2;
        expectPaddedCull(picture, {
            minX: (circle.cx as number) - radius,
            minY: (circle.cy as number) - radius,
            maxX: (circle.cx as number) + radius,
            maxY: (circle.cy as number) + radius,
        });
    });

    it.each([
        { name: "the full image", sprite: undefined, width: 150, height: 50 },
        { name: "a tall sprite from a wide image", sprite: { x: 6, y: 8, w: 24, h: 72 }, width: 50, height: 150 },
    ])("tightly contains the rotated aspect-fit destination of $name", ({ sprite, width, height }) => {
        const { draw, render } = setup(7.5);
        const { canvas, ops } = makeCanvas();
        const img = { width: () => 360, height: () => 120 } as unknown as import("@shopify/react-native-skia").SkImage;
        draw.drawStaticImage(
            [
                {
                    x: -18.4,
                    y: -12.6,
                    size: 20,
                    sizePx: 3000,
                    origin: { mode: "self", x: 1, y: 0 },
                    rotate: -47,
                    flipX: true,
                    img,
                    sprite,
                },
            ],
            "painted-image",
            1,
        );
        render(canvas);

        const picture = recordedPicture(ops);
        const imageOp = picture.ops.find((op) => op.op === "image") as Op;
        const dest = imageOp.dest as Box;
        expect(dest).toMatchObject({ width, height });
        expect(imageOp.src).toEqual(
            sprite ? { x: 6, y: 8, width: 24, height: 72 } : { x: 0, y: 0, width: 360, height: 120 },
        );
        expectPaddedCull(picture, rotatedBounds(dest, picture));
    });

    it("excludes skipped zero-dimension images from a valid batch's bounds", () => {
        const { draw, render } = setup(10);
        const { canvas, ops } = makeCanvas();
        const empty = { width: () => 0, height: () => 0 } as unknown as import("@shopify/react-native-skia").SkImage;
        const loaded = {
            width: () => 100,
            height: () => 100,
        } as unknown as import("@shopify/react-native-skia").SkImage;
        draw.drawStaticImage(
            [
                { x: 10000, y: 10000, img: empty },
                { x: -4.2, y: -3.3, size: 4, img: loaded },
            ],
            "painted-image-skip-empty",
            1,
        );
        render(canvas);

        const picture = recordedPicture(ops);
        const images = picture.ops.filter((op) => op.op === "image");
        expect(images).toHaveLength(1);
        expectPaddedCull(picture, rotatedBounds(images[0].dest as Box, picture));
    });

    it("safely handles an image batch with no paintable dimensions", () => {
        const { draw, render } = setup(10);
        const { canvas, ops } = makeCanvas();
        const empty = { width: () => 0, height: () => 0 } as unknown as import("@shopify/react-native-skia").SkImage;
        expect(() => {
            draw.drawStaticImage([{ x: -20, y: -10, img: empty }], "painted-image-all-empty", 1);
            render(canvas);
        }).not.toThrow();

        for (const op of ops.filter((op) => op.op === "picture")) {
            const picture = op.picture as MockPicture;
            expect(picture.ops.filter((entry) => entry.op === "image")).toHaveLength(0);
            for (const value of Object.values(picture.bounds as Box)) {
                expect(Number.isFinite(value)).toBe(true);
            }
        }
    });
});

describe("stroke width handling", () => {
    // Stroke unit contract shared by all renderers: lineWidth is world units
    // (px = lineWidth * scale), lineWidthPx is screen pixels and wins.
    it("defaults to strokeWidth 1 when lineWidth is not given", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();
        draw.drawRect(
            [
                {
                    x: 1,
                    y: 1,
                    size: 1,
                    style: { strokeStyle: "#f00", lineWidth: 0.8 },
                },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#00f" } },
            ],
            1,
        );
        render(canvas);

        const strokes = ops.filter((o) => o.op === "rect");
        expect(strokes).toHaveLength(2);
        expect(strokes[0].strokeWidth).toBe(8); // world: 0.8 * scale 10
        expect(strokes[1].strokeWidth).toBe(1);
    });

    it("uses lineWidthPx as a zoom-independent pixel width that wins over lineWidth", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();
        draw.drawRect(
            [
                {
                    x: 1,
                    y: 1,
                    size: 1,
                    style: {
                        strokeStyle: "#f00",
                        lineWidth: 0.8,
                        lineWidthPx: 3,
                    },
                },
            ],
            1,
        );
        render(canvas);

        const strokes = ops.filter((o) => o.op === "rect");
        expect(strokes[0].strokeWidth).toBe(3);
    });
});

// Non-square rect contract shared by all renderers; mirrors the fixture
// values in the canvas, webgl, and server suites.
describe("non-square rects", () => {
    it("draws width/height boxes with per-axis origin anchoring", () => {
        const { draw, render } = setup(); // scale 10, camera at (0,0)
        const { canvas, ops } = makeCanvas();

        draw.drawRect(
            [
                {
                    x: 2,
                    y: 2,
                    width: 4,
                    height: 2,
                    style: { fillStyle: "#f00" },
                },
                { x: 2, y: 2, size: 1, style: { fillStyle: "#0f0" } },
                {
                    x: 1,
                    y: 1,
                    width: 2,
                    height: 1,
                    origin: { mode: "self", x: 0, y: 0 },
                    style: { fillStyle: "#00f" },
                },
            ],
            1,
        );
        render(canvas);

        const rects = ops.filter((o) => o.op === "rect").map((o) => o.rect);
        expect(rects).toEqual([
            { x: 5, y: 15, width: 40, height: 20 },
            { x: 20, y: 20, width: 10, height: 10 },
            { x: 15, y: 15, width: 20, height: 10 },
        ]);
    });

    it("culls with the max(width, height) extent", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        draw.drawRect(
            [
                {
                    x: 20,
                    y: 0,
                    width: 30,
                    height: 1,
                    style: { fillStyle: "#f00" },
                },
                { x: 20, y: 0, size: 1, style: { fillStyle: "#0f0" } },
            ],
            1,
        );
        render(canvas);

        const rects = ops.filter((o) => o.op === "rect");
        expect(rects).toHaveLength(1);
    });
});

// Per-item line style contract shared by all renderers: item.style overlays
// the call-level style field by field; the shared stroke paint is mutated for
// the item's draw and restored for the rest of the batch.
describe("per-item line style", () => {
    it("paints an item's own width/color and restores the batch paint", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();

        draw.drawLine(
            [
                { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
                { from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, style: { strokeStyle: "#f00", lineWidthPx: 6 } },
                { from: { x: 0, y: 2 }, to: { x: 1, y: 2 } },
            ],
            { strokeStyle: "#00f", lineWidthPx: 2 },
            1,
        );
        render(canvas);

        const lines = ops.filter((o) => o.op === "line");
        expect(lines.map((o) => o.strokeWidth)).toEqual([2, 6, 2]);
        expect(lines[1].color).toEqual({ parsed: "#f00" });
        expect(lines[2].color).toEqual({ parsed: "#00f" });
    });

    it("applies an item's own dash as a path effect and restores it", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();

        draw.drawLine(
            [
                { from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, style: { lineDash: [0.8, 0.4] } },
                { from: { x: 0, y: 1 }, to: { x: 1, y: 1 } },
            ],
            { strokeStyle: "#00f" },
            1,
        );
        render(canvas);

        const lines = ops.filter((o) => o.op === "line");
        expect(lines[0].pathEffect).toEqual({ __dash: [8, 4], phase: 0 });
        expect(lines[1].pathEffect).toBeNull();
    });
});

describe("smuggled decoration width on lines", () => {
    it("resolves the painted width from registration-time layers only", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        // Non-literal returns bypass TS excess-property checks; the width
        // must resolve from the layers hit testing reads.
        const smuggled = { strokeStyle: "#0f0", lineWidthPx: 12 };
        draw.drawLine(
            [{ from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, style: { lineWidthPx: 4 } }],
            { strokeStyle: "#00f", lineWidthPx: 2 },
            1,
            { styleOf: () => smuggled },
        );
        render(canvas);

        const lines = ops.filter((o) => o.op === "line");
        expect(lines).toHaveLength(1);
        expect(lines[0].color).toEqual({ parsed: "#0f0" }); // deco color applies
        expect(lines[0].strokeWidth).toBe(4); // item width, not the smuggled 12
    });
});

describe("smuggled decoration geometry on paths", () => {
    it("resolves the stroked width from the registration-time item style", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        // Non-literal returns bypass TS excess-property checks; the width
        // must come from the layers hit testing reads.
        const smuggled = { strokeStyle: "#0f0", lineWidthPx: 12 };
        draw.drawPath(
            [
                {
                    points: [
                        { x: 0, y: 0 },
                        { x: 4, y: 0 },
                        { x: 4, y: 4 },
                    ],
                    style: { strokeStyle: "#f00", lineWidthPx: 4 },
                },
            ],
            1,
            { styleOf: () => smuggled },
        );
        render(canvas);

        const paths = ops.filter((o) => o.op === "path");
        expect(paths).toHaveLength(1);
        expect(paths[0].strokeWidth).toBe(4); // item width, not the smuggled 12
    });
});
// Dash unit contract shared by all renderers: lineDash is world units
// (px = value * scale), lineDashPx is screen pixels and wins. On Skia the
// pattern lands on the stroke paint as a dash path effect.
describe("dashed rect/circle borders", () => {
    it("applies world lineDash to rect strokes scaled by the camera scale", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();

        draw.drawRect(
            [
                {
                    x: 1,
                    y: 1,
                    size: 1,
                    style: { strokeStyle: "#f00", lineDash: [0.5, 0.25] },
                },
            ],
            1,
        );
        render(canvas);

        expect(ops).toHaveLength(1);
        expect(ops[0].pathEffect).toEqual({ __dash: [5, 2.5], phase: 0 });
    });

    it("applies lineDashPx to circle strokes and resets the effect afterwards", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        draw.drawCircle(
            [
                {
                    x: 1,
                    y: 1,
                    size: 1,
                    style: { strokeStyle: "#f00", lineDashPx: [6, 3] },
                },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#00f" } }, // stays solid
            ],
            1,
        );
        render(canvas);

        const circles = ops.filter((o) => o.op === "circle");
        expect(circles).toHaveLength(2);
        expect(circles[0].pathEffect).toEqual({ __dash: [6, 3], phase: 0 });
        expect(circles[1].pathEffect).toBeNull();
    });

    it("keeps fills unaffected by a dashed border", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        draw.drawRect(
            [
                {
                    x: 1,
                    y: 1,
                    size: 1,
                    style: {
                        fillStyle: "#0f0",
                        strokeStyle: "#f00",
                        lineDashPx: [4, 2],
                    },
                },
            ],
            1,
        );
        render(canvas);

        expect(ops).toHaveLength(2); // fill + stroke
        expect(ops[0].pathEffect).toBeNull();
        expect(ops[1].pathEffect).toEqual({ __dash: [4, 2], phase: 0 });
    });
});

// Pixel-sized rect contract shared by all renderers; the same fixture values
// are asserted in the canvas, webgl, and server suites.
describe("pixel-sized rects", () => {
    it("resolves each axis against the live scale", () => {
        const { draw, render } = setup(); // scale 10, camera at (0,0)
        const { canvas, ops } = makeCanvas();

        draw.drawRect(
            [
                { x: 2, y: 2, size: 4, sizePx: 30, style: { fillStyle: "#f00" } },
                { x: 2, y: 2, size: 4, sizePx: 30, widthPx: 50, style: { fillStyle: "#0f0" } },
                { x: 2, y: 2, widthPx: 50, height: 4, style: { fillStyle: "#00f" } },
            ],
            1,
        );
        render(canvas);

        const rects = ops.filter((o) => o.op === "rect").map((o) => o.rect);
        expect(rects).toEqual([
            { x: 10, y: 10, width: 30, height: 30 },
            { x: 0, y: 10, width: 50, height: 30 },
            { x: 0, y: 5, width: 50, height: 40 },
        ]);
    });
});

// Font weight contract shared by all renderers; the canvas, webgl and server
// suites assert the same fixture through their font shorthand.
describe("text font weight", () => {
    it("matches a typeface per weight and keeps them apart in the cache", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();

        draw.drawText(
            [
                { x: 1, y: 1, text: "plain" },
                { x: 2, y: 1, text: "bold", style: { fontWeight: "bold" } },
                { x: 3, y: 1, text: "numeric", style: { fontWeight: 700 } },
            ],
            2,
        );
        render(canvas);
        // Second frame: every font is served from the cache
        render(canvas);

        expect(matchFontCalls.map((call) => call.fontWeight)).toEqual([undefined, "bold", "700"]);
    });
});

const topToBottom = {
    type: "linear" as const,
    from: { x: 0, y: 0 },
    to: { x: 0, y: 1 },
    stops: [
        { offset: 0, color: "#f00" },
        { offset: 1, color: "#00f" },
    ],
};

// Gradient fill contract shared by all renderers; the canvas, webgl and
// server suites assert the same geometry through their own recorders.
describe("gradient fills", () => {
    it("runs a box-unit axis across the item's drawn box", () => {
        const { draw, render } = setup(); // scale 10, camera at (0,0)
        const { canvas, ops } = makeCanvas();

        // size 2 at (2,2) -> screen box (15,15,20,20)
        draw.drawRect([{ x: 2, y: 2, size: 2, style: { fillStyle: topToBottom } }], 1);
        render(canvas);

        expect(gradientCalls).toHaveLength(1);
        expect(gradientCalls[0].start).toEqual({ x: 15, y: 15 });
        expect(gradientCalls[0].end).toEqual({ x: 15, y: 35 });
        expect(gradientCalls[0].pos).toEqual([0, 1]);
        expect(ops.filter((o) => o.op === "rect")).toHaveLength(1);
    });

    it("clears the shader again so later solid fills stay solid", () => {
        // fillPaint is shared across the whole frame, so a leaked shader
        // would tint every rect drawn after the gradient one
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        draw.drawRect(
            [
                { x: 2, y: 2, size: 2, style: { fillStyle: topToBottom } },
                { x: 6, y: 2, size: 2, style: { fillStyle: "#0f0" } },
            ],
            1,
        );
        render(canvas);

        const shaders = ops.filter((o) => o.op === "rect").map((o) => o.shader);
        expect(shaders[0]).toBeTruthy();
        expect(shaders[1]).toBeNull();
    });

    it("projects world units through the camera", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();

        draw.drawRect(
            [
                {
                    x: 2,
                    y: 2,
                    style: {
                        fillStyle: {
                            ...topToBottom,
                            units: "world" as const,
                            from: { x: 0, y: 0 },
                            to: { x: 0, y: 4 },
                        },
                    },
                },
            ],
            1,
        );
        render(canvas);

        expect(gradientCalls[0].start).toEqual({ x: 5, y: 5 });
        expect(gradientCalls[0].end).toEqual({ x: 5, y: 45 });
    });

    it("normalizes stops into ascending positions", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();

        draw.drawRect(
            [
                {
                    x: 2,
                    y: 2,
                    style: {
                        fillStyle: {
                            ...topToBottom,
                            stops: [
                                { offset: 2, color: "late" },
                                { offset: -1, color: "early" },
                            ],
                        },
                    },
                },
            ],
            1,
        );
        render(canvas);

        // MakeLinearGradient takes a position array it expects ascending
        expect(gradientCalls[0].pos).toEqual([0, 1]);
        expect(gradientCalls[0].colors).toEqual([{ parsed: "early" }, { parsed: "late" }]);
    });

    it("leaves a plain color string on the solid path", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();

        draw.drawRect([{ x: 2, y: 2, style: { fillStyle: "#0f0" } }], 1);
        render(canvas);

        expect(gradientCalls).toHaveLength(0);
    });
});
