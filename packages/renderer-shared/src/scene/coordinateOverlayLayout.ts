import { COORDINATE_OVERLAY } from "@canvas-tile-engine/core";
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import type { ScreenRect, ScreenSize } from "./types";

/** Distance from the gutter's outer edge to the center of its labels. */
const LABEL_INSET = COORDINATE_OVERLAY.BORDER_WIDTH / 2;

/**
 * Colors every renderer's coordinate overlay paints with. The font *family* is
 * renderer-specific (CSS accepts `Arial`, Skia needs a platform family name),
 * so only the size — see {@link coordinateOverlayFontSize} — is shared.
 * @internal
 */
export const COORDINATE_OVERLAY_STYLE = {
    borderColor: `rgba(0, 0, 0, ${COORDINATE_OVERLAY.BORDER_OPACITY})`,
    textColor: `rgba(255, 255, 255, ${COORDINATE_OVERLAY.TEXT_OPACITY})`,
} as const;

/** The camera surface the overlay reads; `ICamera` satisfies it structurally. */
export interface OverlayCamera {
    readonly x: number;
    readonly y: number;
    readonly scale: number;
}

/** The two gutters the labels sit in. */
export interface CoordinateOverlayBorders {
    left: ScreenRect;
    bottom: ScreenRect;
}

/** Whether the overlay is enabled and the current scale is inside its configured range. */
export function shouldDrawCoordinateOverlay(
    config: Readonly<Required<CanvasTileEngineConfig>>,
    scale: number,
): boolean {
    const coordsConfig = config.coordinates;

    if (!coordsConfig.enabled) {
        return false;
    }

    if (!coordsConfig.shownScaleRange) {
        return false;
    }

    const { min, max } = coordsConfig.shownScaleRange;

    return scale >= min && scale <= max;
}

/** Label size, scaled with the camera and clamped to the configured min/max. */
export function coordinateOverlayFontSize(scale: number): number {
    return Math.min(
        COORDINATE_OVERLAY.MAX_FONT_SIZE,
        Math.max(COORDINATE_OVERLAY.MIN_FONT_SIZE, scale * COORDINATE_OVERLAY.FONT_SIZE_SCALE_FACTOR),
    );
}

/**
 * The gutters the labels are drawn over: a full-height strip on the left and a
 * full-width strip along the bottom.
 */
export function coordinateOverlayBorders(size: ScreenSize): CoordinateOverlayBorders {
    return {
        left: { x: 0, y: 0, width: COORDINATE_OVERLAY.BORDER_WIDTH, height: size.height },
        bottom: {
            x: COORDINATE_OVERLAY.BORDER_WIDTH,
            y: size.height - COORDINATE_OVERLAY.BORDER_WIDTH,
            width: size.width,
            height: COORDINATE_OVERLAY.BORDER_WIDTH,
        },
    };
}

/** Minimum distance between stacked Y labels, in font sizes: a blank line between rows. */
const ROW_LABEL_SPACING_EM = 2;

/** Estimated advance of one digit or minus sign, in font sizes; Arial's digits are about 0.56. */
const LABEL_CHAR_WIDTH_EM = 0.6;

/** Minimum blank space between side-by-side X labels, in font sizes. */
const COLUMN_LABEL_GAP_EM = 0.5;

/** Label steps within each power of ten. */
const STEP_MULTIPLES = [1, 2, 5] as const;

/**
 * The smallest step in world units from the 1-2-5 series (1, 2, 5, 10, 20,
 * 50, ...) whose on-screen spacing `step * scale` is at least `minSpacing`
 * pixels. A scale that is not a positive number gets 1, so the search always
 * terminates.
 */
function coordinateLabelStep(scale: number, minSpacing: number): number {
    if (!(scale > 0)) {
        return 1;
    }

    for (let decade = 1; ; decade *= 10) {
        for (const multiple of STEP_MULTIPLES) {
            const step = multiple * decade;
            if (step * scale >= minSpacing) {
                return step;
            }
        }
    }
}

/**
 * Visit the axis labels for the current view: the Y labels down the left
 * gutter first, then the X labels along the bottom one. Each is meant to be
 * drawn centered on the position handed to `visit` (Canvas2D's
 * `textAlign: "center"` / `textBaseline: "middle"`), the center of the cell it
 * names.
 *
 * Every coordinate gets a label while the labels have room. Once they would
 * crowd each other, an axis labels only the multiples of a step from the 1-2-5
 * series (every 2nd, 5th, 10th, 20th, ... coordinate): the smallest step that
 * keeps labels two font sizes apart, and X labels also at least the estimated
 * width of the widest visible label plus a gap apart. Labels stay on their
 * coordinates while panning, and the count per axis is bounded by the viewport
 * size in pixels instead of growing with the visible span in world units.
 *
 * Lazy rather than array-returning so renderers paint straight from the loop
 * without allocating a list every frame.
 */
export function forEachCoordinateLabel(
    camera: OverlayCamera,
    size: ScreenSize,
    visit: (text: string, x: number, y: number) => void,
): void {
    const cordGap = camera.scale;
    const visibleAreaWidthInCords = size.width / cordGap;
    const visibleAreaHeightInCords = size.height / cordGap;

    const fontSize = coordinateOverlayFontSize(camera.scale);
    const rowSpacing = ROW_LABEL_SPACING_EM * fontSize;
    // The widest label in a span of integers is at one of its ends.
    const widestColumnChars = Math.max(
        String(Math.floor(camera.x)).length,
        String(Math.ceil(camera.x + visibleAreaWidthInCords)).length,
    );
    const columnSpacing = Math.max(
        rowSpacing,
        (widestColumnChars * LABEL_CHAR_WIDTH_EM + COLUMN_LABEL_GAP_EM) * fontSize,
    );
    const rowStep = coordinateLabelStep(cordGap, rowSpacing);
    const columnStep = coordinateLabelStep(cordGap, columnSpacing);

    // `%` keeps the sign of the camera position, so each axis starts at the
    // multiple of its step at or before a positive position and at or after a
    // negative one; with a step of 1 this is the one-label-per-cell layout.

    // Y coordinates (left gutter)
    for (let i = 0 - (camera.y % rowStep); i <= visibleAreaHeightInCords + rowStep; i += rowStep) {
        visit(Math.round(camera.y + i).toString(), LABEL_INSET, cordGap * i + cordGap / 2);
    }

    // X coordinates (bottom gutter)
    for (let i = 0 - (camera.x % columnStep); i <= visibleAreaWidthInCords + columnStep; i += columnStep) {
        visit(Math.round(camera.x + i).toString(), cordGap * i + cordGap / 2, size.height - LABEL_INSET);
    }
}
