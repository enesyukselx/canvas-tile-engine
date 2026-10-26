import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoordinateTransformer, type ICamera, type Rect, type Text } from "@canvas-tile-engine/core";
import * as nativeSkia from "@shopify/react-native-skia";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { SkiaDraw } from "../../src/modules/SkiaDraw";
import type { SkiaDrawContext } from "../../src/types";
import { makeRecordingCanvas } from "../mocks/react-native-skia";

const measureText = vi.fn<(text: string, size: number, family: string) => nativeSkia.SkRect>();

beforeEach(() => {
    measureText.mockReset();
    measureText.mockImplementation((text, size, family) => ({
        x: -2,
        y: -0.8 * size,
        width: text.length * size * (family === "wide" ? 2 : 0.6),
        height: size,
    }));
    vi.spyOn(nativeSkia, "matchFont").mockImplementation((style) => {
        let size = style?.fontSize ?? 10;
        return {
            get size() {
                return size;
            },
            setSize(value: number) {
                size = value;
            },
            measureText: (text: string) => measureText(text, size, style?.fontFamily ?? "sans-serif"),
            getMetrics: () => ({ ascent: -0.8 * size, descent: 0.2 * size }),
        } as unknown as nativeSkia.SkFont;
    });
});

afterEach(() => vi.restoreAllMocks());

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<SkiaDrawContext>();
    const draw = new SkiaDraw(layers, transformer, camera);
    const { canvas, ops } = makeRecordingCanvas();
    const render = () => {
        ops.length = 0;
        layers.drawAll({
            ctx: canvas as unknown as nativeSkia.SkCanvas,
            camera,
            transformer,
            config: { size: { width: 100, height: 100 }, scale: camera.scale } as never,
            topLeft: { x: 0, y: 0 },
        });
    };
    return { draw, render, camera: camera as { scale: number }, ops };
}

function batch<T extends { x: number; y: number }>(item: T, count: number): T[] {
    return [item, ...Array.from({ length: count - 1 }, (_, n) => ({ ...item, x: 1000 + n, y: 1000 }))];
}

describe.each([1, 501])("Skia painted bounds (%i items)", (count) => {
    it.each<Rect>([
        { x: -20, y: 2, width: 4, height: 2, origin: { mode: "self", x: -5, y: 0 } },
        { x: 20, y: 2, size: 2, origin: { mode: "cell", x: -20, y: 0.5 } },
        { x: 16.4, y: 2, size: 10, rotate: 45 },
    ])("keeps visible shifted or rotated rects %#", (item) => {
        const { draw, render, ops } = setup();
        draw.drawRect(batch({ ...item, style: { fillStyle: "#f00" } }, count));
        render();
        expect(ops.filter(({ op }) => op === "rect")).toHaveLength(1);
    });

    it("keeps thick rect and circle strokes whose geometry is offscreen", () => {
        const { draw, render, ops } = setup();
        const item = { x: 14, y: 2, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 100 } };
        draw.drawRect(batch(item, count));
        draw.drawCircle(batch(item, count));
        render();
        expect(ops.map(({ op }) => op)).toEqual(["rect", "circle"]);
    });

    it("keeps rotated and non-centered images", () => {
        const { draw, render, ops } = setup();
        const img = { width: () => 10, height: () => 10 } as nativeSkia.SkImage;
        draw.drawImage(batch({ x: 16.4, y: 2, size: 10, rotate: 45, img }, count));
        draw.drawImage(batch({ x: -20, y: 2, size: 4, origin: { mode: "self" as const, x: -5, y: 0 }, img }, count));
        render();
        expect(ops.filter(({ op }) => op === "image")).toHaveLength(2);
    });

    it.each<Text>([
        { x: -40, y: 2, text: "long".repeat(25), fontPx: 10, style: { textAlign: "left" } },
        { x: 50, y: 2, text: "long".repeat(25), fontPx: 10, style: { textAlign: "right" } },
        { x: 25, y: 2, text: "long".repeat(25), fontPx: 10 },
        { x: 2, y: -40, text: "long".repeat(25), fontPx: 10, rotate: 90, style: { textAlign: "left" } },
    ])("keeps measured aligned and rotated text %#", (item) => {
        const { draw, render, ops } = setup();
        draw.drawText(batch(item, count));
        render();
        expect(ops.filter(({ op }) => op === "text").map(({ text }) => text)).toEqual([item.text]);
    });

    it("rebuilds pixel-sized shape and text bounds after zoom", () => {
        const { draw, render, camera, ops } = setup();
        draw.drawRect(batch({ x: 20, y: 2, sizePx: 300, style: { fillStyle: "#f00" } }, count));
        draw.drawText(batch({ x: 20, y: 2, text: "x".repeat(40), fontPx: 10 }, count));
        render();
        expect(ops.map(({ op }) => op)).toEqual(["rect", "text"]);
        camera.scale = 40;
        render();
        expect(ops).toHaveLength(0);
    });

    it("rechecks live stroke and text styles once per item each frame", () => {
        const { draw, render, ops } = setup();
        let expanded = false;
        const shapeStyle = vi.fn(() => ({ strokeStyle: "#f00", lineWidthPx: expanded ? 500 : 1 }));
        const textStyle = vi.fn(() => ({ fontFamily: expanded ? "wide" : "sans-serif" }));
        draw.drawRect(batch({ x: 20, y: 2, size: 1 }, count), 1, { styleOf: shapeStyle });
        draw.drawText(batch({ x: 20, y: 2, text: "x".repeat(20), fontPx: 10 }, count), 2, { styleOf: textStyle });
        render();
        expect(ops).toHaveLength(0);
        expanded = true;
        render();
        expect(ops.map(({ op }) => op)).toEqual(["rect", "text"]);
        expect(shapeStyle).toHaveBeenCalledTimes(2 * count);
        expect(textStyle).toHaveBeenCalledTimes(2 * count);
    });
});

describe("Skia stroke and text edge cases", () => {
    it("includes line and path stroke thickness", () => {
        const { draw, render, ops } = setup();
        draw.drawLine({ from: { x: 14, y: 1 }, to: { x: 14, y: 5 } }, { lineWidthPx: 100 });
        draw.drawPath([
            {
                points: [
                    { x: 14, y: 1 },
                    { x: 14, y: 5 },
                ],
                style: { lineWidthPx: 100 },
            },
        ]);
        render();
        expect(ops.map(({ op }) => op)).toEqual(["line", "path"]);
    });

    it("caches ink metrics and alignment across frames", () => {
        const { draw, render } = setup();
        draw.drawText(batch({ x: 1, y: 1, text: "same", fontPx: 10 }, 501));
        render();
        render();
        expect(measureText).toHaveBeenCalledTimes(1);
    });

    it("keys cached bounds by font, text, alignment and baseline", () => {
        const { draw, render } = setup();
        draw.drawText([
            { x: 1, y: 1, text: "same", fontPx: 10 },
            { x: 1, y: 1, text: "same", fontPx: 11 },
            { x: 1, y: 1, text: "other", fontPx: 10 },
            { x: 1, y: 1, text: "same", fontPx: 10, style: { textAlign: "left" } },
            { x: 1, y: 1, text: "same", fontPx: 10, style: { textBaseline: "top" } },
            { x: 1, y: 1, text: "same", fontPx: 10, style: { fontWeight: "bold" } },
            { x: 1, y: 1, text: "same", fontPx: 10, style: { fontFamily: "wide" } },
        ]);
        render();
        render();
        expect(measureText).toHaveBeenCalledTimes(7);
    });
});
