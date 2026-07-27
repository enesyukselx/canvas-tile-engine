import { describe, it } from "vitest";
import { join } from "node:path";
import { renderToBuffer, registerFont } from "../../src";
import { FIXTURES_DIR, expectMatchesBaseline, makeTestImage } from "./helpers";

// Pixel snapshot scenes, one per feature area. Baselines live in
// __baselines__/ and are committed; regenerate with UPDATE_SNAPSHOTS=1.
// Scenes render through renderToBuffer, so they exercise the real engine +
// shared canvas2d pipeline end to end.

const base = {
    scale: 24,
    size: { width: 360, height: 240 },
    backgroundColor: "#0f172a",
};

describe("pixel snapshots", () => {
    it("rects: plain, sized, rotated, rounded, dashed", async () => {
        const png = await renderToBuffer({
            config: base,
            draw: (engine) => {
                engine.drawGridLines(1, 1, "#1e293b", 0);
                engine.drawRect(
                    [
                        { x: -5, y: -3, size: 1, style: { fillStyle: "#22c55e" } },
                        { x: -3, y: -3, width: 3, height: 1.5, style: { fillStyle: "#3b82f6" } },
                        { x: 1, y: -3, size: 2, rotate: 30, style: { fillStyle: "#f97316" } },
                        { x: 4, y: -3, size: 2, radius: 0.4, style: { fillStyle: "#a855f7" } },
                        {
                            x: -4,
                            y: 0,
                            size: 2,
                            style: { strokeStyle: "#f43f5e", lineWidthPx: 3, lineDashPx: [6, 4] },
                        },
                        {
                            x: 0,
                            y: 0,
                            size: 2,
                            radius: 0.3,
                            style: {
                                fillStyle: "#0ea5e9",
                                strokeStyle: "#e2e8f0",
                                lineWidth: 0.08,
                                lineDash: [0.3, 0.2],
                            },
                        },
                        { x: 3, y: 1, size: 1, origin: { mode: "self", x: 0, y: 0 }, style: { fillStyle: "#fde047" } },
                    ],
                    1,
                );
            },
        });
        expectMatchesBaseline("rects", png);
    });

    it("circles: fill, stroke, sizePx, origin", async () => {
        const png = await renderToBuffer({
            config: base,
            draw: (engine) => {
                engine.drawGridLines(1, 1, "#1e293b", 0);
                engine.drawCircle(
                    [
                        { x: -4, y: -2, size: 2, style: { fillStyle: "#ef4444" } },
                        { x: -1, y: -2, size: 2, style: { strokeStyle: "#eab308", lineWidthPx: 3 } },
                        {
                            x: 2,
                            y: -2,
                            size: 2,
                            style: { fillStyle: "#14b8a6", strokeStyle: "#0f766e", lineWidth: 0.1 },
                        },
                        { x: -3, y: 1, sizePx: 20, style: { fillStyle: "#f8fafc" } },
                        {
                            x: 1,
                            y: 1,
                            size: 1.5,
                            origin: { mode: "self", x: 0.5, y: 0.5 },
                            style: { fillStyle: "#c084fc" },
                        },
                    ],
                    1,
                );
            },
        });
        expectMatchesBaseline("circles", png);
    });

    it("lines: batch style, per-item style, dashes", async () => {
        const png = await renderToBuffer({
            config: base,
            draw: (engine) => {
                engine.drawLine(
                    [
                        { from: { x: -6, y: -4 }, to: { x: 6, y: -4 } },
                        { from: { x: -6, y: -3 }, to: { x: 6, y: -2.5 } },
                        {
                            from: { x: -6, y: -1.5 },
                            to: { x: 6, y: -1.5 },
                            style: { strokeStyle: "#f97316", lineWidthPx: 4 },
                        },
                        {
                            from: { x: -6, y: 0 },
                            to: { x: 6, y: 0 },
                            style: { strokeStyle: "#22d3ee", lineDashPx: [8, 6] },
                        },
                        {
                            from: { x: -6, y: 1.5 },
                            to: { x: 6, y: 2.5 },
                            style: { strokeStyle: "#a3e635", lineWidth: 0.15 },
                        },
                    ],
                    { strokeStyle: "#e2e8f0", lineWidthPx: 2 },
                    1,
                );
            },
        });
        expectMatchesBaseline("lines", png);
    });

    it("paths: fills, holes, rounded corners, curves", async () => {
        const png = await renderToBuffer({
            config: base,
            draw: (engine) => {
                engine.drawPath(
                    [
                        {
                            points: [
                                { x: -6, y: -4 },
                                { x: -2, y: -4 },
                                { x: -2, y: -1 },
                                { x: -6, y: -1 },
                            ],
                            closed: true,
                            style: { fillStyle: "#22c55e", strokeStyle: "#166534", lineWidthPx: 2, cornerRadius: 0.5 },
                        },
                        {
                            // Outer square + inner square with evenodd → hole
                            points: [
                                { x: 0, y: -4 },
                                { x: 4, y: -4 },
                                { x: 4, y: 0 },
                                { x: 0, y: 0 },
                                { x: 1, y: -3 },
                                { x: 3, y: -3 },
                                { x: 3, y: -1 },
                                { x: 1, y: -1 },
                            ],
                            closed: true,
                            fillRule: "evenodd",
                            style: { fillStyle: "#f43f5e" },
                        },
                        {
                            points: [
                                { x: -6, y: 1 },
                                { x: -4, y: 3 },
                                { x: -2, y: 1.5 },
                                { x: 0, y: 3.5 },
                                { x: 2, y: 1 },
                            ],
                            style: { strokeStyle: "#38bdf8", lineWidthPx: 4 },
                        },
                        {
                            commands: [
                                { type: "moveTo", x: 3, y: 3 },
                                { type: "bezierCurveTo", cp1x: 4, cp1y: 1, cp2x: 5, cp2y: 5, x: 6, y: 3 },
                            ],
                            style: { strokeStyle: "#fbbf24", lineWidthPx: 3 },
                        },
                    ],
                    1,
                );
            },
        });
        expectMatchesBaseline("paths", png);
    });

    it("images: aspect fit, sprite crop, rotate, flip, opacity", async () => {
        const img = await makeTestImage();
        const png = await renderToBuffer({
            config: base,
            draw: (engine) => {
                engine.drawGridLines(1, 1, "#1e293b", 0);
                engine.drawImage(
                    [
                        { x: -5, y: -3, size: 2, img },
                        { x: -2, y: -3, size: 2, img, rotate: 45 },
                        { x: 1, y: -3, size: 2, img, flipX: true },
                        { x: 4, y: -3, size: 2, img, opacity: 0.5 },
                        { x: -4, y: 1, size: 2, img, sprite: { x: 0, y: 0, w: 16, h: 16 } },
                        { x: 0, y: 1, size: 2, img, sprite: { x: 16, y: 16, w: 16, h: 16 }, flipY: true },
                    ],
                    1,
                );
            },
        });
        expectMatchesBaseline("images", png);
    });

    it("text: world-sized, fixed-px, rotated, aligned (registered font)", async () => {
        registerFont(join(FIXTURES_DIR, "Roboto-Regular.ttf"), "SnapshotSans");
        const png = await renderToBuffer({
            config: base,
            draw: (engine) => {
                engine.drawGridLines(1, 1, "#1e293b", 0);
                engine.drawText(
                    [
                        {
                            x: 0,
                            y: -3,
                            text: "World 1.5",
                            size: 1.5,
                            style: { fillStyle: "#f8fafc", fontFamily: "SnapshotSans" },
                        },
                        {
                            x: 0,
                            y: -1,
                            text: "Fixed 16px",
                            fontPx: 16,
                            style: { fillStyle: "#38bdf8", fontFamily: "SnapshotSans" },
                        },
                        {
                            x: -3,
                            y: 1,
                            text: "Rotated",
                            size: 1,
                            rotate: -30,
                            style: { fillStyle: "#fbbf24", fontFamily: "SnapshotSans" },
                        },
                        {
                            x: 2,
                            y: 2,
                            text: "left/top",
                            size: 0.8,
                            style: {
                                fillStyle: "#4ade80",
                                fontFamily: "SnapshotSans",
                                textAlign: "left",
                                textBaseline: "top",
                            },
                        },
                    ],
                    2,
                );
            },
        });
        expectMatchesBaseline("text", png);
    });

    it("overlays: coordinate overlay enabled", async () => {
        const png = await renderToBuffer({
            config: {
                ...base,
                coordinates: { enabled: true, shownScaleRange: { min: 1, max: 100 } },
            },
            draw: (engine) => {
                engine.drawGridLines(1, 1, "#1e293b", 0);
                engine.drawRect({ x: 0, y: 0, size: 2, style: { fillStyle: "#22c55e" } }, 1);
            },
        });
        expectMatchesBaseline("coordinate-overlay", png);
    });
});
