import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { CanvasDraw } from "../../src/modules/CanvasDraw";
import { Layer } from "../../src/modules/Layer";

// Minimal fake 2D context that records state at every stroke()/fill() call.
function makeRecordingCtx() {
    const strokes: Array<{ lineWidth: number; globalAlpha: number }> = [];
    const fills: Array<{ globalAlpha: number }> = [];
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        fillStyle: "#000",
        strokeStyle: "#000",
        save() {},
        restore() {},
        beginPath() {},
        rect() {},
        arc() {},
        moveTo() {},
        lineTo() {},
        translate() {},
        rotate() {},
        fill() {
            fills.push({ globalAlpha: ctx.globalAlpha });
        },
        stroke() {
            strokes.push({ lineWidth: ctx.lineWidth, globalAlpha: ctx.globalAlpha });
        },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes, fills };
}

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer();
    const draw = new CanvasDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const render = (ctx: CanvasRenderingContext2D) =>
        layers.drawAll({ ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

describe("CanvasDraw lineWidth handling", () => {
    // Stroke unit contract shared by all renderers: lineWidth is world units
    // (px = lineWidth * scale), lineWidthPx is screen pixels and wins.
    it("scales world lineWidth by the camera scale", () => {
        const { draw, render } = setup(); // scale 10
        const { ctx, strokes } = makeRecordingCtx();

        draw.drawRect([{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.5 } }], 1);
        render(ctx);

        expect(strokes).toHaveLength(1);
        expect(strokes[0].lineWidth).toBe(5);
        expect(strokes[0].globalAlpha).toBe(1);
    });

    it("uses lineWidthPx as a zoom-independent pixel width that wins over lineWidth", () => {
        const { draw, render } = setup(); // scale 10
        const { ctx, strokes } = makeRecordingCtx();

        draw.drawRect(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 3 } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.5, lineWidthPx: 3 } },
            ],
            1,
        );
        render(ctx);

        expect(strokes.map((s) => s.lineWidth)).toEqual([3, 3]);
    });

    it("applies the sub-pixel lineWidth alpha to every item, not just the first", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeRecordingCtx();

        draw.drawRect(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 0.5 } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 0.5 } },
                { x: 5, y: 5, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 0.5 } },
            ],
            1,
        );
        render(ctx);

        expect(strokes).toHaveLength(3);
        for (const stroke of strokes) {
            expect(stroke.lineWidth).toBe(1);
            expect(stroke.globalAlpha).toBe(0.5);
        }
    });

    it("keeps fills opaque when a sub-pixel lineWidth is used for the stroke", () => {
        const { draw, render } = setup();
        const { ctx, fills } = makeRecordingCtx();

        draw.drawRect(
            [{ x: 1, y: 1, size: 1, style: { fillStyle: "#0f0", strokeStyle: "#f00", lineWidthPx: 0.5 } }],
            1,
        );
        render(ctx);

        expect(fills).toHaveLength(1);
        expect(fills[0].globalAlpha).toBe(1);
    });

    it("defaults to a 1px hairline instead of leaking the previous item's width", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeRecordingCtx();

        draw.drawRect(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 8 } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#00f" } }, // no lineWidth
            ],
            1,
        );
        render(ctx);

        expect(strokes).toHaveLength(2);
        expect(strokes[0].lineWidth).toBe(8);
        expect(strokes[1].lineWidth).toBe(1);
    });

    it("handles circles the same way as rects", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeRecordingCtx();

        draw.drawCircle(
            [
                { x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineWidth: 0.5 } },
                { x: 3, y: 3, size: 1, style: { strokeStyle: "#f00", lineWidthPx: 0.5 } },
            ],
            1,
        );
        render(ctx);

        expect(strokes).toHaveLength(2);
        expect(strokes[0].lineWidth).toBe(5); // world: 0.5 * scale 10
        expect(strokes[1].lineWidth).toBe(1); // sub-pixel px width -> alpha trick
        expect(strokes[1].globalAlpha).toBe(0.5);
    });
});

