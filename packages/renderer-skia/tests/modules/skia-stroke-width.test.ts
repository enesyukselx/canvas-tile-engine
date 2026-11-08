import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CoordinateTransformer, type ICamera } from "@canvas-tile-engine/core";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import type { SkCanvas } from "../../src";
import { SkiaDraw } from "../../src/modules/SkiaDraw";
import type { SkiaDrawContext } from "../../src/types";
import { Skia, type MockOp, type MockPaint } from "../mocks/react-native-skia";

/**
 * Stroke widths in screen pixels follow the Canvas2D renderers'
 * `applyLineWidth` and WebGL's `resolveStroke` on every renderer: a width of 1
 * or more is used as is; a narrower one draws a 1px line with the color's
 * alpha scaled by the width, so 0 or less draws nothing. Skia's native rules
 * differ (0 is a 1px hairline, a negative width is ignored), so SkiaDraw maps
 * the width itself.
 */

// SkColor is an RGBA Float32Array in react-native-skia, and the alpha scaling
// reads it. The shared mock returns an opaque token instead, so this file
// parses a few colors itself (a local spy: the shared mock is unchanged).
const COLORS: Record<string, [number, number, number, number]> = {
    "#f00": [1, 0, 0, 1],
    "#00f": [0, 0, 1, 1],
    "#000000": [0, 0, 0, 1],
    "rgba(0, 0, 255, 0.5)": [0, 0, 1, 0.5],
};

beforeEach(() => {
    // Skia's setColor replaces the paint's whole RGBA, so it also undoes an
    // earlier setAlphaf; the shared mock keeps the two apart. Emulate it on
    // the paints this file's SkiaDraw instances create.
    const makePaint = Skia.Paint;
    vi.spyOn(Skia, "Paint").mockImplementation(() => {
        const paint = makePaint();
        const setColor = paint.setColor;
        paint.setColor = (color: unknown) => {
            setColor(color);
            paint.alphaf = (color as Float32Array)[3];
        };
        return paint;
    });
    vi.spyOn(Skia, "Color").mockImplementation(((value: string) => {
        const rgba = COLORS[value];
        if (!rgba) {
            throw new Error(`test color table has no ${value}`);
        }
        return Float32Array.of(...rgba);
    }) as unknown as typeof Skia.Color);
});

afterEach(() => {
    vi.restoreAllMocks();
});

interface StrokeOp {
    op: string;
    style: number;
    strokeWidth: number;
    alpha: number;
}

/** Records every draw with the paint state at call time, alpha included. */
function makeCanvas() {
    const ops: StrokeOp[] = [];
    const record = (op: string, paint: MockPaint) =>
        ops.push({ op, style: paint.style, strokeWidth: paint.strokeWidth, alpha: paint.alphaf });
    const canvas = {
        save: () => ops.length,
        restoreToCount() {},
        rotate() {},
        translate() {},
        scale() {},
        drawRect: (_rect: unknown, paint: MockPaint) => record("rect", paint),
        drawRRect: (_rrect: unknown, paint: MockPaint) => record("rrect", paint),
        drawCircle: (_cx: number, _cy: number, _r: number, paint: MockPaint) => record("circle", paint),
        drawLine: (_x1: number, _y1: number, _x2: number, _y2: number, paint: MockPaint) => record("line", paint),
        drawPath: (_path: unknown, paint: MockPaint) => record("path", paint),
        drawPicture() {},
    };
    return { canvas: canvas as unknown as SkCanvas, ops };
}

const STROKE = 1; // PaintStyle.Stroke in the mock

function setup(scale = 10) {
    const camera = { x: 0, y: 0, scale } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<SkiaDrawContext>();
    const draw = new SkiaDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    const render = (canvas: SkCanvas) =>
        layers.drawAll({ ctx: canvas, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

const strokes = (ops: StrokeOp[]) => ops.filter((o) => o.style === STROKE);
/** A stroke paints only with a positive alpha: alpha 0 is Skia's no-op. */
const visible = (ops: StrokeOp[]) => strokes(ops).filter((o) => o.alpha > 0);

describe("grid line width (screen pixels)", () => {
    it.each([0, -1])("draws nothing for lineWidth %s", (lineWidth) => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawGridLines(1, { strokeStyle: "#f00", lineWidth });
        render(canvas);

        expect(visible(ops)).toEqual([]);
    });

    it("draws a sub-pixel width as a 1px line at proportional alpha", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawGridLines(1, { strokeStyle: "#f00", lineWidth: 0.25 });
        render(canvas);

        const lines = strokes(ops);
        expect(lines.length).toBeGreaterThan(0);
        for (const line of lines) {
            expect(line).toMatchObject({ op: "line", strokeWidth: 1, alpha: 0.25 });
        }
    });

    it("multiplies the stroke color's own alpha", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawGridLines(1, { strokeStyle: "rgba(0, 0, 255, 0.5)", lineWidth: 0.5 });
        render(canvas);

        expect(strokes(ops)[0]).toMatchObject({ strokeWidth: 1, alpha: 0.25 });
    });

    it("keeps widths of 1px and more as they are", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();
        draw.drawGridLines(1, { strokeStyle: "#f00", lineWidth: 2 });
        render(canvas);

        const lines = strokes(ops);
        expect(lines.length).toBeGreaterThan(0);
        expect(lines.every((l) => l.strokeWidth === 2 && l.alpha === 1)).toBe(true);
    });
});

