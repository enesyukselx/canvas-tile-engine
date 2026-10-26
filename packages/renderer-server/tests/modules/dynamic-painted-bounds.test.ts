import { beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import {
    CoordinateTransformer,
    type CanvasTileEngineConfig,
    type Circle,
    type ICamera,
    type ImageItem,
    type Line,
    type PathItem,
    type Rect,
    type Text,
} from "@canvas-tile-engine/core";
import { createCanvas, GlobalFonts, type Canvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { CanvasDraw } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { Layer, type DrawContext } from "@canvas-tile-engine/renderer-shared/scene";
import { makeTestImage } from "../snapshots/helpers";

type Draw = CanvasDraw<SKRSContext2D, Image, Canvas>;
const FONT = "PaintedBoundsRoboto";
const RED = "#ef4444";

beforeAll(() => {
    GlobalFonts.registerFromPath(fileURLToPath(new URL("../fixtures/Roboto-Regular.ttf", import.meta.url)), FONT);
});

/** Keep the subject first and add genuinely offscreen items to cross the index threshold. */
function anchoredBatch<T extends { x: number; y: number }>(subject: T, count: number): T[] {
    return [subject, ...Array.from({ length: count - 1 }, (_, n) => ({ ...subject, x: 10000 + n, y: 10000 }))];
}

function lineBatch(subject: Line, count: number): Line[] {
    return [
        subject,
        ...Array.from({ length: count - 1 }, (_, n) => ({
            ...subject,
            from: { x: 10000 + n, y: 10000 },
            to: { x: 10000 + n, y: 10001 },
        })),
    ];
}

/**
 * Render into a real 100x100 napi canvas. The reference changes only the
 * culling viewport, leaving camera, pixel dimensions, transforms and paint
 * code identical. Its expanded bounds include every subject in this suite,
 * so it is an uncropped/unculled reference without duplicating draw logic.
 */
function setup(register: (draw: Draw) => void) {
    const cameraState = { x: 0, y: 0, scale: 10 };
    const camera = cameraState as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<DrawContext<SKRSContext2D>>();
    const draw = new CanvasDraw<SKRSContext2D, Image, Canvas>(layers, transformer, camera, null);
    register(draw);

    return (scale = 10) => {
        cameraState.scale = scale;
        const render = (reference: boolean) => {
            const canvas = createCanvas(100, 100);
            const ctx = canvas.getContext("2d");
            const config = {
                size: reference ? { width: 2000 * scale, height: 2000 * scale } : { width: 100, height: 100 },
                scale,
            } as Required<CanvasTileEngineConfig>;
            layers.drawAll({
                ctx,
                camera,
                transformer,
                config,
                topLeft: reference ? { x: -1000, y: -1000 } : { x: 0, y: 0 },
            });
            return ctx.getImageData(0, 0, 100, 100).data;
        };

        const actual = render(false);
        const expected = render(true);
        let actualPainted = 0;
        let expectedPainted = 0;
        let differingPixels = 0;
        for (let i = 0; i < actual.length; i += 4) {
            actualPainted += actual[i + 3] > 0 ? 1 : 0;
            expectedPainted += expected[i + 3] > 0 ? 1 : 0;
            if (
                actual[i] !== expected[i] ||
                actual[i + 1] !== expected[i + 1] ||
                actual[i + 2] !== expected[i + 2] ||
                actual[i + 3] !== expected[i + 3]
            ) {
                differingPixels++;
            }
        }
        expect(
            expectedPainted,
            "The reference must paint visible pixels; an empty fixture proves nothing",
        ).toBeGreaterThan(0);
        expect(
            differingPixels,
            `Painted pixels: culled=${actualPainted}, unculled=${expectedPainted}, scale=${scale}`,
        ).toBe(0);
    };
}

describe.each([500, 501])("dynamic painted bounds with %i items", (count) => {
    it("keeps a self-origin rect whose anchor and center-based bounds are offscreen", () => {
        const subject: Rect = {
            x: -8.8,
            y: 4.5,
            size: 10,
            origin: { mode: "self", x: 0, y: 0.5 },
            style: { fillStyle: RED },
        };
        setup((draw) => draw.drawRect(anchoredBatch(subject, count)))();
    });

    it("keeps the visible corner of a rotated rect", () => {
        const subject: Rect = { x: -12, y: 4.5, size: 20, rotate: 45, style: { fillStyle: RED } };
        setup((draw) => draw.drawRect(anchoredBatch(subject, count)))();
    });

    it("includes a thick rect border in its painted bounds", () => {
        const subject: Rect = { x: -3, y: 4.5, size: 1, style: { strokeStyle: RED, lineWidthPx: 70 } };
        setup((draw) => draw.drawRect(anchoredBatch(subject, count)))();
    });

    it("resolves a live styleOf stroke before culling, including changed callback output", () => {
        const subject: Rect = { x: -3, y: 4.5, size: 1 };
        let widthPx = 70;
        const check = setup((draw) =>
            draw.drawRect(anchoredBatch(subject, count), 1, {
                styleOf: () => ({ strokeStyle: RED, lineWidthPx: widthPx }),
            }),
        );
        check();
        widthPx = 90;
        check();
    });

    it("keeps a thick line even when the complete centerline is outside the viewport", () => {
        const subject: Line = { from: { x: -5, y: 2 }, to: { x: -5, y: 7 } };
        setup((draw) => draw.drawLine(lineBatch(subject, count), { strokeStyle: RED, lineWidthPx: 100 }))();
    });

    it("uses the per-item stroke width when culling a line", () => {
        const subject: Line = {
            from: { x: -5, y: 2 },
            to: { x: -5, y: 7 },
            style: { lineWidth: 10 },
        };
        setup((draw) => draw.drawLine(lineBatch(subject, count), { strokeStyle: RED, lineWidthPx: 1 }))();
    });

    it.each(["points", "commands"] as const)(
        "keeps thick %s paths whose centerlines are outside the viewport",
        (kind) => {
            const makePath = (x: number, y: number): PathItem => ({
                ...(kind === "points"
                    ? {
                          points: [
                              { x, y },
                              { x, y: y + 5 },
                          ],
                      }
                    : {
                          commands: [
                              { type: "moveTo" as const, x, y },
                              { type: "lineTo" as const, x, y: y + 5 },
                          ],
                      }),
                style: { strokeStyle: RED, lineWidthPx: 100 },
            });
            const items = [makePath(-5, 2), ...Array.from({ length: count - 1 }, (_, n) => makePath(10000 + n, 10000))];
            setup((draw) => draw.drawPath(items))();
        },
    );

    it("keeps a long right-aligned label with an offscreen anchor", () => {
        const subject: Text = {
            x: 20,
            y: 4.5,
            text: "A long offscreen anchored label that still crosses the viewport",
            fontPx: 20,
            style: { fillStyle: RED, fontFamily: FONT, textAlign: "right" },
        };
        setup((draw) => draw.drawText(anchoredBatch(subject, count)))();
    });

    it("keeps a fontPx 140 right-aligned label on either side of the indexing threshold", () => {
        const subject: Text = {
            x: 20,
            y: 4.5,
            text: "HELLO",
            fontPx: 140,
            style: { fillStyle: RED, fontFamily: FONT, textAlign: "right" },
        };
        setup((draw) => draw.drawText(anchoredBatch(subject, count)))();
    });

    it("includes rotation when culling a long label", () => {
        const subject: Text = {
            x: 4.5,
            y: 20,
            text: "A long offscreen anchored label that still crosses the viewport",
            fontPx: 20,
            rotate: 90,
            style: { fillStyle: RED, fontFamily: FONT, textAlign: "right" },
        };
        setup((draw) => draw.drawText(anchoredBatch(subject, count)))();
    });

    it("keeps a self-origin circle", () => {
        const subject: Circle = {
            x: -8.8,
            y: 4.5,
            size: 10,
            origin: { mode: "self", x: 0, y: 0.5 },
            style: { fillStyle: RED },
        };
        setup((draw) => draw.drawCircle(anchoredBatch(subject, count)))();
    });

    it("includes a thick circle border in its painted bounds", () => {
        const subject: Circle = { x: -3, y: 4.5, size: 1, style: { strokeStyle: RED, lineWidthPx: 70 } };
        setup((draw) => draw.drawCircle(anchoredBatch(subject, count)))();
    });

    it("keeps a self-origin image", async () => {
        const subject: ImageItem<Image> = {
            x: -8.8,
            y: 4.5,
            size: 10,
            origin: { mode: "self", x: 0, y: 0.5 },
            img: await makeTestImage(),
        };
        setup((draw) => draw.drawImage(anchoredBatch(subject, count)))();
    });

    it("keeps the visible corner of a rotated image", async () => {
        const subject: ImageItem<Image> = { x: -12, y: 4.5, size: 20, rotate: 45, img: await makeTestImage() };
        setup((draw) => draw.drawImage(anchoredBatch(subject, count)))();
    });

    it("remeasures decorated text and uses the live camera scale after registration", () => {
        const subject: Text = {
            x: 25,
            y: 4.5,
            text: "HELLO",
            fontPx: 140,
            style: { fillStyle: RED, fontFamily: FONT, textAlign: "left" },
        };
        let alignment: "right" | "center" = "right";
        const check = setup((draw) =>
            draw.drawText(anchoredBatch(subject, count), 2, {
                styleOf: () => ({ textAlign: alignment, fontWeight: "bold" }),
            }),
        );
        check(10);
        check(5);
        alignment = "center";
        check(5);
    });
});
