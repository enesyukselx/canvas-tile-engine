import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    CoordinateTransformer,
    type Coords,
    type ICamera,
    type LinearGradient,
    type PathItem,
    type Rect,
} from "@canvas-tile-engine/core";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { SkiaDraw } from "../../src/modules/SkiaDraw";
import type { SkiaDrawContext } from "../../src/types";
import {
    PaintStyle,
    Skia,
    gradientCalls,
    makeRecordingCanvas,
    type MockOp,
    type MockPaint,
} from "../mocks/react-native-skia";

// The shared mock has no `FillType` and its paths only know moveTo/lineTo,
// which is all the stroked-path tests need. Filling a path needs both, so this
// file adds them locally rather than widening the shared mock.
vi.mock("../mocks/react-native-skia", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../mocks/react-native-skia")>()),
    FillType: { Winding: 0, EvenOdd: 1 },
}));

type SkCanvas = SkiaDrawContext["ctx"];

/** A fill as Skia would paint it: the paint state at draw time. */
interface Fill {
    op: string;
    alpha: number;
    shader: unknown;
    color: unknown;
}

/**
 * Alpha of a color as the mock parses it (`Skia.Color(v)` is `{ parsed: v }`).
 * Real `SkPaint.setColor` takes the color's alpha along with its RGB; the
 * shared mock paint leaves `alphaf` alone, which is what hid the leak.
 */
function alphaOf(color: unknown): number {
    const value = (color as { parsed: string }).parsed;
    if (value === "transparent") {
        return 0;
    }
    const rgba = /^rgba\(.*,\s*([\d.]+)\)$/.exec(value);
    return rgba ? Number(rgba[1]) : 1;
}

/** Wrap a mock canvas so every fill records the paint state it drew with. */
function trackFills(canvas: unknown, fills: Fill[]): unknown {
    const target = canvas as Record<string, (...args: unknown[]) => void>;
    for (const op of ["drawRect", "drawRRect", "drawCircle", "drawPath"]) {
        const original = target[op];
        target[op] = (...args: unknown[]) => {
            const paint = args[args.length - 1] as MockPaint;
            if (paint.style === PaintStyle.Fill) {
                fills.push({ op, alpha: paint.alphaf, shader: paint.shader, color: paint.color });
            }
            original(...args);
        };
    }
    return canvas;
}

function makeCanvas() {
    const { canvas, ops } = makeRecordingCanvas();
    const fills: Fill[] = [];
    trackFills(canvas, fills);
    return { canvas: canvas as unknown as SkCanvas, ops, fills };
}

function setup(camera: { x: number; y: number; scale: number } = { x: 0, y: 0, scale: 10 }) {
    const cam = { ...camera } as unknown as ICamera & { x: number; y: number; scale: number };
    const transformer = new CoordinateTransformer(cam);
    const layers = new Layer<SkiaDrawContext>();
    const draw = new SkiaDraw(layers, transformer, cam);
    const render = (canvas: SkCanvas) =>
        layers.drawAll({
            ctx: canvas,
            camera: cam,
            transformer,
            // 100 x 100 cells at scale 10: nothing in these tests is culled.
            config: { size: { width: 1000, height: 1000 }, scale: cam.scale } as never,
            topLeft: { x: cam.x, y: cam.y },
        });

    // Model SkPaint.setColor carrying the color's alpha onto the paint.
    const fillPaint = (draw as unknown as { fillPaint: MockPaint }).fillPaint;
    const setColor = fillPaint.setColor;
    fillPaint.setColor = (color: unknown) => {
        setColor(color);
        fillPaint.alphaf = alphaOf(color);
    };

    return { draw, render, camera: cam, transformer };
}

/** Fills recorded into every picture made from here on. */
function trackPictureFills(): Fill[] {
    const fills: Fill[] = [];
    const makeRecorder = Skia.PictureRecorder;
    vi.spyOn(Skia, "PictureRecorder").mockImplementation(() => {
        const recorder = makeRecorder();
        const beginRecording = recorder.beginRecording;
        recorder.beginRecording = (cullRect?: unknown) => trackFills(beginRecording(cullRect), fills);
        return recorder;
    });
    return fills;
}

/** Native RN Skia rejects fewer than two colors; the shared mock does not. */
function throwLikeNativeOnFewerThanTwoColors() {
    const makeLinearGradient = Skia.Shader.MakeLinearGradient;
    vi.spyOn(Skia.Shader, "MakeLinearGradient").mockImplementation((start, end, colors, pos) => {
        if (colors.length < 2) {
            throw new Error("colors must have at least 2 colors");
        }
        return makeLinearGradient(start, end, colors, pos);
    });
}

