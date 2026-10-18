import { afterEach, describe, expect, it } from "vitest";
import { CanvasTileEngine, type Rect } from "@canvas-tile-engine/core";
import type { Image } from "@napi-rs/canvas";
import { RendererServer, SERVER_MOUNT, type ServerMount } from "../../src";

type Engine = CanvasTileEngine<ServerMount, Image>;
const engines: Engine[] = [];

function setup() {
    const renderer = new RendererServer();
    const engine = new CanvasTileEngine(
        SERVER_MOUNT,
        { size: { width: 64, height: 64 }, scale: 20, backgroundColor: "#ffffff" },
        renderer,
        { x: 0.5, y: 0.5 },
    );
    engines.push(engine);
    return { engine, ctx: renderer.getContext() };
}

afterEach(() => {
    for (const engine of engines) {
        engine.destroy();
    }
    engines.length = 0;
});

describe.each(["rect", "circle"] as const)("%s paint order across the spatial-index threshold", (kind) => {
    function draw(engine: Engine, items: Rect[]) {
        return kind === "rect" ? engine.drawRect(items) : engine.drawCircle(items);
    }

    it.each([499, 500, 501])("paints the last of %i overlapping items on top and selects it", (count) => {
        const { engine, ctx } = setup();
        const items = Array.from({ length: count }, (_, i) => ({
            x: 0,
            y: 0,
            size: 2,
            style: { fillStyle: i === count - 1 ? "#00ff00" : "#ff0000" },
        }));
        const handle = draw(engine, items);
        engine.render();

        expect(Array.from(ctx.getImageData(32, 32, 1, 1).data)).toEqual([0, 255, 0, 255]);
        // Hit-test points use raw world coordinates; cell (0, 0) is centered at (0.5, 0.5).
        const hit = engine.hitTestFirst({ x: 0.5, y: 0.5 });
        expect(hit?.item).toBe(items[count - 1]);
        expect(hit?.index).toBe(count - 1);
        expect(hit?.handle).toBe(handle);
        expect(hit?.kind).toBe(kind);
    });

    it.each([499, 500, 501])("composites %i items in array order with translucent top items", (count) => {
        const { engine, ctx } = setup();
        const items = Array.from({ length: count }, (_, i) => ({
            x: 0,
            y: 0,
            size: 2,
            style: {
                fillStyle:
                    i === count - 1 ? "rgba(0, 0, 255, 0.5)" : i === count - 2 ? "rgba(0, 255, 0, 0.5)" : "#ff0000",
            },
        }));
        draw(engine, items);
        engine.render();

        // Separate draw calls always follow registration order and cannot use an item index.
        const reference = setup();
        for (const item of items) {
            draw(reference.engine, [item]);
        }
        reference.engine.render();
        expect(ctx.getImageData(0, 0, 64, 64).data).toEqual(reference.ctx.getImageData(0, 0, 64, 64).data);
        expect(engine.hitTestFirst({ x: 0.5, y: 0.5 })?.item).toBe(items[count - 1]);
    });

    it("preserves the paint order of a visible subset within an indexed draw call", () => {
        const { engine, ctx } = setup();
        const items = Array.from({ length: 1000 }, (_, i) => ({
            x: i % 10 === 0 ? 0 : 1000 + i,
            y: 0,
            size: 2,
            style: { fillStyle: i === 990 ? "#00ff00" : "#ff0000" },
        }));
        draw(engine, items);
        engine.render();

        expect(Array.from(ctx.getImageData(32, 32, 1, 1).data)).toEqual([0, 255, 0, 255]);
        const hit = engine.hitTestFirst({ x: 0.5, y: 0.5 });
        expect(hit?.item).toBe(items[990]);
        expect(hit?.index).toBe(990);
    });
});