// Fake 2D context recording setLineDash calls and strokes for dash tests.
function makeDashRecordingCtx() {
    const dashes: number[][] = [];
    let strokeCount = 0;
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        fillStyle: "#000",
        strokeStyle: "#000",
        save() {},
        restore() {},
        beginPath() {},
        rect() {},
        arc() {},
        moveTo() {},
        lineTo() {},
        fill() {},
        setLineDash(pattern: number[]) {
            dashes.push(pattern);
        },
        stroke() {
            strokeCount++;
        },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, dashes, strokes: () => strokeCount };
}

// Dash unit contract shared by all renderers: lineDash is world units
// (px = value * scale), lineDashPx is screen pixels and wins.
describe("CanvasDraw line dash", () => {
    const path = [
        { x: 0, y: 0 },
        { x: 5, y: 0 },
    ];

    it("scales world lineDash by the camera scale", () => {
        const { draw, render } = setup(); // scale 10
        const { ctx, dashes } = makeDashRecordingCtx();

        draw.drawPath([{ points: path, style: { strokeStyle: "#f00", lineDash: [0.8, 0.4] } }], 1);
        render(ctx);

        expect(dashes).toEqual([[8, 4]]);
    });

    it("passes lineDashPx through unscaled and prefers it over lineDash", () => {
        const { draw, render } = setup();
        const { ctx, dashes } = makeDashRecordingCtx();

        draw.drawLine(
            [{ from: { x: 0, y: 0 }, to: { x: 5, y: 0 } }],
            { strokeStyle: "#f00", lineDash: [0.8], lineDashPx: [6, 3] },
            1,
        );
        render(ctx);

        expect(dashes).toEqual([[6, 3]]);
    });

    it("stays solid (no setLineDash call) when no dash is given", () => {
        const { draw, render } = setup();
        const { ctx, dashes, strokes } = makeDashRecordingCtx();

        draw.drawPath([{ points: path, style: { strokeStyle: "#f00", lineWidth: 0.2 } }], 1);
        render(ctx);

        expect(dashes).toEqual([]);
        expect(strokes()).toBe(1);
    });

    it("dashes rect borders with the same unit contract and resets after the stroke", () => {
        const { draw, render } = setup(); // scale 10
        const { ctx, dashes } = makeDashRecordingCtx();

        draw.drawRect([{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineDash: [0.8, 0.4] } }], 1);
        render(ctx);

        expect(dashes).toEqual([[8, 4], []]);
    });

    it("dashes circle borders and prefers lineDashPx over lineDash", () => {
        const { draw, render } = setup();
        const { ctx, dashes } = makeDashRecordingCtx();

        draw.drawCircle(
            [{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00", lineDash: [0.8], lineDashPx: [6, 3] } }],
            1,
        );
        render(ctx);

        expect(dashes).toEqual([[6, 3], []]);
    });

    it("keeps rect/circle borders solid when no dash is given", () => {
        const { draw, render } = setup();
        const { ctx, dashes, strokes } = makeDashRecordingCtx();

        draw.drawRect([{ x: 1, y: 1, size: 1, style: { strokeStyle: "#f00" } }], 1);
        draw.drawCircle([{ x: 3, y: 3, size: 1, style: { fillStyle: "#0f0", strokeStyle: "#f00" } }], 1);
        render(ctx);

        expect(dashes).toEqual([]);
        expect(strokes()).toBe(2);
    });
});

// Transform contract shared by all renderers: worldToScreen takes item-space
// coords (integers = cell centers), screenToWorld returns raw corner-space.
describe("CanvasDraw custom draw transform", () => {
    it("hands worldToScreen/screenToWorld helpers to draw functions", () => {
        const { draw, render } = setup(); // scale 10, camera at (0,0)
        const { ctx } = makeRecordingCtx();

        let toScreen: { x: number; y: number } | undefined;
        let toWorld: { x: number; y: number } | undefined;
        draw.addDrawFunction((_ctx, _coords, _config, transform) => {
            toScreen = transform.worldToScreen(2, 3);
            toWorld = transform.screenToWorld(25, 35);
        }, 1);
        render(ctx);

        // Item-space (2,3) is the center of cell (2,3): (2.5, 3.5) * 10
        expect(toScreen).toEqual({ x: 25, y: 35 });
        // screenToWorld reports raw corner-space, like event coords.raw
        expect(toWorld).toEqual({ x: 2.5, y: 3.5 });
    });
});

// Fake 2D context recording every rect(x, y, w, h) call.
function makeRectRecordingCtx() {
    const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        fillStyle: "#000",
        strokeStyle: "#000",
        save() {},
        restore() {},
        beginPath() {},
        translate() {},
        rotate() {},
        fill() {},
        stroke() {},
        rect(x: number, y: number, w: number, h: number) {
            rects.push({ x, y, w, h });
        },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, rects };
}

