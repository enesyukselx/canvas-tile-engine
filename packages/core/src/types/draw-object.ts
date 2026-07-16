import { Coords } from ".";

export type DrawObject<TData = unknown> = {
    x: number;
    y: number;
    size?: number;
    origin?: {
        mode?: "cell" | "self";
        x?: number; // 0 to 1
        y?: number; // 0 to 1
    };
    style?: {
        fillStyle?: string;
        strokeStyle?: string;
        /**
         * Border width in world units; scales with zoom like the item's
         * geometry. Ignored when `lineWidthPx` is set. Default: 1px hairline.
         */
        lineWidth?: number;
        /**
         * Border width in screen pixels, independent of zoom.
         * Takes precedence over `lineWidth`.
         */
        lineWidthPx?: number;
    };
    /** Rotation angle in degrees (0 = no rotation, positive = clockwise) */
    rotate?: number;
    /**
     * Border radius in world units; scales with zoom so corners stay
     * proportional to the shape. Single value for all corners, or array for
     * [topLeft, topRight, bottomRight, bottomLeft].
     */
    radius?: number | number[];
    /**
     * Arbitrary app data attached to the item. Never read by the engine or
     * renderers; carried through so `hitTest` results can identify the item
     * without relying on array positions.
     */
    data?: TData;
};

export type Rect<TData = unknown> = DrawObject<TData> & {
    /** Width in world units. Defaults to `size`, so square rects are unchanged. */
    width?: number;
    /** Height in world units. Defaults to `size`. */
    height?: number;
};

export type Circle<TData = unknown> = Omit<DrawObject<TData>, "rotate" | "radius">;

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
export type ImageItem<TImage = HTMLImageElement, TData = unknown> = Omit<DrawObject<TData>, "style"> & {
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
export type Text<TData = unknown> = Omit<DrawObject<TData>, "radius" | "size"> & {
    text: string;
    /**
     * Font size in world units: the font's em box spans `size` world units, so
     * rendered pixel height is `size * scale` and text scales with zoom.
     * Ignored when {@link fontPx} is set. Default: 1
     */
    size?: number;
    /**
     * Fixed font size in CSS pixels, independent of zoom. Use for labels that
     * must stay readable at any zoom level. Takes precedence over {@link size}.
     */
    fontPx?: number;
    style?: {
        fillStyle?: string;
        /** Font family (default: "sans-serif") */
        fontFamily?: string;
        textAlign?: TextAlign;
        textBaseline?: TextBaseline;
    };
};
/**
 * A filled and/or stroked closed shape. Vertices are world coordinates in the
 * same space as `Path` points; the ring closes automatically (do not repeat
 * the first point). Unlike Line/Path, polygons are first-class items: they
 * carry per-item style and `data`, and participate in hit testing.
 * Self-intersecting rings have undefined fill behavior.
 */
export type Polygon<TData = unknown> = {
    points: Coords[];
    style?: {
        fillStyle?: string;
        strokeStyle?: string;
        /** Outline width in world units; scales with zoom. Ignored when `lineWidthPx` is set. */
        lineWidth?: number;
        /** Outline width in screen pixels, independent of zoom. Wins over `lineWidth`. */
        lineWidthPx?: number;
    };
    /**
     * Arbitrary app data carried through hit testing; read it back as
     * `hit.item.data` without relying on array positions.
     */
    data?: TData;
};

export type Line = {
    from: Coords;
    to: Coords;
};
export type Path = Coords[];
