export type CanvasTileEngineConfig = {
    scale: number;
    maxScale?: number;
    minScale?: number;
    backgroundColor?: string;
    /**
     * When true, the initial center snaps to the nearest grid-aligned value
     * for pixel-perfect alignment: half-integers (x.5) for even tile counts,
     * integers for odd. Integers are cell centers (cell k spans
     * [k-0.5, k+0.5]); exact ties snap down so a center computed as N/2 for
     * a 0-based N-cell board lands on the true board center (N-1)/2.
     */
    gridAligned?: boolean;
    size: {
        width: number;
        height: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
    };
    responsive?: "preserve-scale" | "preserve-viewport" | false;
    eventHandlers?: EventHandlers;
    bounds?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
    coordinates?: {
        enabled?: boolean;
        shownScaleRange?: { min: number; max: number };
    };
    debug?: {
        enabled?: boolean;
        hud?: {
            enabled?: boolean;
            topLeftCoordinates?: boolean;
            coordinates?: boolean;
            scale?: boolean;
            tilesInView?: boolean;
            fps?: boolean;
        };
        eventHandlers?: {
            click?: boolean;
            hover?: boolean;
            drag?: boolean;
            zoom?: boolean;
            resize?: boolean;
        };
    };
};

/**
 * Anchor point for zoom interactions (wheel and pinch):
 * - `"pointer"` — zoom toward the mouse cursor / pinch midpoint.
 * - `"center"` — zoom toward the center of the canvas.
 */
export type ZoomMode = "pointer" | "center";

export type EventHandlers = {
    click?: boolean;
    rightClick?: boolean;
    hover?: boolean;
    drag?: boolean;
    /** Zoom behavior: `false` disables zoom, `true` is shorthand for `"pointer"`. */
    zoom?: boolean | ZoomMode;
    resize?: boolean;
};