// Non-square rect contract shared by all renderers; the same fixture values
// are asserted in the webgl, skia, and server suites.
describe("CanvasDraw non-square rects", () => {
    it("draws width/height boxes with per-axis origin anchoring", () => {
        const { draw, render } = setup(); // scale 10, camera at (0,0)
        const { ctx, rects } = makeRectRecordingCtx();

        draw.drawRect(
            [
                // cell-center origin: world box [0,4]x[1,3] -> screen (5,15,40,20)
                { x: 2, y: 2, width: 4, height: 2, style: { fillStyle: "#f00" } },
                // square regression: size-only behavior is unchanged
                { x: 2, y: 2, size: 1, style: { fillStyle: "#0f0" } },
                // self origin {0,0}: top-left pinned to the coordinate
                { x: 1, y: 1, width: 2, height: 1, origin: { mode: "self", x: 0, y: 0 }, style: { fillStyle: "#00f" } },
            ],
            1,
        );
        render(ctx);

        expect(rects).toEqual([
            { x: 5, y: 15, w: 40, h: 20 },
            { x: 20, y: 20, w: 10, h: 10 },
            { x: 15, y: 15, w: 20, h: 10 },
        ]);
    });

    it("culls with the max(width, height) extent", () => {
        const { draw, render } = setup();
        const { ctx, rects } = makeRectRecordingCtx();

        // Viewport spans 10 world units (+1 buffer). The anchor at x=20 is far
        // outside, but a 30-wide bar reaches back into view.
        draw.drawRect(
            [
                { x: 20, y: 0, width: 30, height: 1, style: { fillStyle: "#f00" } },
                { x: 20, y: 0, size: 1, style: { fillStyle: "#0f0" } }, // stays culled
            ],
            1,
        );
        render(ctx);

        expect(rects).toHaveLength(1);
        expect(rects[0].w).toBe(300);
    });
});

// Minimal fake 2D context that records the active font at every fillText() call.
function makeTextRecordingCtx() {
    const texts: Array<{ text: string; font: string }> = [];
    const ctx = {
        font: "",
        fillStyle: "#000",
        textAlign: "center",
        textBaseline: "middle",
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        fillText(text: string) {
            texts.push({ text, font: ctx.font });
        },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, texts };
}

