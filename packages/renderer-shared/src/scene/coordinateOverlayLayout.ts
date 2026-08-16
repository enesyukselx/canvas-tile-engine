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

/**
 * Visit every axis label for the current view: the Y labels down the left
 * gutter first, then the X labels along the bottom one. Each is meant to be
 * drawn centered on the position handed to `visit` (Canvas2D's
 * `textAlign: "center"` / `textBaseline: "middle"`).
 *
 * Lazy rather than array-returning because the label count is driven by the
 * visible span in world units — it grows without bound as the camera scale
 * approaches the low end of the configured `shownScaleRange`, so materializing
 * the list would cost more than drawing it.
 */
export function forEachCoordinateLabel(
    camera: OverlayCamera,
    size: ScreenSize,
    visit: (text: string, x: number, y: number) => void,
): void {
    const cordGap = camera.scale;
    const visibleAreaWidthInCords = size.width / cordGap;
    const visibleAreaHeightInCords = size.height / cordGap;

    // Y coordinates (left gutter)
    for (let i = 0 - (camera.y % 1); i <= visibleAreaHeightInCords + 1; i++) {
        visit(Math.round(camera.y + i).toString(), LABEL_INSET, cordGap * i + cordGap / 2);
    }

    // X coordinates (bottom gutter)
    for (let i = 0 - (camera.x % 1); i <= visibleAreaWidthInCords + 1; i++) {
        visit(Math.round(camera.x + i).toString(), cordGap * i + cordGap / 2, size.height - LABEL_INSET);
    }
}
