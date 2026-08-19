import { describe, expect, it } from "vitest";
import { DEBUG_HUD } from "@canvas-tile-engine/core";
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { computeHudLayout, type HudCamera } from "../src/scene/hudLayout";

type HudFlags = NonNullable<NonNullable<CanvasTileEngineConfig["debug"]>["hud"]>;

const size = { width: 400, height: 300 };

const camera: HudCamera = {
    x: 12.345,
    y: -6.789,
    scale: 32,
    getCenter: () => ({ x: 18.5, y: -1.25 }),
};

// computeHudLayout only reads config.debug.hud.
function configWith(hud: HudFlags | undefined): Readonly<Required<CanvasTileEngineConfig>> {
    return { debug: { hud } } as unknown as Required<CanvasTileEngineConfig>;
}

const allOff: HudFlags = {
    enabled: true,
    topLeftCoordinates: false,
    coordinates: false,
    scale: false,
    tilesInView: false,
    fps: false,
};

const texts = (hud: HudFlags, fps = 0) =>
    computeHudLayout(camera, configWith(hud), size, fps)?.lines.map((line) => line.text);

describe("computeHudLayout", () => {
    it("paints nothing when the HUD is absent or disabled", () => {
        expect(computeHudLayout(camera, configWith(undefined), size, 60)).toBeNull();
        expect(computeHudLayout(camera, configWith({ ...allOff, enabled: false }), size, 60)).toBeNull();
    });

    it("lists only the enabled readouts, in a fixed order", () => {
        expect(
            texts({
                enabled: true,
                topLeftCoordinates: true,
                coordinates: true,
                scale: true,
                tilesInView: true,
                fps: true,
            }),
        ).toEqual([
            "TopLeft: 12.35, -6.79",
            "Coords: 18.50, -1.25",
            "Scale: 32.00",
            "Tiles in view: 13 x 10",
            "FPS: 0",
        ]);

        expect(texts({ ...allOff, scale: true })).toEqual(["Scale: 32.00"]);
    });

    it("reports the sampled frame rate", () => {
        expect(texts({ ...allOff, fps: true }, 58)).toEqual(["FPS: 58"]);
    });

    it("rounds tiles in view up on both axes", () => {
        // 400x300 at scale 32 spans 12.5 x 9.375 tiles.
        expect(texts({ ...allOff, tilesInView: true })).toEqual(["Tiles in view: 13 x 10"]);
    });

    it("anchors the panel to the top right and sizes it to the line count", () => {
        const layout = computeHudLayout(camera, configWith({ ...allOff, scale: true, fps: true }), size, 60)!;

        expect(layout.panel).toEqual({
            x: size.width - DEBUG_HUD.PANEL_WIDTH - DEBUG_HUD.PADDING,
            y: DEBUG_HUD.PADDING / 2,
            width: DEBUG_HUD.PANEL_WIDTH,
            height: 2 * DEBUG_HUD.LINE_HEIGHT + DEBUG_HUD.PADDING,
        });
    });

    it("stacks the lines inside the panel", () => {
        const layout = computeHudLayout(camera, configWith({ ...allOff, scale: true, fps: true }), size, 60)!;
        const [first, second] = layout.lines;

        expect(first.x).toBe(layout.panel.x + 5);
        expect(second.x).toBe(first.x);
        expect(second.y - first.y).toBe(DEBUG_HUD.LINE_HEIGHT);
        // Baselines sit inside the panel band.
        expect(first.y).toBeGreaterThan(layout.panel.y);
        expect(second.y).toBeLessThan(layout.panel.y + layout.panel.height);
    });

    it("keeps an empty panel when every readout is off", () => {
        const layout = computeHudLayout(camera, configWith(allOff), size, 60)!;

        expect(layout.lines).toEqual([]);
        expect(layout.panel.height).toBe(DEBUG_HUD.PADDING);
    });

    it("shifts the whole HUD down by topOffset", () => {
        const hud = { ...allOff, scale: true, fps: true };
        const base = computeHudLayout(camera, configWith(hud), size, 60)!;
        const offset = computeHudLayout(camera, configWith(hud), size, 60, 50)!;

        expect(offset.panel.y - base.panel.y).toBe(50);
        expect(offset.panel.x).toBe(base.panel.x);
        expect(offset.lines.map((line) => line.y - 50)).toEqual(base.lines.map((line) => line.y));
        expect(offset.lines.map((line) => line.x)).toEqual(base.lines.map((line) => line.x));
    });
});
