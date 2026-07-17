import { Coords, DrawTransform } from ".";
import { CanvasTileEngineConfig } from "./config";

/**
 * Post-frame draw hook. Mirrors the `addDrawFunction` callback signature:
 * the platform context, the viewport's top-left world coordinate, the live
 * normalized config (current scale and size), and the coordinate transform
 * helpers.
 */
export type onDrawCallback = (
    ctx: unknown,
    coords: Coords,
    config: Required<CanvasTileEngineConfig>,
    transform: DrawTransform,
) => void;

type MouseEventCallback = (
    coords: {
        raw: Coords;
        snapped: Coords;
    },
    mouse: {
        raw: Coords;
        snapped: Coords;
    },
    client: {
        raw: Coords;
        snapped: Coords;
    },
) => void;

export type onClickCallback = MouseEventCallback;

export type onHoverCallback = MouseEventCallback;

export type onMouseDownCallback = MouseEventCallback;

export type onMouseUpCallback = MouseEventCallback;

export type onMouseLeaveCallback = MouseEventCallback;

export type onRightClickCallback = MouseEventCallback;

export type onZoomCallback = (scale: number) => void;

/**
 * Details of the zoom gesture that triggered an onWheel callback.
 */
export interface WheelInfo {
    /**
     * Vertical wheel delta in pixels (negative = zoom in). For pinch this is
     * synthesized: the wheel delta that would produce the same zoom factor,
     * so both sources read on the same axis.
     */
    deltaY: number;
    /** Zoom direction implied by the gesture. */
    direction: "in" | "out";
    /** Input source: mouse wheel or two-finger pinch. */
    source: "wheel" | "pinch";
}

/**
 * Fired for wheel (desktop) and pinch (touch) zoom gestures. The coordinate
 * payloads match the other pointer callbacks; for pinch they describe the
 * pinch midpoint.
 */
export type onWheelCallback = (
    coords: {
        raw: Coords;
        snapped: Coords;
    },
    mouse: {
        raw: Coords;
        snapped: Coords;
    },
    client: {
        raw: Coords;
        snapped: Coords;
    },
    wheel: WheelInfo,
) => void;
