import { Coords } from "../types";
import { computePan, computeZoom } from "../utils/viewport";
import { DEFAULT_VALUES } from "../constants";

/**
 * Camera contract used by rendering and coordinate transforms.
 * @internal
 */
export interface ICamera {
    /** Current top-left world x coordinate. */
    readonly x: number;
    /** Current top-left world y coordinate. */
    readonly y: number;
    /** Current zoom scale. */
    readonly scale: number;

    /**
     * Pan the camera by screen-space deltas.
     * @param deltaScreenX X delta in pixels.
     * @param deltaScreenY Y delta in pixels.
     */
    pan(deltaScreenX: number, deltaScreenY: number): void;

    /**
     * Zoom around a mouse position.
     * @param mouseX Mouse X relative to viewport.
     * @param mouseY Mouse Y relative to viewport.
     * @param deltaY Wheel delta (positive scroll down).
     * @param canvasRect Canvas bounding rect for mouse offset.
     */
    zoom(mouseX: number, mouseY: number, deltaY: number, canvasRect: DOMRect): void;

    /**
     * Canvas center coordinates in world space.
     * @param canvasWidth Canvas width in pixels.
     * @param canvasHeight Canvas height in pixels.
     * @returns Center point in world coordinates.
     */
    getCenter(canvasWidth: number, canvasHeight: number): Coords;

    /**
     * Set top-left coordinates based on a target center.
     * @param center Desired center in world space.
     * @param canvasWidth Canvas width in pixels.
     * @param canvasHeight Canvas height in pixels.
     */
    setCenter(center: Coords, canvasWidth: number, canvasHeight: number): void;

    /**
     * Adjust view so center stays stable on resize.
     * @param deltaWidthPx Change in canvas width (pixels).
     * @param deltaHeightPx Change in canvas height (pixels).
     */
    adjustForResize(deltaWidthPx: number, deltaHeightPx: number): void;
}

/**
 * Tracks camera position and zoom for converting between world and screen space.
 * @internal
 */
export class Camera implements ICamera {
    private _x: number;
    private _y: number;
    private _scale: number;
    readonly minScale: number;
    readonly maxScale: number;

    constructor(initialTopLeft: Coords, scale = 1, minScale = 0.1, maxScale = 10) {
        this._x = initialTopLeft.x + DEFAULT_VALUES.CELL_CENTER_OFFSET; // Center of the pixel
        this._y = initialTopLeft.y + DEFAULT_VALUES.CELL_CENTER_OFFSET; // Center of the pixel
        this._scale = scale;
        this.minScale = minScale;
        this.maxScale = maxScale;
    }

    get x(): number {
        return this._x;
    }

    get y(): number {
        return this._y;
    }

    get scale(): number {
        return this._scale;
    }

    pan(deltaScreenX: number, deltaScreenY: number) {
        const next = computePan({ x: this._x, y: this._y }, this._scale, deltaScreenX, deltaScreenY);
        this._x = next.x;
        this._y = next.y;
    }

    zoom(mouseX: number, mouseY: number, deltaY: number, canvasRect: DOMRect) {
        // Mouse position relative to canvas
        const mx = mouseX - canvasRect.left;
        const my = mouseY - canvasRect.top;

        const next = computeZoom({ x: this._x, y: this._y }, this._scale, deltaY, this.minScale, this.maxScale, {
            x: mx,
            y: my,
        });
        this._x = next.topLeft.x;
        this._y = next.topLeft.y;
        this._scale = next.scale;
    }

    getCenter(canvasWidth: number, canvasHeight: number): Coords {
        return {
            x: this._x + canvasWidth / (2 * this._scale) - 0.5,
            y: this._y + canvasHeight / (2 * this._scale) - 0.5,
        };
    }

    setCenter(center: Coords, canvasWidth: number, canvasHeight: number) {
        this._x = center.x - canvasWidth / (2 * this._scale) + 0.5;
        this._y = center.y - canvasHeight / (2 * this._scale) + 0.5;
    }

    adjustForResize(deltaWidthPx: number, deltaHeightPx: number) {
        this._x -= deltaWidthPx / (2 * this._scale);
        this._y -= deltaHeightPx / (2 * this._scale);
    }
}