function setupAtScale(scale: number) {
    const camera = { x: 0, y: 0, scale } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer();
    const draw = new CanvasDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale } as never;
    const render = (ctx: CanvasRenderingContext2D) =>
        layers.drawAll({ ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

// Font sizing contract shared by all renderers: px = fontPx ?? size * scale.
// The same fixture values are asserted in the webgl, skia, and server suites.
describe("CanvasDraw text font sizing", () => {
    it("renders size in world units (px = size * scale)", () => {
        const { draw, render } = setupAtScale(10);
        const { ctx, texts } = makeTextRecordingCtx();

        draw.drawText([
            { x: 1, y: 1, text: "default" },
            { x: 2, y: 1, text: "sized", size: 2 },
        ]);
        render(ctx);

        expect(texts).toEqual([
            { text: "default", font: "10px sans-serif" },
            { text: "sized", font: "20px sans-serif" },
        ]);
    });

    it("uses fontPx as a zoom-independent pixel size that wins over size", () => {
        for (const scale of [10, 50]) {
            const { draw, render } = setupAtScale(scale);
            const { ctx, texts } = makeTextRecordingCtx();

            draw.drawText([
                { x: 1, y: 1, text: "fixed", fontPx: 14 },
                { x: 2, y: 1, text: "both", size: 2, fontPx: 14 },
            ]);
            render(ctx);

            expect(texts).toEqual([
                { text: "fixed", font: "14px sans-serif" },
                { text: "both", font: "14px sans-serif" },
            ]);
        }
    });

    it("culls with the fontPx world-space extent (fontPx / scale)", () => {
        const { draw, render } = setupAtScale(10);
        const { ctx, texts } = makeTextRecordingCtx();

        // Viewport spans 10 world units (+1 tile buffer). x=20 with size 1 is
        // out of reach, but a 140px label spans 14 world units and pokes in.
        draw.drawText([
            { x: 20, y: 1, text: "culled" },
            { x: 20, y: 1, text: "visible", fontPx: 140 },
        ]);
        render(ctx);

        expect(texts.map((t) => t.text)).toEqual(["visible"]);
    });
});

// Minimal fake 2D context that records globalAlpha at every drawImage() call.
function makeImageRecordingCtx() {
    const blits: Array<{ alpha: number }> = [];
    const ctx = {
        globalAlpha: 1,
        save() {},
        restore() {},
        translate() {},
        rotate() {},
        drawImage() {
            blits.push({ alpha: ctx.globalAlpha });
        },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, blits };
}

const fakeImage = { width: 10, height: 10 } as HTMLImageElement;

// Image opacity contract shared by all renderers: alpha = opacity ?? 1.
// The same fixture values are asserted in the webgl, skia, and server suites.
describe("CanvasDraw image opacity", () => {
    it("applies item opacity while drawing and restores globalAlpha", () => {
        const { draw, render } = setup();
        const { ctx, blits } = makeImageRecordingCtx();

        draw.drawImage([
            { x: 1, y: 1, img: fakeImage, opacity: 0.5 },
            { x: 3, y: 3, img: fakeImage },
            { x: 5, y: 5, img: fakeImage, sprite: { x: 0, y: 0, w: 5, h: 5 }, opacity: 0.25 },
        ]);
        render(ctx);

        expect(blits.map((b) => b.alpha)).toEqual([0.5, 1, 0.25]);
        expect(ctx.globalAlpha).toBe(1);
    });
});

function makePathRecordingCtx() {
    const ops: string[] = [];
    const fillRules: string[] = [];
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        strokeStyle: "#000",
        fillStyle: "#000",
        save() {},
        restore() {},
        beginPath() {
            ops.push("beginPath");
        },
        moveTo() {
            ops.push("moveTo");
        },
        lineTo() {
            ops.push("lineTo");
        },
        arc() {
            ops.push("arc");
        },
        closePath() {
            ops.push("closePath");
        },
        setLineDash() {},
        fill(rule?: string) {
            ops.push("fill");
            fillRules.push(rule ?? "nonzero");
        },
        stroke() {
            ops.push("stroke");
        },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, ops, fillRules };
}

describe("CanvasDraw path items", () => {
    const square = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
    ];

    it("fills a fill-only item without stroking and honors the fill rule", () => {
        const { draw, render } = setup();
        const { ctx, ops, fillRules } = makePathRecordingCtx();

        draw.drawPath([{ points: square, fillRule: "evenodd", style: { fillStyle: "#0f0" } }], 1);
        render(ctx);

        expect(ops).toContain("fill");
        expect(ops).not.toContain("stroke");
        expect(fillRules).toEqual(["evenodd"]);
    });

    it("closes the outline and both fills and strokes when styled for both", () => {
        const { draw, render } = setup();
        const { ctx, ops } = makePathRecordingCtx();

        draw.drawPath([{ points: square, closed: true, style: { fillStyle: "#0f0", strokeStyle: "#f00" } }], 1);
        render(ctx);

        expect(ops).toContain("closePath");
        expect(ops.indexOf("fill")).toBeGreaterThan(-1);
        expect(ops.indexOf("stroke")).toBeGreaterThan(ops.indexOf("fill"));
    });

    it("rounds corners through arcs when cornerRadius is set", () => {
        const { draw, render } = setup();
        const { ctx, ops } = makePathRecordingCtx();

        draw.drawPath([{ points: square, closed: true, style: { strokeStyle: "#f00", cornerRadius: 0.5 } }], 1);
        render(ctx);

        expect(ops.filter((op) => op === "arc")).toHaveLength(4);
    });

    it("strokes each item with its own style in item order", () => {
        const { draw, render } = setup();
        const { ctx, ops } = makePathRecordingCtx();

        draw.drawPath(
            [
                { points: square, style: { strokeStyle: "#f00" } },
                { points: square.map((p) => ({ x: p.x + 1, y: p.y })), style: { strokeStyle: "#00f" } },
            ],
            1,
        );
        render(ctx);

        expect(ops.filter((op) => op === "stroke")).toHaveLength(2);
        expect(ops.filter((op) => op === "beginPath")).toHaveLength(2);
    });
});

