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
export type Line<TData = unknown> = {
    from: Coords;
    to: Coords;
    /**
     * Arbitrary app data attached to the segment. Never read by the engine or
     * renderers; carried through so `hitTest` results can identify the item
     * without relying on array positions.
     */
    data?: TData;
};

/**
 * Legacy polyline form: a bare array of world points.
 * @deprecated Use {@link PathItem} (`{ points, style, ... }`) instead; this
 * form only supports call-level stroke styling and no fill or hit data.
 */
export type Path = Coords[];

/** Per-item styling for {@link PathItem}. Same unit convention as elsewhere:
 * plain values are world units and scale with zoom; `*Px` variants are screen
 * pixels and take precedence over their world counterpart. */
export type PathStyle = {
    /** Fill color. Setting it makes the path a filled shape: the outline is
     * implicitly closed for filling and hit testing covers the interior. */
    fillStyle?: string;
    strokeStyle?: string;
    /** Stroke width in world units; scales with zoom. Ignored when
     * {@link lineWidthPx} is set. Default: 1px hairline. */
    lineWidth?: number;
    /** Stroke width in screen pixels, independent of zoom. */
    lineWidthPx?: number;
    /** Dash pattern in world units (anchored to the world, scales with zoom).
     * Ignored when {@link lineDashPx} is set. Omit for a solid line. */
    lineDash?: number[];
    /** Dash pattern in screen pixels, independent of zoom. */
    lineDashPx?: number[];
    /** Corner rounding radius in world units, applied at every interior
     * vertex of `points` (and the closing corners when `closed`). Ignored
     * when {@link cornerRadiusPx} is set. */
    cornerRadius?: number;
    /** Corner rounding radius in screen pixels, independent of zoom. */
    cornerRadiusPx?: number;
};

/**
 * A free-form path drawn through world points.
 *
 * `points` describes an open polyline; `closed` joins the last point back to
 * the first. Setting `style.fillStyle` fills the shape (the outline is closed
 * implicitly for filling, like Canvas2D `fill()`), and filled paths hit-test
 * against their interior. Unfilled paths hit-test against the stroke itself.
 */
export type PathItem<TData = unknown> = {
    /** Polyline vertices in world units (item space: integers are cell centers). */
    points: Coords[];
    /** Join the last point back to the first with a closing segment. */
    closed?: boolean;
    /**
     * Fill rule used for filling and interior hit testing, mirroring Canvas2D:
     * `"nonzero"` (default) counts winding, `"evenodd"` alternates — the
     * difference shows on self-intersecting outlines (e.g. a star polygon).
     */
    fillRule?: "nonzero" | "evenodd";
    style?: PathStyle;
    /**
     * Arbitrary app data attached to the item. Never read by the engine or
     * renderers; carried through so `hitTest` results can identify the item
     * without relying on array positions.
     */
    data?: TData;
};
