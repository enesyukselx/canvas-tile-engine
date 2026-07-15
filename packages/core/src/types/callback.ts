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
