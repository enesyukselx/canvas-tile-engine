import { Coords } from ".";

export type DrawObject = {
    x: number;
    y: number;
    size?: number;
    origin?: {
        mode?: "cell" | "self";
        x?: number; // 0 to 1
        y?: number; // 0 to 1
    };
    style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number };
    /** Rotation angle in degrees (0 = no rotation, positive = clockwise) */
    rotate?: number;
    /** Border radius in pixels. Single value for all corners, or array for [topLeft, topRight, bottomRight, bottomLeft] */
    radius?: number | number[];
};

export type Rect = DrawObject;

export type Circle = Omit<DrawObject, "rotate" | "radius">;

/**
 * Horizontal text alignment. Mirrors the DOM `CanvasTextAlign` values but is
 * declared locally so core's public types do not require the DOM lib (needed by
 * non-DOM renderers such as React Native / Skia).
 */
export type TextAlign = "center" | "end" | "left" | "right" | "start";

/**
 * Vertical text baseline. Mirrors the DOM `CanvasTextBaseline` values; declared
 * locally for the same platform-agnostic reason as {@link TextAlign}.
 */
export type TextBaseline = "alphabetic" | "bottom" | "hanging" | "ideographic" | "middle" | "top";

/**
 * A source rectangle inside a spritesheet image, in sheet pixels.
 * Used to draw a sub-region (frame) of a larger image.
 */
export type SpriteRect = {
    x: number;
    y: number;
    w: number;
    h: number;
};

/**
 * An image to draw. `TImage` is the platform-specific image handle and defaults
 * to `HTMLImageElement` (DOM); other renderers parameterize it (e.g. `SkImage`).
 */
export type ImageItem<TImage = HTMLImageElement> = Omit<DrawObject, "style"> & {
    img: TImage;
    /**
     * Source rectangle in sheet pixels. When set, only this sub-region of
     * `img` is drawn (spritesheet frame); when omitted the whole image is drawn.
     */
    sprite?: SpriteRect;
    /**
     * Opacity from 0 (transparent) to 1 (opaque). Default: 1.
     * Useful for ghost/preview placements in editor-style apps.
     */
    opacity?: number;
};
export type Text = Omit<DrawObject, "radius" | "size"> & {
    text: string;
    /** Font size in world units (scales with zoom). Default: 1 */
    size?: number;
    style?: {
        fillStyle?: string;
        /** Font family (default: "sans-serif") */
        fontFamily?: string;
        textAlign?: TextAlign;
        textBaseline?: TextBaseline;
    };
};
export type Line = {
    from: Coords;
    to: Coords;
};
export type Path = Coords[];
