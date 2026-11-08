import { describe, expect, it } from "vitest";
import { CoordinateTransformer, ICamera, ItemCollection, type PathItem } from "@canvas-tile-engine/core";
import { DrawContext, Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { createBrowserCanvasDraw, type BrowserContext2D } from "../../src/modules/createCanvasDraw";

/**
 * Fake 2D context with a browser's `arc()`: a call with a non-finite value is
 * ignored, and a negative radius throws `IndexSizeError` (Chrome 152: "The
 * radius provided (-40) is negative."). Tracks the save depth, every arc and
 * every fill of a non-empty path (filling an empty path paints nothing).
 * Members the test does not care about are no-ops.
 */
function makeBrowserCtx() {
    const arcs: number[][] = [];
    const fills: string[] = [];
    let depth = 0;
    let segments = 0;
    const segment = () => void segments++;
    const target: Record<string, unknown> = {
        fillStyle: "#000",
        strokeStyle: "#000",
        lineWidth: 1,
        globalAlpha: 1,
        save() {
            depth++;
        },
        restore() {
            depth--;
        },
        beginPath() {
            segments = 0;
        },
        moveTo: segment,
        lineTo: segment,
        quadraticCurveTo: segment,
        bezierCurveTo: segment,
        arc(...args: number[]) {
            if (!args.slice(0, 5).every(Number.isFinite)) {
                return;
            }
            if (args[2] < 0) {
                throw new DOMException(`The radius provided (${args[2]}) is negative.`, "IndexSizeError");
            }
            arcs.push(args);
            segments++;
        },
        rect: segment,
        fill() {
            if (segments > 0) {
                fills.push(String(target.fillStyle));
            }
        },
    };
    const ctx = new Proxy(target, {
        get(t, prop: string) {
            return prop in t ? t[prop] : () => {};
        },
    }) as unknown as CanvasRenderingContext2D;
    return { ctx, arcs, fills, depth: () => depth };
}

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<DrawContext<BrowserContext2D>>();
    const draw = createBrowserCanvasDraw(layers, transformer, camera, () => 1);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const render = (ctx: CanvasRenderingContext2D) =>
        layers.drawAll({ ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

/** A quarter pie slice centered at (cx, 2). */
function slice(id: string, cx: number, radius: number): PathItem & { id: string } {
    return {
        id,
        commands: [
            { type: "moveTo", x: cx, y: 2 },
            { type: "arc", x: cx, y: 2, radius, startAngle: 0, endAngle: 90 },
            { type: "closePath" },
        ],
        style: { fillStyle: `slice-${id}` },
    };
}

const laterLayer = { x: 7, y: 7, size: 1, style: { fillStyle: "later-layer" } };

describe("CanvasDraw command paths with a negative arc radius", () => {
    // Before, arc() threw out of the layer callback on every frame: the rest
    // of that frame (later layers, onDraw, overlays) never painted, and the
    // two save() calls around the path leaked, carrying any clip forward.
    it("paints nothing for the path, never calls arc() with it, and finishes the frame", () => {
        const { draw, render } = setup();
        const browser = makeBrowserCtx();
        draw.drawPath([slice("bad", 2, -1), slice("good", 5, 1)], 1);
        draw.drawRect([laterLayer], 2);

        for (let frame = 0; frame < 2; frame++) {
            expect(() => render(browser.ctx)).not.toThrow();
        }

        expect(browser.arcs).toHaveLength(2); // the valid slice, once per frame
        expect(browser.arcs.every(([, , radius]) => radius > 0)).toBe(true);
        expect(browser.fills).toEqual(["slice-good", "later-layer", "slice-good", "later-layer"]);
        expect(browser.depth()).toBe(0);
    });

    it("catches a radius edited negative in place after registration", () => {
        const { draw, render } = setup();
        const browser = makeBrowserCtx();
        const item = slice("edited", 2, 1);
        draw.drawPath([item], 1);
        draw.drawRect([laterLayer], 2);
        render(browser.ctx);

        const arc = item.commands![1] as { radius: number };
        arc.radius = -1;

        expect(() => render(browser.ctx)).not.toThrow();
        expect(browser.arcs).toHaveLength(1); // only the frame before the edit
        expect(browser.fills).toEqual(["slice-edited", "later-layer", "later-layer"]);
        expect(browser.depth()).toBe(0);
    });

    it("skips one inserted later through a live ItemCollection", () => {
        const { draw, render } = setup();
        const browser = makeBrowserCtx();
        const items = [slice("good", 5, 1)];
        const source = new ItemCollection(items, { keyOf: (item) => item.id });
        const handle = draw.drawPath(source.items as typeof items);
        source.subscribe((changes) => draw.applyDrawChanges(handle, changes));
        draw.drawRect([laterLayer], 2);

        source.insert(slice("bad", 2, -1));
        expect(() => render(browser.ctx)).not.toThrow();
        source.update("good", slice("good", 5, -2));
        expect(() => render(browser.ctx)).not.toThrow();

        expect(browser.arcs).toHaveLength(1);
        expect(browser.fills).toEqual(["slice-good", "later-layer", "later-layer"]);
        expect(browser.depth()).toBe(0);
    });
});