/** Where a picture-space point lands on screen under the frame's replay transform. */
function replayed(ops: MockOp[], point: Coords): Coords {
    const at = ops.findIndex((o) => o.op === "picture");
    const translate = ops.slice(0, at).findLast((o) => o.op === "translate") as MockOp & { x: number; y: number };
    const scale = ops.slice(0, at).findLast((o) => o.op === "scale") as MockOp & { sx: number; sy: number };
    return { x: point.x * scale.sx + translate.x, y: point.y * scale.sy + translate.y };
}

/** Rotate `point` by `degrees` about `pivot`, the way `canvas.rotate(deg, px, py)` maps it. */
function rotateAbout(point: Coords, pivot: Coords, degrees: number): Coords {
    const radians = (degrees * Math.PI) / 180;
    const dx = point.x - pivot.x;
    const dy = point.y - pivot.y;
    return {
        x: pivot.x + dx * Math.cos(radians) - dy * Math.sin(radians),
        y: pivot.y + dx * Math.sin(radians) + dy * Math.cos(radians),
    };
}

function expectPoint(actual: Coords, expected: Coords) {
    expect(actual.x).toBeCloseTo(expected.x, 9);
    expect(actual.y).toBeCloseTo(expected.y, 9);
}

const ramp: LinearGradient = {
    type: "linear",
    from: { x: 0, y: 0 },
    to: { x: 0, y: 1 },
    stops: [
        { offset: 0, color: "#f00" },
        { offset: 1, color: "#00f" },
    ],
};

/** World ramp left to right across world x 0..10. */
const worldRamp: LinearGradient = { ...ramp, units: "world", from: { x: 0, y: 0 }, to: { x: 10, y: 0 } };

beforeEach(() => {
    gradientCalls.length = 0;
});

afterEach(() => vi.restoreAllMocks());

// Skia modulates a shader by the paint's alpha, and the fill paint is shared
// across items and frames, so a gradient must never inherit the alpha the
// previous solid or text fill left behind. Canvas2D and WebGL paint the
// gradient's own colors whatever came before.
describe("gradient fill alpha", () => {
    it("paints a gradient rect opaque after a translucent solid fill", () => {
        const { draw, render } = setup();
        const { canvas, fills } = makeCanvas();

        draw.drawRect([
            { x: 1, y: 1, style: { fillStyle: "rgba(255, 0, 0, 0.2)" } },
            { x: 3, y: 1, style: { fillStyle: ramp } },
        ]);
        render(canvas);

        expect(fills).toHaveLength(2);
        expect(fills[0].alpha).toBe(0.2);
        expect(fills[1].shader).toBeTruthy();
        expect(fills[1].alpha).toBe(1);
    });

    it("keeps a gradient circle visible after a 'transparent' fill", () => {
        const { draw, render } = setup();
        const { canvas, fills } = makeCanvas();

        draw.drawRect({ x: 1, y: 1, style: { fillStyle: "transparent" } });
        draw.drawCircle({ x: 3, y: 1, style: { fillStyle: ramp } });
        render(canvas);

        const circle = fills.find((f) => f.op === "drawCircle")!;
        expect(circle.shader).toBeTruthy();
        expect(circle.alpha).toBe(1);
    });

    it("does not let a translucent label fade the next frame's gradient", () => {
        const { draw, render } = setup();

        draw.drawRect({ x: 1, y: 1, style: { fillStyle: ramp } }, 1);
        draw.drawText({ x: 1, y: 3, text: "label", style: { fillStyle: "rgba(0, 0, 0, 0.5)" } }, 2);

        const first = makeCanvas();
        render(first.canvas);
        const second = makeCanvas();
        render(second.canvas);

        expect(first.fills[0].alpha).toBe(1);
        expect(second.fills[0].shader).toBeTruthy();
        expect(second.fills[0].alpha).toBe(1);
    });

    it("records a static gradient opaque after a translucent frame", () => {
        const { draw, render } = setup();
        const pictureFills = trackPictureFills();

        draw.drawRect({ x: 1, y: 1, style: { fillStyle: "rgba(255, 0, 0, 0.2)" } });
        render(makeCanvas().canvas);
        draw.drawStaticRect([{ x: 3, y: 1, style: { fillStyle: ramp } }], "static-alpha");

        expect(pictureFills).toHaveLength(1);
        expect(pictureFills[0].shader).toBeTruthy();
        expect(pictureFills[0].alpha).toBe(1);
    });
});