describe("shape, line and path stroke widths", () => {
    it("draws no rect or circle outline for a zero or negative width", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();
        draw.drawRect({ x: 0, y: 0, size: 1, style: { strokeStyle: "#f00", lineWidth: 0 } });
        draw.drawRect({ x: 2, y: 0, size: 1, radius: 0.2, style: { strokeStyle: "#f00", lineWidthPx: 0 } });
        draw.drawCircle({ x: 4, y: 0, size: 1, style: { strokeStyle: "#f00", lineWidthPx: -2 } });
        render(canvas);

        expect(strokes(ops).map((o) => o.op)).toEqual(["rect", "rrect", "circle"]);
        expect(visible(ops)).toEqual([]);
    });

    it("draws a sub-pixel outline as 1px at proportional alpha and restores alpha for the next item", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();
        draw.drawRect(
            [
                { x: 0, y: 0, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.05 } }, // 0.5px
                { x: 2, y: 0, size: 1, style: { strokeStyle: "#00f", lineWidth: 0.2 } }, // 2px
            ],
            1,
        );
        draw.drawCircle({ x: 4, y: 0, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 0.4 } });
        render(canvas);

        expect(strokes(ops)).toEqual([
            { op: "rect", style: STROKE, strokeWidth: 1, alpha: 0.5 },
            { op: "rect", style: STROKE, strokeWidth: 2, alpha: 1 },
            { op: "circle", style: STROKE, strokeWidth: 1, alpha: expect.closeTo(0.4) },
        ]);
    });

    it("applies the rule to batched lines and to per-item line styles", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();
        draw.drawLine(
            [
                { from: { x: 0, y: 0 }, to: { x: 1, y: 0 } },
                { from: { x: 0, y: 1 }, to: { x: 1, y: 1 }, style: { lineWidth: 0.3 } }, // 3px
                { from: { x: 0, y: 2 }, to: { x: 1, y: 2 } },
                { from: { x: 0, y: 3 }, to: { x: 1, y: 3 }, style: { lineWidth: 0 } },
            ],
            { strokeStyle: "#f00", lineWidth: 0.05 }, // 0.5px batch width
        );
        render(canvas);

        expect(strokes(ops).map(({ strokeWidth, alpha }) => ({ strokeWidth, alpha }))).toEqual([
            { strokeWidth: 1, alpha: 0.5 },
            { strokeWidth: 3, alpha: 1 },
            { strokeWidth: 1, alpha: 0.5 },
            { strokeWidth: 1, alpha: 0 },
        ]);
    });

    it("draws no path outline for a zero width, and a sub-pixel one at proportional alpha", () => {
        const { draw, render } = setup(); // scale 10
        const { canvas, ops } = makeCanvas();
        const square = [
            { x: 0, y: 0 },
            { x: 1, y: 0 },
            { x: 1, y: 1 },
        ];
        draw.drawPath([
            { points: square, style: { strokeStyle: "#f00", lineWidthPx: 0 } },
            { points: square, style: { strokeStyle: "#f00", lineWidth: 0.05 } }, // 0.5px
        ]);
        render(canvas);

        expect(strokes(ops)).toEqual([
            { op: "path", style: STROKE, strokeWidth: 1, alpha: 0 },
            { op: "path", style: STROKE, strokeWidth: 1, alpha: 0.5 },
        ]);
    });

    it("records static outlines with the same rule at the record scale", () => {
        const recorded: StrokeOp[] = [];
        vi.spyOn(Skia, "PictureRecorder").mockImplementation((() => {
            const { canvas, ops } = makeCanvas();
            return {
                beginRecording: () => canvas,
                finishRecordingAsPicture: () => {
                    recorded.push(...ops);
                    return { __picture: true, ops: [] as MockOp[] };
                },
            };
        }) as unknown as typeof Skia.PictureRecorder);

        const { draw } = setup(); // record scale 10
        draw.drawStaticRect(
            [
                { x: 0, y: 0, size: 1, style: { strokeStyle: "#f00", lineWidth: 0 } },
                { x: 2, y: 0, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.05 } }, // 0.5px
            ],
            "outlines",
        );

        expect(strokes(recorded)).toEqual([
            { op: "rect", style: STROKE, strokeWidth: 1, alpha: 0 },
            { op: "rect", style: STROKE, strokeWidth: 1, alpha: 0.5 },
        ]);
    });
});
