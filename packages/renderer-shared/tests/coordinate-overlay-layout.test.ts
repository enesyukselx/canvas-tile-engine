import { describe, expect, it } from "vitest";
import { COORDINATE_OVERLAY } from "@canvas-tile-engine/core";
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import {
    coordinateOverlayBorders,
    coordinateOverlayFontSize,
    forEachCoordinateLabel,
    shouldDrawCoordinateOverlay,
} from "../src/scene/coordinateOverlayLayout";

const size = { width: 200, height: 200 };

/** Distance from each gutter's outer edge to the center of its labels. */
const LABEL_INSET = COORDINATE_OVERLAY.BORDER_WIDTH / 2;

interface Label {
    text: string;
    x: number;
    y: number;
}

type Camera = { x: number; y: number; scale: number };

function labels(camera: Camera, viewport = size): Label[] {
    const collected: Label[] = [];
    forEachCoordinateLabel(camera, viewport, (text, x, y) => collected.push({ text, x, y }));
    return collected;
}

/**
 * Split the visits into the left gutter's rows and the bottom gutter's columns.
 * Rows come first, all at the gutter inset and moving down; the last row lies
 * below the bottom gutter's labels, so the first column always breaks the run.
 */
function axes(camera: Camera, viewport = size): { rows: Label[]; columns: Label[] } {
    const all = labels(camera, viewport);
    const split = all.findIndex((label, i) => i > 0 && (label.x !== LABEL_INSET || label.y <= all[i - 1].y));
    return { rows: all.slice(0, split), columns: all.slice(split) };
}

/** World units between neighboring labels on one axis. */
function stepOf(axis: Label[]): number {
    return Number(axis[1].text) - Number(axis[0].text);
}

/** The layout before labels were thinned: one label per cell at every zoom. */
function oneLabelPerCell(camera: Camera, viewport: { width: number; height: number }): Label[] {
    const collected: Label[] = [];
    const cordGap = camera.scale;
    for (let i = 0 - (camera.y % 1); i <= viewport.height / cordGap + 1; i++) {
        collected.push({ text: Math.round(camera.y + i).toString(), x: LABEL_INSET, y: cordGap * i + cordGap / 2 });
    }
    for (let i = 0 - (camera.x % 1); i <= viewport.width / cordGap + 1; i++) {
        collected.push({
            text: Math.round(camera.x + i).toString(),
            x: cordGap * i + cordGap / 2,
            y: viewport.height - LABEL_INSET,
        });
    }
    return collected;
}

const ONE_TWO_FIVE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];

// shouldDrawCoordinateOverlay only reads config.coordinates.
function configWith(coordinates: CanvasTileEngineConfig["coordinates"]): Readonly<Required<CanvasTileEngineConfig>> {
    return { coordinates } as unknown as Required<CanvasTileEngineConfig>;
}

describe("shouldDrawCoordinateOverlay", () => {
    it("is off unless enabled", () => {
        const config = configWith({ enabled: false, shownScaleRange: { min: 0, max: 100 } });

        expect(shouldDrawCoordinateOverlay(config, 10)).toBe(false);
    });

    it("honors the configured scale range, inclusive at both ends", () => {
        const config = configWith({ enabled: true, shownScaleRange: { min: 10, max: 40 } });

        expect(shouldDrawCoordinateOverlay(config, 9.99)).toBe(false);
        expect(shouldDrawCoordinateOverlay(config, 10)).toBe(true);
        expect(shouldDrawCoordinateOverlay(config, 40)).toBe(true);
        expect(shouldDrawCoordinateOverlay(config, 40.01)).toBe(false);
    });

    it("is off when no range is configured", () => {
        expect(shouldDrawCoordinateOverlay(configWith({ enabled: true }), 10)).toBe(false);
    });
});

describe("coordinateOverlayFontSize", () => {
    it("scales with the camera between the configured bounds", () => {
        expect(coordinateOverlayFontSize(40)).toBe(10); // 40 * 0.25
    });

    it("clamps to the min and max", () => {
        expect(coordinateOverlayFontSize(1)).toBe(COORDINATE_OVERLAY.MIN_FONT_SIZE);
        expect(coordinateOverlayFontSize(1000)).toBe(COORDINATE_OVERLAY.MAX_FONT_SIZE);
    });
});

describe("coordinateOverlayBorders", () => {
    it("puts a full-height gutter on the left and a full-width one at the bottom", () => {
        const { left, bottom } = coordinateOverlayBorders({ width: 300, height: 200 });

        expect(left).toEqual({ x: 0, y: 0, width: COORDINATE_OVERLAY.BORDER_WIDTH, height: 200 });
        expect(bottom).toEqual({
            x: COORDINATE_OVERLAY.BORDER_WIDTH,
            y: 200 - COORDINATE_OVERLAY.BORDER_WIDTH,
            width: 300,
            height: COORDINATE_OVERLAY.BORDER_WIDTH,
        });
    });
});

