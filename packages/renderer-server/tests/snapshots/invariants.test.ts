import { describe, it } from "vitest";
import type { CanvasTileEngine } from "@canvas-tile-engine/core";
import type { Image } from "@napi-rs/canvas";
import { renderToBuffer, type ServerMount } from "../../src";
import { expectNearIdenticalPixels, expectSamePixels, makeTestImage } from "./helpers";

type Engine = CanvasTileEngine<ServerMount, Image>;

// Baseline-free pixel invariants: properties that must hold regardless of
// what the output looks like, so they never need snapshot updates.

const config = {
    scale: 20,
    size: { width: 240, height: 160 },
    backgroundColor: "#0f172a",
};

const rects = [
    { x: -2, y: -1, size: 1, style: { fillStyle: "#22c55e" } },
    { x: 0, y: 0, width: 2, height: 1, style: { fillStyle: "#3b82f6", strokeStyle: "#1d4ed8", lineWidthPx: 2 } },
    { x: 2, y: 1, size: 1, rotate: 30, style: { fillStyle: "#f97316" } },
    { x: -1, y: 2, size: 1, radius: 0.25, style: { fillStyle: "#a855f7" } },
];

const circles = [
    { x: -2, y: 1, size: 1, style: { fillStyle: "#ef4444" } },
    { x: 1, y: -1, size: 1.5, style: { fillStyle: "#eab308", strokeStyle: "#854d0e", lineWidthPx: 2 } },
];

