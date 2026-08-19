import { DEBUG_HUD } from "@canvas-tile-engine/core";
import type { CanvasTileEngineConfig, Coords } from "@canvas-tile-engine/core";
import type { ScreenRect, ScreenSize } from "./types";

/** Baseline of the first HUD line, measured from the top of the panel's band. */
const FIRST_LINE_BASELINE = 18;

/** Left inset of the text inside the panel. */
const TEXT_INSET = 5;

/**
 * Colors and text size every renderer's HUD paints with. The font *family* is
 * renderer-specific (CSS accepts `monospace`, Skia needs a real family name),
 * so only the size is shared.
 * @internal
 */
export const HUD_STYLE = {
    panelColor: "rgba(0, 0, 0, 0.5)",
    textColor: "#00ff99",
    fontSizePx: 12,
} as const;

/** The camera surface the HUD reads; `ICamera` satisfies it structurally. */
export interface HudCamera {
    readonly x: number;
    readonly y: number;
    readonly scale: number;
    getCenter(viewportWidth: number, viewportHeight: number): Coords;
}

/** A HUD line and the baseline-left position to draw it at. */
export interface HudTextLine {
    text: string;
    x: number;
    y: number;
}

/** @internal */
export interface HudLayout {
    panel: ScreenRect;
    lines: HudTextLine[];
}

/**
 * Build the debug HUD for a frame: the enabled readouts as strings, and the
 * screen positions of the panel and each line. Returns `null` when the HUD is
 * off, in which case the renderer paints nothing.
 *
 * Renderers only fill the panel rect and draw each line at its position, so
 * the HUD stays identical across Canvas2D, WebGL and Skia.
 *
 * @param topOffset Pixels to push the whole HUD down from the top edge. The
 * React Native canvas usually extends edge-to-edge under the status bar /
 * notch, which would hide a HUD anchored to the very top, so the Skia renderer
 * passes a positive offset; the DOM and server renderers leave it at 0.
 */
export function computeHudLayout(
    camera: HudCamera,
    config: Readonly<Required<CanvasTileEngineConfig>>,
    size: ScreenSize,
    fps: number,
    topOffset = 0,
): HudLayout | null {
    const hud = config.debug.hud;

    if (!hud || !hud.enabled) {
        return null;
    }

    const lines: string[] = [];

    if (hud.topLeftCoordinates) {
        lines.push(`TopLeft: ${camera.x.toFixed(2)}, ${camera.y.toFixed(2)}`);
    }

    if (hud.coordinates) {
        const center = camera.getCenter(size.width, size.height);
        lines.push(`Coords: ${center.x.toFixed(2)}, ${center.y.toFixed(2)}`);
    }

    if (hud.scale) {
        lines.push(`Scale: ${camera.scale.toFixed(2)}`);
    }

    if (hud.tilesInView) {
        lines.push(`Tiles in view: ${Math.ceil(size.width / camera.scale)} x ${Math.ceil(size.height / camera.scale)}`);
    }

    if (hud.fps) {
        lines.push(`FPS: ${fps}`);
    }

    const panelX = size.width - DEBUG_HUD.PANEL_WIDTH - DEBUG_HUD.PADDING;

    return {
        panel: {
            x: panelX,
            y: topOffset + DEBUG_HUD.PADDING / 2,
            width: DEBUG_HUD.PANEL_WIDTH,
            height: lines.length * DEBUG_HUD.LINE_HEIGHT + DEBUG_HUD.PADDING,
        },
        lines: lines.map((text, i) => ({
            text,
            x: panelX + TEXT_INSET,
            y: topOffset + FIRST_LINE_BASELINE + i * DEBUG_HUD.LINE_HEIGHT,
        })),
    };
}