// Shared contract (draw-object.ts, docs): an empty stop list paints nothing
// and a single stop paints flat, which is what Canvas2D and WebGL do. Native
// RN Skia's MakeLinearGradient throws for fewer than two colors, so Skia has
// to resolve both cases before reaching it.
describe("gradients with fewer than two stops", () => {
    const empty: LinearGradient = { ...ramp, stops: [] };
    const single: LinearGradient = { ...ramp, stops: [{ offset: 0.3, color: "rgba(0, 0, 255, 0.5)" }] };

    beforeEach(() => throwLikeNativeOnFewerThanTwoColors());

    it("stubs the native throw", () => {
        const point = { x: 0, y: 0 };
        expect(() => Skia.Shader.MakeLinearGradient(point, point, [Skia.Color("#f00")], [0])).toThrow(
            "colors must have at least 2 colors",
        );
    });

    it("paints nothing for an empty stop list but keeps the stroke", () => {
        const { draw, render } = setup();
        const { canvas, ops, fills } = makeCanvas();

        draw.drawRect({ x: 1, y: 1, style: { fillStyle: empty, strokeStyle: "#000" } });
        draw.drawCircle({ x: 3, y: 1, style: { fillStyle: empty, strokeStyle: "#000" } });
        expect(() => render(canvas)).not.toThrow();

        expect(fills).toHaveLength(0);
        expect(gradientCalls).toHaveLength(0);
        expect(ops.filter((o) => o.style === PaintStyle.Stroke)).toHaveLength(2);
    });

    it("paints a single stop flat in its own color", () => {
        const { draw, render } = setup();
        const { canvas, fills } = makeCanvas();

        draw.drawRect({ x: 1, y: 1, style: { fillStyle: single } });
        draw.drawCircle({ x: 3, y: 1, style: { fillStyle: single } });
        expect(() => render(canvas)).not.toThrow();

        expect(gradientCalls).toHaveLength(0);
        expect(fills).toHaveLength(2);
        for (const fill of fills) {
            expect(fill.shader).toBeNull();
            expect(fill.color).toEqual({ parsed: "rgba(0, 0, 255, 0.5)" });
            expect(fill.alpha).toBe(0.5);
        }
    });

    it("handles both on path fills", () => {
        const makePath = Skia.Path.Make;
        vi.spyOn(Skia.Path, "Make").mockImplementation(() =>
            Object.assign(makePath(), { close() {}, setFillType() {} }),
        );
        const { draw, render } = setup();
        const { canvas, fills } = makeCanvas();
        const triangle = (fillStyle: LinearGradient): PathItem => ({
            points: [
                { x: 0, y: 0 },
                { x: 4, y: 0 },
                { x: 4, y: 4 },
            ],
            closed: true,
            style: { fillStyle },
        });

        draw.drawPath([triangle(empty), triangle(single)]);
        expect(() => render(canvas)).not.toThrow();

        // The empty fill draws nothing (and, fill-only, no outline either).
        expect(fills).toHaveLength(1);
        expect(fills[0].shader).toBeNull();
        expect(fills[0].color).toEqual({ parsed: "rgba(0, 0, 255, 0.5)" });
    });

    it("does not throw from a static registration", () => {
        const { draw } = setup();
        const pictureFills = trackPictureFills();

        expect(() =>
            draw.drawStaticRect(
                [
                    { x: 1, y: 1, style: { fillStyle: empty } },
                    { x: 3, y: 1, style: { fillStyle: single } },
                ],
                "static-stops",
            ),
        ).not.toThrow();
        expect(() =>
            draw.drawStaticCircle([{ x: 1, y: 1, style: { fillStyle: empty } }], "static-circle"),
        ).not.toThrow();

        expect(pictureFills).toHaveLength(1);
        expect(pictureFills[0].shader).toBeNull();
        expect(pictureFills[0].color).toEqual({ parsed: "rgba(0, 0, 255, 0.5)" });
    });
});

