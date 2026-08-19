/** An axis-aligned rectangle in screen pixels, ready to hand to a fill call. */
export interface ScreenRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Viewport dimensions in logical pixels. */
export interface ScreenSize {
    width: number;
    height: number;
}
