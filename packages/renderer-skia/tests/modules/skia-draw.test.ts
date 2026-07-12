import { beforeEach, describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import type { SkCanvas } from "@shopify/react-native-skia";
import { SkiaDraw } from "../../src/modules/SkiaDraw";
import { Layer } from "../../src/modules/Layer";
import { colorParseCalls, makeRecordingCanvas, matchFontCalls, type MockPicture } from "../mocks/react-native-skia";

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
    const layers = new Layer();
    const draw = new SkiaDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    const render = (canvas: SkCanvas) =>
        layers.drawAll({ canvas, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render, camera };
}

beforeEach(() => {
    colorParseCalls.length = 0;
    matchFontCalls.length = 0;
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

    it("expands a single-element array to all four corners", () => {
        const op = drawAndGetRRect([10]);
        // Uniform radius goes through RRectXY
        expect(op.op).toBe("rrect");
        expect(op.rrect).toMatchObject({ rx: 10, ry: 10 });
    });

    it("expands a two-element array as [tl+br, tr+bl]", () => {
        const op = drawAndGetRRect([10, 5]);
        expect(op.op).toBe("rrect");
        expect(op.rrect).toMatchObject({
            topLeft: { x: 10, y: 10 },
            topRight: { x: 5, y: 5 },
            bottomRight: { x: 10, y: 10 },
            bottomLeft: { x: 5, y: 5 },
        });
    });

    it("expands a three-element array as [tl, tr+bl, br]", () => {
        const op = drawAndGetRRect([10, 5, 2]);
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
            1
        );
        render(canvas);
        render(canvas); // second frame reuses the cache too

        expect(colorParseCalls.filter((c) => c === "#ff0000")).toHaveLength(1);
        expect(colorParseCalls.filter((c) => c === "#00ff00")).toHaveLength(1);
    });
});

describe("text rendering", () => {
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
                { x: 2, y: 1, text: "sized", size: 2, style: { fillStyle: "#000" } },
            ],
            2
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
                    { x: 1, y: 1, text: "fixed", fontPx: 14, style: { fillStyle: "#000" } },
                    { x: 2, y: 1, text: "both", size: 2, fontPx: 14, style: { fillStyle: "#000" } },
                ],
                2
            );
            render(canvas);

            const sizes = ops.filter((o) => o.op === "text").map((o) => o.fontSize);
            expect(sizes).toEqual([14, 14]);
        }
    });

    it("culls with the fontPx world-space extent (fontPx / scale)", () => {
        const { draw, render } = setup(10);
        const { canvas, ops } = makeCanvas();
        // Viewport spans 10 world units (+1 tile buffer). x=20 with size 1 is
        // out of reach, but a 140px label spans 14 world units and pokes in.
        draw.drawText(
            [
                { x: 20, y: 1, text: "culled", style: { fillStyle: "#000" } },
                { x: 20, y: 1, text: "visible", fontPx: 140, style: { fillStyle: "#000" } },
            ],
            2
        );
        render(canvas);

        const texts = ops.filter((o) => o.op === "text").map((o) => o.text);
        expect(texts).toEqual(["visible"]);
    });

    it("caches one font per family regardless of size", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();
        draw.drawText(
            [
                { x: 1, y: 1, size: 1, text: "a", style: { fillStyle: "#000" } },
                { x: 3, y: 3, size: 2, text: "b", style: { fillStyle: "#000" } },
            ],
            2
        );
        render(canvas);
        render(canvas);

        expect(matchFontCalls).toHaveLength(1);
    });
});

describe("image opacity", () => {
    const fakeImage = { width: () => 10, height: () => 10 } as unknown as import("@shopify/react-native-skia").SkImage;

    // Image opacity contract shared by all renderers: alpha = opacity ?? 1.
    // Mirrors the fixture values in the canvas, webgl, and server suites.
    it("applies item opacity via paint alpha and restores it", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        draw.drawImage(
            [
                { x: 1, y: 1, img: fakeImage, opacity: 0.5 },
                { x: 3, y: 3, img: fakeImage },
                { x: 5, y: 5, img: fakeImage, sprite: { x: 0, y: 0, w: 5, h: 5 }, opacity: 0.25 },
            ],
            1
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

    it("draws nothing for an empty item list", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawStaticRect([], "cache-e", 1);
        render(canvas);
        expect(ops).toHaveLength(0);
    });
});

describe("stroke width handling", () => {
    it("defaults to strokeWidth 1 when lineWidth is not given", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawRect(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidth: 8 } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#00f" } },
            ],
            1
        );
        render(canvas);

        const strokes = ops.filter((o) => o.op === "rect");
        expect(strokes).toHaveLength(2);
        expect(strokes[0].strokeWidth).toBe(8);
        expect(strokes[1].strokeWidth).toBe(1);
    });
});