// Fake 2D context recording arcs and image transforms.
function makeMarkerRecordingCtx() {
    const arcs: Array<{ x: number; y: number; r: number }> = [];
    const scales: Array<{ x: number; y: number }> = [];
    const images: Array<{ dx: number; dy: number; dw: number; dh: number }> = [];
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        fillStyle: "#000",
        strokeStyle: "#000",
        save() {},
        restore() {},
        beginPath() {},
        translate() {},
        rotate() {},
        scale(x: number, y: number) {
            scales.push({ x, y });
        },
        arc(x: number, y: number, r: number) {
            arcs.push({ x, y, r });
        },
        moveTo() {},
        lineTo() {},
        fill() {},
        stroke() {},
        drawImage(_img: unknown, dx: number, dy: number, dw: number, dh: number) {
            images.push({ dx, dy, dw, dh });
        },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, arcs, scales, images };
}

describe("CanvasDraw sizePx and flip", () => {
    it("draws a sizePx circle at fixed pixel size regardless of scale", () => {
        const { draw, render } = setup(); // scale 10
        const { ctx, arcs } = makeMarkerRecordingCtx();

        draw.drawCircle(
            [
                { x: 2, y: 2, size: 2, sizePx: 24, style: { fillStyle: "#f00" } }, // sizePx wins
                { x: 4, y: 4, size: 2, style: { fillStyle: "#f00" } }, // world size
            ],
            1,
        );
        render(ctx);

        expect(arcs.map((a) => a.r)).toEqual([12, 10]);
    });

    it("keeps far-out sizePx markers visible (world extent grows as scale drops)", () => {
        const { draw, render } = setupAtScale(2); // 100px viewport = 50 world units wide
        const { ctx, arcs } = makeMarkerRecordingCtx();

        // Anchor at x=60 is ~10 world units past the right edge, but a 60px
        // marker spans 30 world units at scale 2 — its left half is visible.
        draw.drawCircle([{ x: 60, y: 10, sizePx: 60, style: { fillStyle: "#f00" } }], 1);
        render(ctx);

        expect(arcs).toHaveLength(1);
        expect(arcs[0].r).toBe(30);
    });

    it("draws a sizePx image in its pixel box", () => {
        const { draw, render } = setup(); // scale 10
        const { ctx, images } = makeMarkerRecordingCtx();
        const img = { width: 100, height: 100 } as unknown as HTMLImageElement;

        draw.drawImage([{ x: 2, y: 2, size: 3, sizePx: 20, img }], 1);
        render(ctx);

        expect(images).toHaveLength(1);
        expect(images[0].dw).toBe(20);
        expect(images[0].dh).toBe(20);
    });

    it("mirrors flipped images via a negative scale around the center", () => {
        const { draw, render } = setup();
        const { ctx, scales, images } = makeMarkerRecordingCtx();
        const img = { width: 100, height: 100 } as unknown as HTMLImageElement;

        draw.drawImage(
            [
                { x: 1, y: 1, size: 1, img, flipX: true },
                { x: 3, y: 1, size: 1, img, flipY: true },
                { x: 5, y: 1, size: 1, img }, // no flip: no scale call
            ],
            1,
        );
        render(ctx);

        expect(scales).toEqual([
            { x: -1, y: 1 },
            { x: 1, y: -1 },
        ]);
        // Flipped items draw centered at the origin of the transformed frame
        expect(images[0].dx).toBe(-5);
        expect(images[2].dx).not.toBe(-5);
    });
});

// Fake 2D context recording native path commands for command replay.
function makeCommandRecordingCtx() {
    const calls: Array<{ op: string; args: number[] }> = [];
    const rec =
        (op: string) =>
        (...args: unknown[]) =>
            calls.push({ op, args: args.filter((a) => typeof a === "number") as number[] });
    const ctx = {
        lineWidth: 1,
        globalAlpha: 1,
        fillStyle: "#000",
        strokeStyle: "#000",
        save() {},
        restore() {},
        beginPath() {},
        setLineDash() {},
        moveTo: rec("moveTo"),
        lineTo: rec("lineTo"),
        arc: rec("arc"),
        quadraticCurveTo: rec("quadraticCurveTo"),
        bezierCurveTo: rec("bezierCurveTo"),
        closePath: rec("closePath"),
        fill: rec("fill"),
        stroke: rec("stroke"),
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, calls };
}

