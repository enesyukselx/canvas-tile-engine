import { describe, expect, it } from "vitest";
import { COORDINATE_OVERLAY } from "@canvas-tile-engine/core";
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import {
    coordinateOverlayBorders,
    coordinateOverlayFontSize,
    forEachCoordinateLabel,
    shouldDrawCoordinateOverlay,
} from "../src/scene/coordinateOverlayLayout";

const size = { width: 100, height: 100 };

interface Label {
    text: string;
    x: number;
    y: number;
}

function labels(camera: { x: number; y: number; scale: number }, viewport = size): Label[] {
    const collected: Label[] = [];
    forEachCoordinateLabel(camera, viewport, (text, x, y) => collected.push({ text, x, y }));
    return collected;
}

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
        // 100x100 at scale 10 shows 10 cells per axis; the loop runs one past.
        const all = labels({ x: 0, y: 0, scale: 10 });
        const rows = all.slice(0, all.length / 2);
        const columns = all.slice(all.length / 2);

        expect(rows).toHaveLength(12);
        expect(columns).toHaveLength(12);

        expect(rows[0]).toEqual({ text: "0", x: 10, y: 5 });
        expect(rows[1]).toEqual({ text: "1", x: 10, y: 15 });
        expect(columns[0]).toEqual({ text: "0", x: 5, y: 90 });
        expect(columns[1]).toEqual({ text: "1", x: 15, y: 90 });
    });

    it("follows the camera", () => {
        const rows = labels({ x: 0, y: 7, scale: 10 }).slice(0, 12);

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
        const rows = labels({ x: 0, y: 2.25, scale: 10 }).slice(0, 2);

        // Starting index -0.25 pulls the first row up a quarter cell.
        expect(rows[0]).toEqual({ text: "2", x: 10, y: 2.5 });
        expect(rows[1]).toEqual({ text: "3", x: 10, y: 12.5 });
    });

    it("emits more labels as the camera zooms out", () => {
        expect(labels({ x: 0, y: 0, scale: 5 })).toHaveLength(2 * 22);
        expect(labels({ x: 0, y: 0, scale: 20 })).toHaveLength(2 * 7);
    });
});
