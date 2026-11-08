import { afterEach, describe, expect, it } from "vitest";
import { CanvasTileEngine, type LinearGradient } from "@canvas-tile-engine/core";
import type { Image } from "@napi-rs/canvas";
import { RendererServer, SERVER_MOUNT, type ServerMount } from "../../src";

// Gradient edge cases on the real @napi-rs/canvas, which differs from a
// browser's Canvas2D on exactly these inputs; the shared pipeline has to paint
// what the browser does.

type Engine = CanvasTileEngine<ServerMount, Image>;
const engines: Engine[] = [];

const WHITE = [255, 255, 255, 255];

function setup() {
    const renderer = new RendererServer();
    // 64px at scale 20, centered on cell (0,0): a size-2 item spans px 12..52.
    const engine = new CanvasTileEngine(
        SERVER_MOUNT,
        { size: { width: 64, height: 64 }, scale: 20, backgroundColor: "#ffffff" },
        renderer,
        { x: 0, y: 0 },
    );
    engines.push(engine);
    const ctx = renderer.getContext();
    const pixel = (x: number, y: number) => Array.from(ctx.getImageData(x, y, 1, 1).data);
    return { engine, pixel };
}

afterEach(() => {
    for (const engine of engines) {
        engine.destroy();
    }
    engines.length = 0;
});

const gradient = (stops: LinearGradient["stops"]): LinearGradient => ({
    type: "linear",
    from: { x: 0, y: 0 },
    to: { x: 1, y: 0 },
    stops,
});

describe("gradient fills with no stops", () => {
    const empty = gradient([]);

    it("paints nothing for a rect or a circle, but keeps the stroke", () => {
        const { engine, pixel } = setup();

        engine.drawRect({ x: 0, y: 0, size: 2, style: { fillStyle: empty, strokeStyle: "#000000", lineWidthPx: 4 } });
        engine.drawCircle({ x: 0, y: 0, size: 1, style: { fillStyle: empty } }, 2);
        expect(() => engine.render()).not.toThrow();

        expect(pixel(32, 32)).toEqual(WHITE);
        expect(pixel(20, 32)).toEqual(WHITE);
        // The stroke runs along the rect's edge at x = 12
        expect(pixel(12, 32)).toEqual([0, 0, 0, 255]);
    });

    it("paints nothing for a fill-only path, outline included", () => {
        const { engine, pixel } = setup();

        engine.drawPath({
            points: [
                { x: -1, y: -1 },
                { x: 1, y: -1 },
                { x: 1, y: 1 },
                { x: -1, y: 1 },
            ],
            closed: true,
            style: { fillStyle: empty },
        });
        expect(() => engine.render()).not.toThrow();

        // Interior, and the left edge at x = 12 where a hairline outline would be
        expect(pixel(32, 32)).toEqual(WHITE);
        expect(pixel(11, 32)).toEqual(WHITE);
        expect(pixel(12, 32)).toEqual(WHITE);
    });

    it("paints nothing from a static cache", () => {
        const { engine, pixel } = setup();

        expect(() =>
            engine.drawStaticRect([{ x: 0, y: 0, size: 2, style: { fillStyle: empty } }], "empty"),
        ).not.toThrow();
        expect(() => engine.render()).not.toThrow();

        expect(pixel(32, 32)).toEqual(WHITE);
    });

    it("still paints a single stop flat", () => {
        const { engine, pixel } = setup();

        engine.drawRect({ x: 0, y: 0, size: 2, style: { fillStyle: gradient([{ offset: 0.7, color: "#00ff00" }]) } });
        engine.render();

        expect(pixel(14, 32)).toEqual([0, 255, 0, 255]);
        expect(pixel(50, 32)).toEqual([0, 255, 0, 255]);
    });
});

// The Canvas2D spec paints nothing for a zero-length axis, and a browser does
// exactly that. @napi-rs/canvas falls back on Skia's degenerate gradient and
// paints the last stop flat instead.
describe("gradient fills with a zero-length axis", () => {
    const point = { x: 0.5, y: 0.5 };
    const twoStops = [
        { offset: 0, color: "#ff0000" },
        { offset: 1, color: "#0000ff" },
    ];

    it.each([
        ["box units, two stops", { ...gradient(twoStops), from: point, to: point }],
        ["box units, one stop", { ...gradient([{ offset: 0.5, color: "#0000ff" }]), from: point, to: point }],
        ["world units", { ...gradient(twoStops), units: "world" as const, from: point, to: point }],
    ])("paints nothing (%s)", (_name, fillStyle) => {
        const { engine, pixel } = setup();

        engine.drawRect({ x: 0, y: 0, size: 2, style: { fillStyle } });
        engine.drawCircle({ x: 0, y: 0, size: 1, style: { fillStyle } }, 2);
        engine.render();

        expect(pixel(32, 32)).toEqual(WHITE);
        expect(pixel(14, 32)).toEqual(WHITE);
    });

    it("paints nothing from a static cache", () => {
        const { engine, pixel } = setup();

        engine.drawStaticRect(
            [{ x: 0, y: 0, size: 2, style: { fillStyle: { ...gradient(twoStops), from: point, to: point } } }],
            "zero-axis",
        );
        engine.render();

        expect(pixel(32, 32)).toEqual(WHITE);
    });
});

// Parity pin for a short but non-zero axis, matching Chrome's Canvas2D (and
// WebGL, which follows it): a hard step at the axis position, until the axis
// drops to Skia's degenerate threshold (1/32768 px), where the last stop
// paints flat.
describe("gradient fills with a very short axis", () => {
    const redToBlue = (to: number): LinearGradient => ({
        ...gradient([
            { offset: 0, color: "#ff0000" },
            { offset: 1, color: "#0000ff" },
        ]),
        units: "world",
        from: { x: 0, y: 0 },
        to: { x: to, y: 0 },
    });

    it("steps from the first stop to the last at the axis", () => {
        const { engine, pixel } = setup();

        // World x = 0 is px 32, the middle of the rect; 1e-4 world units is 0.002px
        engine.drawRect({ x: 0, y: 0, size: 2, style: { fillStyle: redToBlue(1e-4) } });
        engine.render();

        expect(pixel(13, 32)).toEqual([255, 0, 0, 255]);
        expect(pixel(31, 32)).toEqual([255, 0, 0, 255]);
        expect(pixel(32, 32)).toEqual([0, 0, 255, 255]);
        expect(pixel(51, 32)).toEqual([0, 0, 255, 255]);
    });

    it("paints the last stop flat once the axis is degenerate", () => {
        const { engine, pixel } = setup();

        // 1e-7 world units is 2e-6px, under 1/32768 px
        engine.drawRect({ x: 0, y: 0, size: 2, style: { fillStyle: redToBlue(1e-7) } });
        engine.render();

        expect(pixel(13, 32)).toEqual([0, 0, 255, 255]);
        expect(pixel(51, 32)).toEqual([0, 0, 255, 255]);
    });
});