describe("CanvasDraw command paths", () => {
    it("replays commands natively with world→screen and degree→radian conversion", () => {
        const { draw, render } = setup(); // scale 10, worldToScreen(k) centers cells
        const { ctx, calls } = makeCommandRecordingCtx();

        draw.drawPath(
            [
                {
                    commands: [
                        { type: "moveTo", x: 0, y: 0 },
                        { type: "quadraticCurveTo", cpx: 2, cpy: 2, x: 4, y: 0 },
                        { type: "arc", x: 0, y: 0, radius: 2, startAngle: 0, endAngle: 180 },
                        { type: "closePath" },
                    ],
                    style: { strokeStyle: "#f00" },
                },
            ],
            1,
        );
        render(ctx);

        const ops = calls.map((c) => c.op);
        expect(ops).toEqual(["moveTo", "quadraticCurveTo", "arc", "closePath", "stroke"]);
        // arc: radius scaled to px (2 * 10), angles in radians
        const arc = calls[2].args;
        expect(arc[2]).toBe(20);
        expect(arc[4]).toBeCloseTo(Math.PI);
    });

    it("fills multi-subpath commands under the item's fill rule (holes)", () => {
        const { draw, render } = setup();
        const { ctx, calls } = makeCommandRecordingCtx();

        draw.drawPath(
            [
                {
                    commands: [
                        { type: "moveTo", x: 0, y: 0 },
                        { type: "lineTo", x: 4, y: 0 },
                        { type: "lineTo", x: 4, y: 4 },
                        { type: "closePath" },
                        { type: "moveTo", x: 1, y: 1 },
                        { type: "lineTo", x: 2, y: 1 },
                        { type: "lineTo", x: 2, y: 2 },
                        { type: "closePath" },
                    ],
                    fillRule: "evenodd",
                    style: { fillStyle: "#0f0" },
                },
            ],
            1,
        );
        render(ctx);

        const ops = calls.map((c) => c.op);
        expect(ops.filter((op) => op === "moveTo")).toHaveLength(2);
        expect(ops).toContain("fill");
        expect(ops).not.toContain("stroke"); // fill-only
    });
});