describe("pixel invariants", () => {
    it("renders deterministically (same scene twice, identical pixels)", async () => {
        const draw = (engine: Engine) => {
            engine.drawGridLines(1, 1, "#334155", 0);
            engine.drawRect(rects, 1);
            engine.drawCircle(circles, 1);
        };
        const first = await renderToBuffer({ config, draw });
        const second = await renderToBuffer({ config, draw });
        expectSamePixels(first, second, "invariant-deterministic");
    });

    // Static caches composite through a transparent intermediate canvas, so
    // anti-aliased edges round ±1 versus direct drawing — near-identical is
    // the correct invariant, exact equality is not (see helpers).
    it("drawStaticRect blits near-identically to drawRect at the cached scale", async () => {
        const dynamic = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawRect(rects, 1);
            },
        });
        const cached = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawStaticRect(rects, "invariant-rects", 1);
            },
        });
        expectNearIdenticalPixels(dynamic, cached, "invariant-static-rect");
    });

    it("drawStaticCircle blits near-identically to drawCircle at the cached scale", async () => {
        const dynamic = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawCircle(circles, 1);
            },
        });
        const cached = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawStaticCircle(circles, "invariant-circles", 1);
            },
        });
        expectNearIdenticalPixels(dynamic, cached, "invariant-static-circle");
    });

    it("drawStaticImage blits near-identically to drawImage at the cached scale", async () => {
        const img = await makeTestImage();
        const items = [
            { x: -2, y: -1, size: 2, img },
            { x: 1, y: 0, size: 1.5, img, rotate: 45 },
            { x: 2, y: 1, size: 1, img, flipX: true, opacity: 0.7 },
        ];
        const dynamic = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawImage(items, 1);
            },
        });
        const cached = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawStaticImage(items, "invariant-images", 1);
            },
        });
        expectNearIdenticalPixels(dynamic, cached, "invariant-static-image");
    });

    // Extent contract shared by every renderer: a negative or NaN extent
    // empties the item, so the frame matches one where it was never drawn.
    it("paints nothing for negative or NaN extents, dynamic or static", async () => {
        const img = await makeTestImage();
        const style = { fillStyle: "#22c55e", strokeStyle: "#f8fafc", lineWidthPx: 3 };
        const rects = [
            { x: -2, y: -1, size: -2, style },
            { x: 0, y: 0, width: -4, height: 2, style },
            { x: 2, y: 1, width: 3, height: NaN, style, rotate: 30 },
            { x: -1, y: 2, size: -1.5, radius: 0.25, style },
        ];
        const circles = [
            { x: -2, y: 1, size: -2, style },
            { x: 1, y: -1, size: NaN, style },
        ];
        const images = [
            { x: -2, y: -1, size: -2, img },
            { x: 2, y: 1, size: -1.5, img, flipX: true, rotate: 45 },
        ];
        const background = (engine: Engine) => {
            engine.drawGridLines(1, 1, "#334155", 0);
        };

        const empty = await renderToBuffer({ config, draw: background });
        const dynamic = await renderToBuffer({
            config,
            draw: (engine) => {
                background(engine);
                engine.drawRect([...rects, { x: 0, y: 0, sizePx: -40, style }], 1);
                engine.drawCircle([...circles, { x: 0, y: 0, sizePx: -40, style }], 1);
                engine.drawImage([...images, { x: 0, y: 0, sizePx: -40, img }], 1);
            },
        });
        const cached = await renderToBuffer({
            config,
            draw: (engine) => {
                background(engine);
                engine.drawStaticRect(rects, "negative-rects", 1);
                engine.drawStaticCircle(circles, "negative-circles", 1);
                engine.drawStaticImage(images, "negative-images", 1);
            },
        });

        expectSamePixels(dynamic, empty, "invariant-negative-dynamic");
        expectSamePixels(cached, empty, "invariant-negative-static");
    });

    // Position contract shared by every renderer: an item whose position,
    // line endpoint or path point is NaN or ±Infinity paints nothing, and does
    // not disturb the valid items drawn with it (one bad item used to make a
    // static cache non-finite). Before the fix @napi-rs/canvas aborted the
    // whole process here, on arc() with a non-finite center.
    it("paints nothing for non-finite positions, dynamic or static", async () => {
        const img = await makeTestImage();
        const style = { fillStyle: "#22c55e", strokeStyle: "#f8fafc", lineWidthPx: 3 };
        const at = [
            { x: NaN, y: 0 },
            { x: 0, y: Infinity },
            { x: -Infinity, y: 1 },
        ];
        const validRects = [{ x: -2, y: -1, size: 1, style }];
        const validCircles = [{ x: 2, y: 1, size: 1.5, style }];
        const validImages = [{ x: 0, y: -2, size: 1.5, img }];
        const rects = [...at.map((p) => ({ ...p, size: 1, style })), { x: NaN, y: NaN, size: 1, rotate: 30, style }];
        const circles = at.map((p) => ({ ...p, size: 1, style }));
        const images = [
            ...at.map((p) => ({ ...p, size: 1, img })),
            { x: Infinity, y: 0, img, flipX: true, rotate: 45 },
        ];
        const texts = at.map((p) => ({ ...p, text: "lost", size: 1, style: { fillStyle: "#f8fafc" } }));
        const lines = [
            { from: { x: 0, y: 0 }, to: { x: Infinity, y: 2 } },
            { from: { x: NaN, y: 0 }, to: { x: 3, y: 3 } },
        ];
        const paths = [
            {
                points: [
                    { x: -4, y: -3 },
                    { x: NaN, y: 0 },
                    { x: 4, y: 3 },
                    { x: -4, y: 3 },
                ],
                closed: true,
                style: { ...style, cornerRadius: 0.5 },
            },
            {
                points: [
                    { x: -3, y: -3 },
                    { x: 3, y: Infinity },
                    { x: 3, y: -3 },
                ],
                style,
            },
        ];
        const background = (engine: Engine) => {
            engine.drawGridLines(1, 1, "#334155", 0);
        };
        const render = (draw: (engine: Engine) => void) =>
            renderToBuffer({
                config,
                draw: (engine) => {
                    background(engine);
                    draw(engine);
                },
            });

        const validDynamic = await render((engine) => {
            engine.drawRect(validRects, 1);
            engine.drawCircle(validCircles, 1);
            engine.drawImage(validImages, 1);
        });
        const dynamic = await render((engine) => {
            engine.drawRect([...rects, ...validRects], 1);
            engine.drawCircle([...circles, ...validCircles], 1);
            engine.drawImage([...images, ...validImages], 1);
            engine.drawText(texts, 2);
            engine.drawLine(lines, { strokeStyle: "#f8fafc", lineWidthPx: 3 }, 2);
            engine.drawPath(paths, 2);
        });
        const validStatic = await render((engine) => {
            engine.drawStaticRect(validRects, "valid-rects", 1);
            engine.drawStaticCircle(validCircles, "valid-circles", 1);
            engine.drawStaticImage(validImages, "valid-images", 1);
        });
        const cached = await render((engine) => {
            engine.drawStaticRect([...rects, ...validRects], "rects", 1);
            engine.drawStaticCircle([...circles, ...validCircles], "circles", 1);
            engine.drawStaticImage([...images, ...validImages], "images", 1);
        });

        expectSamePixels(dynamic, validDynamic, "invariant-non-finite-dynamic");
        expectSamePixels(cached, validStatic, "invariant-non-finite-static");
    });
});
