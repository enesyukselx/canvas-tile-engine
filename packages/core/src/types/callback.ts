import { Coords } from ".";

export type onDrawCallback = (
    ctx: unknown,
    info: {
        scale: number;
        width: number;
        height: number;
        coords: Coords;
        /** Item-space world coordinate → canvas pixel position (integers are cell centers). */
        worldToScreen(x: number, y: number): Coords;
        /** Canvas pixel position → raw (corner-space) world coordinate, like event `coords.raw`. */
        screenToWorld(x: number, y: number): Coords;
    },
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