describe("forEachCoordinateLabel", () => {
    it("labels the visible rows down the left gutter and the columns along the bottom", () => {
        // 200x200 at scale 20 shows 10 cells per axis; the loop runs one past.
        const all = labels({ x: 0, y: 0, scale: 20 });
        const rows = all.slice(0, all.length / 2);
        const columns = all.slice(all.length / 2);

        expect(rows).toHaveLength(12);
        expect(columns).toHaveLength(12);

        expect(rows[0]).toEqual({ text: "0", x: 10, y: 10 });
        expect(rows[1]).toEqual({ text: "1", x: 10, y: 30 });
        expect(columns[0]).toEqual({ text: "0", x: 10, y: 190 });
        expect(columns[1]).toEqual({ text: "1", x: 30, y: 190 });
    });

    it("follows the camera", () => {
        const rows = labels({ x: 0, y: 7, scale: 20 }).slice(0, 12);

        expect(rows.map((label) => label.text)).toEqual([
            "7",
            "8",
            "9",
            "10",
            "11",
            "12",
            "13",
            "14",
            "15",
            "16",
            "17",
            "18",
        ]);
    });

    it("offsets the first label by the camera's fractional part so labels stay on their cells", () => {
        const rows = labels({ x: 0, y: 2.25, scale: 20 }).slice(0, 2);

        // Starting index -0.25 pulls the first row up a quarter cell.
        expect(rows[0]).toEqual({ text: "2", x: 10, y: 5 });
        expect(rows[1]).toEqual({ text: "3", x: 10, y: 25 });
    });

    it("emits more labels as the camera zooms out while every cell has room for one", () => {
        const viewport = { width: 400, height: 400 };

        expect(labels({ x: 0, y: 0, scale: 20 }, viewport)).toHaveLength(2 * 22);
        expect(labels({ x: 0, y: 0, scale: 80 }, viewport)).toHaveLength(2 * 7);
    });

    it("matches the one-label-per-cell layout wherever every label has room", () => {
        // Rows need two font sizes; columns also need the estimated label
        // width (0.6 font sizes per character) plus half a font size.
        const roomy = [
            // 8px font: 16px rows; columns of up to 3 characters need 18.4px.
            { scale: 20, positions: [0, 3, 2.25, 7.5, -0.25, -3.75, -12.5, 31.999] },
            // 10px font: 20px rows; columns of up to 5 characters need 35px.
            { scale: 40, positions: [0, 2.25, -0.75, -1, -999.75, 1234.5, 9876.1] },
            // 12px font: 24px rows; columns of up to 6 characters need 49.2px.
            { scale: 64, positions: [-0.5, -12345.6, 54321.25] },
        ];
        const viewports = [
            { width: 800, height: 600 },
            { width: 333, height: 217 },
        ];

        for (const { scale, positions } of roomy) {
            for (const x of positions) {
                for (const y of positions) {
                    for (const viewport of viewports) {
                        const camera = { x, y, scale };
                        expect(labels(camera, viewport), JSON.stringify({ camera, viewport })).toEqual(
                            oneLabelPerCell(camera, viewport),
                        );
                    }
                }
            }
        }
    });

    it("keeps the label count bounded when zoomed far out", () => {
        // One label per cell would be ~6,000 rows and ~8,000 columns at scale 0.1.
        const viewport = { width: 800, height: 600 };

        for (const camera of [
            { x: 0, y: 0, scale: 0.1 },
            { x: -4321.5, y: -1234.25, scale: 0.1 },
            { x: 1e6 + 0.5, y: -1e6 - 0.5, scale: 0.01 },
        ]) {
            const { rows, columns } = axes(camera, viewport);

            expect(rows.length + columns.length).toBeLessThanOrEqual(60);
            // Neighbors stay at least two minimum font sizes apart.
            for (const [axis, position] of [
                [rows, "y"],
                [columns, "x"],
            ] as const) {
                for (let i = 1; i < axis.length; i++) {
                    expect(axis[i][position] - axis[i - 1][position]).toBeGreaterThanOrEqual(
                        2 * COORDINATE_OVERLAY.MIN_FONT_SIZE,
                    );
                }
            }
        }
    });

    it("puts thinned labels on multiples of the step, centered on their cells", () => {
        const viewport = { width: 800, height: 600 };
        const camera = { x: -4321.5, y: -1234.25, scale: 0.1 };
        const { rows, columns } = axes(camera, viewport);

        for (const [axis, origin, position] of [
            [rows, camera.y, "y"],
            [columns, camera.x, "x"],
        ] as const) {
            const step = stepOf(axis);
            expect(step).toBeGreaterThan(1);
            expect(ONE_TWO_FIVE).toContain(step);
            expect(Number(axis[0].text)).toBeLessThan(0);

            axis.forEach((label, i) => {
                const coordinate = Number(label.text);
                expect(Math.abs(coordinate % step)).toBe(0);
                if (i > 0) {
                    expect(coordinate - Number(axis[i - 1].text)).toBe(step);
                }
                expect(label[position]).toBeCloseTo((coordinate - origin) * camera.scale + camera.scale / 2, 9);
            });
        }

        // Panning carries the same labels along with the camera instead of relabeling.
        const pannedRows = axes({ ...camera, y: camera.y + 77.7 }, viewport).rows;
        const rowY = new Map(rows.map((label) => [label.text, label.y]));
        const shared = pannedRows.filter((label) => rowY.has(label.text));
        expect(shared.length).toBeGreaterThan(20);
        for (const label of shared) {
            expect(label.y).toBeCloseTo(rowY.get(label.text)! - 77.7 * camera.scale, 9);
        }
    });

    it("moves to coarser 1-2-5 steps as the camera zooms out", () => {
        const viewport = { width: 800, height: 600 };
        const rowSteps: number[] = [];
        const columnSteps: number[] = [];

        for (let scale = 64; scale > 0.01; scale *= 0.9) {
            const { rows, columns } = axes({ x: -50.5, y: 20.25, scale }, viewport);
            rowSteps.push(stepOf(rows));
            columnSteps.push(stepOf(columns));
        }

        for (const steps of [rowSteps, columnSteps]) {
            for (let i = 1; i < steps.length; i++) {
                expect(steps[i]).toBeGreaterThanOrEqual(steps[i - 1]);
            }
            for (const step of steps) {
                expect(ONE_TWO_FIVE).toContain(step);
            }
        }
        // Zooming out steadily passes through every step of the series in turn.
        expect([...new Set(rowSteps)]).toEqual(ONE_TWO_FIVE.slice(0, 11));
    });
});
