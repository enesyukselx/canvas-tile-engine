import { describe, expect, it, vi } from "vitest";
import { CoordinateTransformer, type ICamera, type Rect, type Text } from "@canvas-tile-engine/core";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import type { GLRenderer, ImageInstance, LineInstance, ShapeInstance } from "../../src/modules/gl/GLRenderer";

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<WebGLDrawContext>();
    const draw = new WebGLDraw(layers, transformer, camera);
    const shapes: ShapeInstance[] = [];
    const lines: LineInstance[] = [];
    const images: ImageInstance[] = [];
    const texts: string[] = [];
    const gl = {
        drawShapes: (items: ShapeInstance[]) => shapes.push(...items),
        drawLines: (items: LineInstance[]) => lines.push(...items),
        drawImages: (items: ImageInstance[]) => images.push(...items),
        getTexture: () => ({}) as WebGLTexture,
    } as unknown as GLRenderer;
    const ctx = {
        font: "10px sans-serif",
        textAlign: "center",
        textBaseline: "middle",
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        fillText: (text: string) => texts.push(text),
        measureText: vi.fn((text: string) => {
            const size = Number(/([\d.]+)px/.exec(ctx.font)?.[1] ?? 10);
            const width = text.length * size * (ctx.font.includes("wide") ? 2 : 0.6);
            const left = ctx.textAlign === "left" ? 0 : ctx.textAlign === "right" ? width : width / 2;
            const ascent = ctx.textBaseline === "top" ? 0 : ctx.textBaseline === "alphabetic" ? size * 0.8 : size / 2;
            return {
                actualBoundingBoxLeft: left + 2,
                actualBoundingBoxRight: width - left,
                actualBoundingBoxAscent: ascent,
                actualBoundingBoxDescent: size - ascent,
            };
        }),
    };
    const render = () => {
        shapes.length = lines.length = images.length = texts.length = 0;
        layers.drawAll({
            ctx: ctx as unknown as CanvasRenderingContext2D,
            gl,
            camera,
            transformer,
            config: { size: { width: 100, height: 100 }, scale: camera.scale } as never,
            topLeft: { x: 0, y: 0 },
        });
    };
    return { draw, render, camera: camera as { scale: number }, ctx, shapes, lines, images, texts };
}

function batch<T extends { x: number; y: number }>(item: T, count: number): T[] {
    return [item, ...Array.from({ length: count - 1 }, (_, n) => ({ ...item, x: 1000 + n, y: 1000 }))];
}

describe.each([1, 501])("WebGL painted bounds (%i items)", (count) => {
    it.each<Rect>([
        { x: -20, y: 2, width: 4, height: 2, origin: { mode: "self", x: -5, y: 0 } },
        { x: 20, y: 2, size: 2, origin: { mode: "cell", x: -20, y: 0.5 } },
        { x: 16.4, y: 2, size: 10, rotate: 45 },
    ])("keeps visible shifted or rotated rects %#", (item) => {
        const { draw, render, shapes } = setup();
        draw.drawRect(batch({ ...item, style: { fillStyle: "#f00" } }, count));
        render();
        expect(shapes).toHaveLength(1);
    });

    it("keeps thick rect and circle strokes whose geometry is offscreen", () => {
        const { draw, render, lines } = setup();
        const item = { x: 14, y: 2, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 100 } };
        draw.drawRect(batch(item, count));
        draw.drawCircle(batch(item, count));
        render();
        expect(lines.length).toBeGreaterThan(48);
    });

    it("keeps rotated and non-centered images", () => {
        const { draw, render, images } = setup();
        const img = { width: 10, height: 10 } as HTMLImageElement;
        draw.drawImage(batch({ x: 16.4, y: 2, size: 10, rotate: 45, img }, count));
        draw.drawImage(batch({ x: -20, y: 2, size: 4, origin: { mode: "self" as const, x: -5, y: 0 }, img }, count));
        render();
        expect(images).toHaveLength(2);
    });

    it.each<Text>([
        { x: -40, y: 2, text: "long".repeat(25), fontPx: 10, style: { textAlign: "left" } },
        { x: 50, y: 2, text: "long".repeat(25), fontPx: 10, style: { textAlign: "right" } },
        { x: 25, y: 2, text: "long".repeat(25), fontPx: 10 },
        { x: 2, y: -40, text: "long".repeat(25), fontPx: 10, rotate: 90, style: { textAlign: "left" } },
    ])("keeps measured aligned and rotated text %#", (item) => {
        const { draw, render, texts } = setup();
        draw.drawText(batch(item, count));
        render();
        expect(texts).toEqual([item.text]);
    });

    it("rebuilds pixel-sized shape and text bounds after zoom", () => {
        const { draw, render, camera, shapes, texts } = setup();
        draw.drawRect(batch({ x: 20, y: 2, sizePx: 300, style: { fillStyle: "#f00" } }, count));
        draw.drawText(batch({ x: 20, y: 2, text: "x".repeat(40), fontPx: 10 }, count));
        render();
        expect(shapes).toHaveLength(1);
        expect(texts).toHaveLength(1);
        camera.scale = 40;
        render();
        expect(shapes).toHaveLength(0);
        expect(texts).toHaveLength(0);
    });

    it("rechecks live stroke and text styles once per item each frame", () => {
        const { draw, render, lines, texts } = setup();
        let expanded = false;
        const shapeStyle = vi.fn(() => ({ strokeStyle: "#f00", lineWidthPx: expanded ? 500 : 1 }));
        const textStyle = vi.fn(() => ({ fontFamily: expanded ? "wide" : "sans-serif" }));
        draw.drawRect(batch({ x: 20, y: 2, size: 1 }, count), 1, { styleOf: shapeStyle });
        draw.drawText(batch({ x: 20, y: 2, text: "x".repeat(20), fontPx: 10 }, count), 2, { styleOf: textStyle });
        render();
        expect(lines).toHaveLength(0);
        expect(texts).toHaveLength(0);
        expanded = true;
        render();
        expect(lines.length).toBeGreaterThan(0);
        expect(texts).toHaveLength(1);
        expect(shapeStyle).toHaveBeenCalledTimes(2 * count);
        expect(textStyle).toHaveBeenCalledTimes(2 * count);
    });
});

describe("WebGL stroke and text edge cases", () => {
    it("includes line and path stroke thickness", () => {
        const { draw, render, lines } = setup();
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
        expect(lines).toHaveLength(2);
    });

    it("caches ink metrics across frames", () => {
        const { draw, render, ctx } = setup();
        draw.drawText(batch({ x: 1, y: 1, text: "same", fontPx: 10 }, 501));
        render();
        render();
        expect(ctx.measureText).toHaveBeenCalledTimes(1);
    });

    it("does not guess finite bounds when actual ink metrics are unavailable", () => {
        const { draw, render, ctx, texts } = setup();
        ctx.measureText.mockReturnValue({ width: 1 } as never);
        draw.drawText({ x: -100, y: 1, text: "possibly overhanging", fontPx: 10 });
        render();
        expect(texts).toEqual(["possibly overhanging"]);
    });
});
