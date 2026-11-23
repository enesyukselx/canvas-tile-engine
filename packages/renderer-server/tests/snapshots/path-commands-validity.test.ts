import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import type { CanvasTileEngine, PathCommand, PathItem } from "@canvas-tile-engine/core";
import type { Image } from "@napi-rs/canvas";
import { renderToBuffer, type ServerMount } from "../../src";
import { expectSamePixels } from "./helpers";

type Engine = CanvasTileEngine<ServerMount, Image>;

// Real @napi-rs/canvas. Left unguarded it aborted the whole Node process
// (a Rust panic, SIGABRT) on an arc() with a non-finite center, and dropped
// only the arc for a negative radius while browsers threw IndexSizeError.
// The contract every renderer now shares: such a path paints nothing.

const config = { scale: 20, size: { width: 200, height: 200 }, backgroundColor: "#0f172a" };
const style = { fillStyle: "#22c55e", strokeStyle: "#f8fafc", lineWidthPx: 3 };

/** A closed outline whose last edge is an arc, so a dropped arc still leaves visible strokes. */
function outlineWith(arc: Partial<Extract<PathCommand, { type: "arc" }>>): PathItem {
    return {
        commands: [
            { type: "moveTo", x: -3, y: -3 },
            { type: "lineTo", x: 3, y: -3 },
            { type: "arc", x: 0, y: 2, radius: 1.5, startAngle: 0, endAngle: 180, ...arc },
            { type: "closePath" },
        ],
        style,
    };
}

const background = (engine: Engine) => {
    engine.drawGridLines(1, 1, "#334155", 0);
    engine.drawRect({ x: 3, y: 3, size: 1, style: { fillStyle: "#3b82f6" } }, 2);
};

describe("command paths that cannot be drawn", () => {
    it("paints nothing for a negative arc radius or a non-finite command value", async () => {
        const invalid: PathItem[] = [
            outlineWith({ radius: -1.5 }),
            outlineWith({ radius: NaN }),
            outlineWith({ x: NaN }), // aborted the process before
            outlineWith({ y: Infinity }), // aborted the process before
            outlineWith({ endAngle: -Infinity }),
            {
                commands: [
                    { type: "moveTo", x: -3, y: -3 },
                    { type: "lineTo", x: NaN, y: -3 },
                    { type: "lineTo", x: 3, y: 3 },
                    { type: "quadraticCurveTo", cpx: 0, cpy: Infinity, x: -3, y: 3 },
                    { type: "closePath" },
                ],
                style,
            },
        ];

        const empty = await renderToBuffer({ config, draw: background });
        const drawn = await renderToBuffer({
            config,
            draw: (engine) => {
                background(engine);
                engine.drawPath(invalid, 1);
            },
        });

        expectSamePixels(drawn, empty, "path-commands-invalid");
    });

    it("still paints a valid arc path, so the comparison above is not vacuous", async () => {
        const empty = await renderToBuffer({ config, draw: background });
        const drawn = await renderToBuffer({
            config,
            draw: (engine) => {
                background(engine);
                engine.drawPath(outlineWith({}), 1);
            },
        });

        expect(PNG.sync.read(drawn).data.equals(PNG.sync.read(empty).data)).toBe(false);
    });

    // A NaN vertex used to give cornerArc a NaN center, which also reached
    // arc() and aborted the process. The corners next to it now join straight.
    it("renders a rounded polyline with a NaN vertex without aborting", async () => {
        const png = await renderToBuffer({
            config,
            draw: (engine) => {
                background(engine);
                engine.drawPath(
                    {
                        points: [
                            { x: -3, y: -3 },
                            { x: NaN, y: -3 },
                            { x: 3, y: 3 },
                            { x: -3, y: 3 },
                        ],
                        closed: true,
                        style: { ...style, cornerRadius: 0.5 },
                    },
                    1,
                );
            },
        });

        expect(PNG.sync.read(png).width).toBe(200);
    });
});
