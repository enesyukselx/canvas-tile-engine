import { beforeEach, describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import type { SkCanvas } from "@shopify/react-native-skia";
import { SkiaDraw } from "../../src/modules/SkiaDraw";
import { Layer } from "../../src/modules/Layer";
import { colorParseCalls, matchFontCalls, type MockFont, type MockPaint } from "../mocks/react-native-skia";

interface Op {
    op: string;
    [key: string]: unknown;
}

// Recording canvas: paints are shared and mutated between draws, so state is
// captured at call time (mirroring Skia's snapshot-on-record semantics).
function makeCanvas() {
    const ops: Op[] = [];
    const canvas = {
        save: () => 1,
        restoreToCount: () => {},
        rotate: () => {},
        drawRect: (rect: unknown, paint: MockPaint) =>
            ops.push({ op: "rect", rect, style: paint.style, color: paint.color, strokeWidth: paint.strokeWidth }),
        drawRRect: (rrect: unknown, paint: MockPaint) =>
            ops.push({ op: "rrect", rrect, style: paint.style, color: paint.color }),
        drawCircle: (cx: number, cy: number, r: number, paint: MockPaint) =>
            ops.push({ op: "circle", cx, cy, r, style: paint.style, strokeWidth: paint.strokeWidth }),
        drawLine: (x1: number, y1: number, x2: number, y2: number, paint: MockPaint) =>
            ops.push({ op: "line", x1, y1, x2, y2, strokeWidth: paint.strokeWidth }),
        drawText: (text: string, x: number, y: number, _paint: MockPaint, font: MockFont) =>
            ops.push({ op: "text", text, x, y, fontSize: font.size }),
        drawPath: () => ops.push({ op: "path" }),
        drawImageRect: () => ops.push({ op: "image" }),
    } as unknown as SkCanvas;
    return { canvas, ops };
}

function setup(scale = 10) {
    const camera = { x: 0, y: 0, scale } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer();
    const draw = new SkiaDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    const render = (canvas: SkCanvas) =>
        layers.drawAll({ canvas, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
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
        expect(textOp?.fontSize).toBe(1 * 11.5 * 0.3);
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