// A static picture is recorded as if the camera sat at the origin and replay
// adds the live camera offset back, so a world axis has to be recorded in that
// same picture space. Projecting it with the registration-time camera bakes
// that camera's offset in, and replay then applies an offset a second time.
describe("world-unit gradients on static pictures", () => {
    it.each([
        [
            "drawStaticRect",
            (draw: SkiaDraw) => draw.drawStaticRect([{ x: 5, y: 5, style: { fillStyle: worldRamp } }], "r"),
        ],
        [
            "drawStaticCircle",
            (draw: SkiaDraw) => draw.drawStaticCircle([{ x: 5, y: 5, style: { fillStyle: worldRamp } }], "c"),
        ],
    ])("%s records the axis in picture space, not with the registration camera", (_name, register) => {
        const { draw } = setup({ x: -10, y: -10, scale: 10 });

        register(draw);

        // World (0,0) -> (10,0) at the origin camera, scale 10
        expect(gradientCalls).toHaveLength(1);
        expect(gradientCalls[0].start).toEqual({ x: 5, y: 5 });
        expect(gradientCalls[0].end).toEqual({ x: 105, y: 5 });
    });

    it("replays the axis where the live camera projects it, whatever the camera", () => {
        const { draw, render, camera, transformer } = setup({ x: -10, y: -10, scale: 10 });

        draw.drawStaticRect([{ x: 5, y: 5, style: { fillStyle: worldRamp } }], "pan");
        const { start, end } = gradientCalls[0];

        for (const view of [
            { x: -10, y: -10 },
            { x: 0, y: 0 },
            { x: 3, y: -2 },
        ]) {
            camera.x = view.x;
            camera.y = view.y;
            const { canvas, ops } = makeCanvas();
            render(canvas);
            expectPoint(replayed(ops, start), transformer.worldToScreen(0, 0));
            expectPoint(replayed(ops, end), transformer.worldToScreen(10, 0));
        }
    });
});

// Box units are the shape's own box, so a rotated shape's ramp turns with it.
// World units stay fixed in the world: Canvas2D and WebGL un-rotate the axis
// into the shape's frame. Skia reads shader points in the frame
// canvas.rotate(deg, cx, cy) sets up, so the axis is un-rotated about the
// pivot there.
describe("world-unit gradients on rotated rects", () => {
    // Size-10 rect at (5,5), scale 10: a 100px box centered on (55,55).
    const rotated = (rotate: number, fillStyle: LinearGradient): Rect => ({
        x: 5,
        y: 5,
        size: 10,
        rotate,
        style: { fillStyle },
    });

    it("un-rotates a world axis about the rect's pivot", () => {
        const { draw, render } = setup();
        const { canvas, ops } = makeCanvas();

        draw.drawRect(rotated(90, worldRamp));
        render(canvas);

        expect(ops.find((o) => o.op === "rotate")).toMatchObject({ deg: 90, px: 55, py: 55 });
        // World (0,0) -> (10,0) projects to (5,5) -> (105,5)
        expectPoint(gradientCalls[0].start, { x: 5, y: 105 });
        expectPoint(gradientCalls[0].end, { x: 5, y: 5 });
    });

    it.each([30, 45, 90, 180, -60])("keeps a world axis fixed in the world at %s degrees", (deg) => {
        const { draw, render, transformer } = setup();
        const { canvas } = makeCanvas();

        draw.drawRect(rotated(deg, worldRamp));
        render(canvas);

        // Under the canvas rotation the shader's points land on the world
        // axis's own projection.
        const pivot = { x: 55, y: 55 };
        expectPoint(rotateAbout(gradientCalls[0].start, pivot, deg), transformer.worldToScreen(0, 0));
        expectPoint(rotateAbout(gradientCalls[0].end, pivot, deg), transformer.worldToScreen(10, 0));
    });

    it("leaves a box-unit axis in the shape's frame so it turns with the shape", () => {
        const { draw, render } = setup();
        const { canvas } = makeCanvas();

        draw.drawRect(rotated(90, ramp));
        render(canvas);

        // Top to bottom of the unrotated box (5,5,100,100)
        expect(gradientCalls[0].start).toEqual({ x: 5, y: 5 });
        expect(gradientCalls[0].end).toEqual({ x: 5, y: 105 });
    });

    it("composes with picture space on a static rect", () => {
        const { draw, render, camera, transformer } = setup({ x: -10, y: -10, scale: 10 });

        draw.drawStaticRect([rotated(90, worldRamp)], "rotated");
        const { start, end } = gradientCalls[0];

        // The picture-space pivot is (55,55) and world (0,0) -> (10,0) is
        // (5,5) -> (105,5) there; un-rotated by 90 degrees about the pivot.
        expectPoint(start, { x: 5, y: 105 });
        expectPoint(end, { x: 5, y: 5 });

        // And on screen, under the recorded rotation and the replay
        // transform, the axis sits on the live projection.
        camera.x = 2;
        camera.y = 3;
        const { canvas, ops } = makeCanvas();
        render(canvas);
        const pivot = { x: 55, y: 55 };
        expectPoint(replayed(ops, rotateAbout(start, pivot, 90)), transformer.worldToScreen(0, 0));
        expectPoint(replayed(ops, rotateAbout(end, pivot, 90)), transformer.worldToScreen(10, 0));
    });
});