describe("styleOf paint-time decoration", () => {
    // Records the ctx style active at every fill()/stroke() call, so tests can
    // assert which style each item was actually painted with.
    function makeStyleRecordingCtx() {
        const fills: string[] = [];
        const strokes: string[] = [];
        const ctx = {
            lineWidth: 1,
            globalAlpha: 1,
            fillStyle: "#000",
            strokeStyle: "#000",
            save() {},
            restore() {},
            beginPath() {},
            rect() {},
            arc() {},
            moveTo() {},
            lineTo() {},
            closePath() {},
            translate() {},
            rotate() {},
            setLineDash() {},
            fill() {
                fills.push(String(ctx.fillStyle));
            },
            stroke() {
                strokes.push(String(ctx.strokeStyle));
            },
        };
        return { ctx: ctx as unknown as CanvasRenderingContext2D, fills, strokes };
    }

    it("resolves styleOf against live external state on every frame", () => {
        const { draw, render } = setup();
        const { ctx, fills } = makeStyleRecordingCtx();

        const selected = new Set<number>();
        const items = [
            { x: 1, y: 1, size: 1, style: { fillStyle: "#00f" }, data: { id: 0 } },
            { x: 3, y: 3, size: 1, style: { fillStyle: "#00f" }, data: { id: 1 } },
        ];
        draw.drawRect(items, 1, {
            styleOf: (item) => (selected.has((item.data as { id: number }).id) ? { fillStyle: "#f00" } : undefined),
        });

        render(ctx);
        expect(fills).toEqual(["#00f", "#00f"]);

        // Selection changes without any re-registration: the same registration
        // must paint differently on the next frame.
        selected.add(1);
        fills.length = 0;
        render(ctx);
        expect(fills).toEqual(["#00f", "#f00"]);
    });

    it("overlays the decoration on the item's own style instead of replacing it", () => {
        const { draw, render } = setup();
        const { ctx, fills, strokes } = makeStyleRecordingCtx();

        draw.drawRect([{ x: 1, y: 1, size: 1, style: { fillStyle: "#00f", strokeStyle: "#0f0" } }], 1, {
            styleOf: () => ({ fillStyle: "#f00" }),
        });
        render(ctx);

        expect(fills).toEqual(["#f00"]);
        expect(strokes).toEqual(["#0f0"]); // untouched base field survives
    });

    it("decorates circles and text through the same path", () => {
        const { draw, render } = setup();
        const { ctx, fills } = makeStyleRecordingCtx();

        draw.drawCircle([{ x: 1, y: 1, size: 1, style: { fillStyle: "#00f" } }], 1, {
            styleOf: () => ({ fillStyle: "#f00" }),
        });
        render(ctx);
        expect(fills).toEqual(["#f00"]);
    });

    it("strokes decorated lines individually while the rest stay batched", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeStyleRecordingCtx();

        const items = [
            { from: { x: 0, y: 0 }, to: { x: 2, y: 2 }, data: { id: 0 } },
            { from: { x: 1, y: 0 }, to: { x: 3, y: 2 }, data: { id: 1 } },
        ];
        draw.drawLine(items, { strokeStyle: "#123" }, 1, {
            styleOf: (item) => ((item.data as { id: number }).id === 1 ? { strokeStyle: "#f00" } : undefined),
        });
        render(ctx);

        // First stroke is the batched run with the call-level style, then the
        // decorated item strokes on its own.
        expect(strokes).toEqual(["#123", "#f00"]);
    });

    it("preserves array paint order when a decorated line comes before a plain one", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeStyleRecordingCtx();

        const items = [
            { from: { x: 0, y: 0 }, to: { x: 2, y: 2 }, data: { id: 0 } },
            { from: { x: 1, y: 0 }, to: { x: 3, y: 2 }, data: { id: 1 } },
        ];
        draw.drawLine(items, { strokeStyle: "#123" }, 1, {
            styleOf: (item) => ((item.data as { id: number }).id === 0 ? { strokeStyle: "#f00" } : undefined),
        });
        render(ctx);

        // The decorated item is FIRST in the array, so it must paint first —
        // the plain line after it draws on top, matching hit-test priority.
        expect(strokes).toEqual(["#f00", "#123"]);
    });

    it("batches contiguous undecorated runs around decorated items without reordering", () => {
        const { draw, render } = setup();
        const { ctx, strokes } = makeStyleRecordingCtx();

        const items = [
            { from: { x: 0, y: 0 }, to: { x: 1, y: 1 }, data: { id: 0 } },
            { from: { x: 1, y: 0 }, to: { x: 2, y: 1 }, data: { id: 1 } },
            { from: { x: 2, y: 0 }, to: { x: 3, y: 1 }, data: { id: 2 } },
            { from: { x: 3, y: 0 }, to: { x: 4, y: 1 }, data: { id: 3 } },
        ];
        draw.drawLine(items, { strokeStyle: "#123" }, 1, {
            styleOf: (item) => ((item.data as { id: number }).id === 1 ? { strokeStyle: "#f00" } : undefined),
        });
        render(ctx);

        // 4 items, 3 strokes: run(#0) -> decorated(#1) -> run(#2, #3).
        expect(strokes).toEqual(["#123", "#f00", "#123"]);
    });

    it("decorates paths at paint time, including the fill toggle staying visual-only", () => {
        const { draw, render } = setup();
        const { ctx, fills, strokes } = makeStyleRecordingCtx();

        draw.drawPath(
            [
                {
                    points: [
                        { x: 0, y: 0 },
                        { x: 2, y: 0 },
                        { x: 2, y: 2 },
                    ],
                    closed: true,
                    style: { fillStyle: "#00f", strokeStyle: "#0f0" },
                },
            ],
            1,
            { styleOf: () => ({ fillStyle: "#f00" }) },
        );
        render(ctx);

        expect(fills).toEqual(["#f00"]);
        expect(strokes).toEqual(["#0f0"]);
    });
});
