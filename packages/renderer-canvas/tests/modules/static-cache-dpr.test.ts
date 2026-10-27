import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Config, CoordinateTransformer, ViewportState, type ICamera, type Rect } from "@canvas-tile-engine/core";
import { DrawContext, Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { createBrowserCanvasDraw, type BrowserContext2D } from "../../src/modules/createCanvasDraw";
import { RendererCanvas } from "../../src/RendererCanvas";

// Static caches must render at the device pixel ratio the visible canvas is
// backed at, or the blit upscales a CSS-resolution bitmap (issue #262). Node
// has no OffscreenCanvas, so a recording fake stands in for it.

type Call = { name: string; args: unknown[] };

/** A 2D context that records every method call and keeps assigned properties. */
function recordingContext() {
    const calls: Call[] = [];
    const props = new Map<PropertyKey, unknown>();
    const ctx = new Proxy({} as Record<PropertyKey, unknown>, {
        get(_target, key) {
            if (key === "calls") {
                return calls;
            }
            if (props.has(key)) {
                return props.get(key);
            }
            // Leave optional members (roundRect, measureText, canvas) absent.
            if (key === "roundRect" || key === "measureText" || key === "canvas" || key === "then") {
                return undefined;
            }
            return (...args: unknown[]) => {
                calls.push({ name: String(key), args });
            };
        },
        set(_target, key, value) {
            props.set(key, value);
            return true;
        },
    });
    return ctx as unknown as BrowserContext2D & { calls: Call[] };
}

class FakeOffscreenCanvas {
    static created: FakeOffscreenCanvas[] = [];
    readonly ctx = recordingContext();
    constructor(
        public width: number,
        public height: number,
    ) {
        FakeOffscreenCanvas.created.push(this);
    }
    getContext() {
        return this.ctx;
    }
}

// 10 world units at scale 10: 100 CSS px, edges on whole pixels, covering
// world [-4.5, 5.5] (cell-centered). The cache adds a one-raster-pixel
// antialiasing guard on each side: 0.5 CSS px at ratio 2.
const rect: Rect = { x: 0, y: 0, size: 10, style: { fillStyle: "#ff0000" } };

/** Blit rects are float math; compare them up to rounding noise. */
function expectNear(actual: unknown[], expected: number[]) {
    expect(actual).toHaveLength(expected.length);
    expected.forEach((value, i) => expect(actual[i]).toBeCloseTo(value, 9));
}

beforeEach(() => {
    FakeOffscreenCanvas.created = [];
    vi.stubGlobal("OffscreenCanvas", FakeOffscreenCanvas);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("browser static cache pixel ratio", () => {
    function setup(pixelRatio: () => number) {
        const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
        const transformer = new CoordinateTransformer(camera);
        const layers = new Layer<DrawContext<BrowserContext2D>>();
        const draw = createBrowserCanvasDraw(layers, transformer, camera, pixelRatio);
        // Defaults to a 100 CSS px viewport starting at the rect's left edge.
        const render = (topLeft = { x: -4.5, y: -4.5 }) => {
            const ctx = recordingContext();
            layers.drawAll({
                ctx,
                camera,
                transformer,
                config: { size: { width: 100, height: 100 }, scale: 10 } as never,
                topLeft,
            });
            return ctx.calls.filter((call) => call.name === "drawImage");
        };
        return { draw, render };
    }

    it("allocates the offscreen at dpr x size and paints it in CSS px", () => {
        const { draw } = setup(() => 2);
        draw.drawStaticRect([rect], "rect");

        expect(FakeOffscreenCanvas.created).toHaveLength(1);
        const [offscreen] = FakeOffscreenCanvas.created;
        expect([offscreen.width, offscreen.height]).toEqual([202, 202]);
        // The scale comes before any painting, so item geometry stays in CSS px.
        expect(offscreen.ctx.calls[0]).toEqual({ name: "scale", args: [2, 2] });
        expect(offscreen.ctx.calls.find((call) => call.name === "rect")?.args).toEqual([0.5, 0.5, 100, 100]);
    });

    it("keeps the 1x path unchanged", () => {
        const { draw } = setup(() => 1);
        draw.drawStaticRect([rect], "rect");

        const [offscreen] = FakeOffscreenCanvas.created;
        expect([offscreen.width, offscreen.height]).toEqual([102, 102]);
        expect(offscreen.ctx.calls.some((call) => call.name === "scale")).toBe(false);
    });

    it("blits physical source pixels into a CSS-px destination", () => {
        const { draw, render } = setup(() => 2);
        draw.drawStaticRect([rect], "rect");

        const [blit] = render();
        expect(blit.args[0]).toBe(FakeOffscreenCanvas.created[0]);
        // The viewport's 100 CSS px are 200 cache pixels, starting past the
        // guard; the destination is the whole 100 CSS px viewport.
        expectNear(blit.args.slice(1), [1, 1, 200, 200, 0, 0, 100, 100]);
    });

    it("clamps the source to the physical cache size and the destination to match", () => {
        const { draw, render } = setup(() => 2);
        draw.drawStaticRect([rect], "rect");

        // Viewport starts at world 0: 91 cache pixels in, so only the last 111
        // of the 202 remain, which are 55.5 CSS px on screen.
        const [blit] = render({ x: 0, y: 0 });
        expectNear(blit.args.slice(1), [91, 91, 111, 111, 0, 0, 55.5, 55.5]);
    });

    it("records the ratio at registration", () => {
        let dpr = 2;
        const { draw, render } = setup(() => dpr);
        draw.drawStaticRect([rect], "first");
        dpr = 1;

        // The existing cache keeps its 2x bitmap and mapping...
        expectNear(render()[0].args.slice(1, 5), [1, 1, 200, 200]);

        // ...and only a new registration picks up the new ratio.
        draw.drawStaticRect([rect], "second");
        expect(FakeOffscreenCanvas.created.map((canvas) => canvas.width)).toEqual([202, 102]);
    });
});

describe("RendererCanvas static caches", () => {
    it("render at the viewport's devicePixelRatio", () => {
        vi.stubGlobal("window", { devicePixelRatio: 2 });
        const canvas = { style: {}, width: 0, height: 0, getContext: () => recordingContext() };
        const wrapper = { style: {}, querySelector: () => canvas };
        const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
        const viewport = new ViewportState(100, 100);
        const renderer = new RendererCanvas();
        renderer.init({
            wrapper: wrapper as unknown as HTMLDivElement,
            camera,
            viewport,
            config: new Config({ scale: 10, size: { width: 100, height: 100 } }),
            transformer: new CoordinateTransformer(camera),
        });

        expect([canvas.width, canvas.height]).toEqual([200, 200]);
        renderer.getDrawAPI().drawStaticRect([rect], "rect");
        const [offscreen] = FakeOffscreenCanvas.created;
        expect([offscreen.width, offscreen.height]).toEqual([202, 202]);
        renderer.destroy();
    });
});
