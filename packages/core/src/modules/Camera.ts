import { Coords } from "../types";
import { computePan, computeZoom } from "../utils/viewport";
import { DEFAULT_VALUES } from "../constants";
import { ViewportState } from "./ViewportState";

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

    /**
     * Zoom by a scale factor around a specific point (for pinch-to-zoom).
     * @param factor Scale multiplier (>1 zooms in, <1 zooms out).
     * @param centerX Center X in screen coordinates.
     * @param centerY Center Y in screen coordinates.
     */
    zoomByFactor(factor: number, centerX: number, centerY: number): void;
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
    private bounds?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
    private viewport?: ViewportState;

    constructor(initialTopLeft: Coords, scale = 1, minScale = 0.1, maxScale = 10, viewport?: ViewportState) {
        this._x = initialTopLeft.x + DEFAULT_VALUES.CELL_CENTER_OFFSET; // Center of the pixel
        this._y = initialTopLeft.y + DEFAULT_VALUES.CELL_CENTER_OFFSET; // Center of the pixel
        this._scale = scale;
        this.minScale = minScale;
        this.maxScale = maxScale;
        this.viewport = viewport;
    }

    /**
     * Set camera bounds to limit panning area.
     * @param bounds Min and max coordinates for x and y axes. Set to undefined to remove bounds.
     */
    setBounds(bounds?: { minX: number; maxX: number; minY: number; maxY: number }) {
        this.bounds = bounds;
        // Clamp current position to new bounds
        if (this.bounds) {
            this.clampToBounds();
        }
    }

    private clampToBounds() {
        if (!this.bounds || !this.viewport) {
            return;
        }

        const { width: viewportWidth, height: viewportHeight } = this.viewport.getSize();

        // Calculate viewport size in world units
        const viewWidthWorld = viewportWidth / this._scale;
        const viewHeightWorld = viewportHeight / this._scale;

        this._x = this.clampAxis(this._x, viewWidthWorld, this.bounds.minX, this.bounds.maxX);
        this._y = this.clampAxis(this._y, viewHeightWorld, this.bounds.minY, this.bounds.maxY);
    }

    /**
     * Clamp a single axis value to bounds.
     * If viewport is larger than bounds, center it. Otherwise, keep viewport within bounds.
     */
    private clampAxis(value: number, viewSize: number, min: number, max: number): number {
        const boundsSize = max - min;

        // If viewport is larger than bounds, center the bounds in viewport
        if (viewSize >= boundsSize) {
            return min - (viewSize - boundsSize) / 2;
        }

        // Normal clamping: ensure viewport stays within bounds
        if (value < min) {
            return min;
        }
        if (value + viewSize > max) {
            return max - viewSize;
        }
        return value;
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
        this.clampToBounds();
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
        this.clampToBounds();
    }

    /**
     * Zoom by a scale factor around a specific point (for pinch-to-zoom).
     * @param factor Scale multiplier (>1 zooms in, <1 zooms out).
     * @param centerX Center X in screen coordinates.
     * @param centerY Center Y in screen coordinates.
     */
    zoomByFactor(factor: number, centerX: number, centerY: number) {
        const newScale = Math.min(this.maxScale, Math.max(this.minScale, this._scale * factor));
        if (newScale === this._scale) {
            return;
        }

        // Adjust top-left to keep the pinch center stationary
        this._x = this._x + centerX * (1 / this._scale - 1 / newScale);
        this._y = this._y + centerY * (1 / this._scale - 1 / newScale);
        this._scale = newScale;
        this.clampToBounds();
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
        this.clampToBounds();
    }

    adjustForResize(deltaWidthPx: number, deltaHeightPx: number) {
        this._x -= deltaWidthPx / (2 * this._scale);
        this._y -= deltaHeightPx / (2 * this._scale);
        this.clampToBounds();
    }
}
