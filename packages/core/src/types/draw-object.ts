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
export type ImageItem = Omit<DrawObject, "style"> & { img: HTMLImageElement };
export type Text = Omit<DrawObject, "radius" | "size"> & {
    text: string;
    /** Font size in world units (scales with zoom). Default: 1 */
    size?: number;
    style?: {
        fillStyle?: string;
        /** Font family (default: "sans-serif") */
        fontFamily?: string;
        textAlign?: CanvasTextAlign;
        textBaseline?: CanvasTextBaseline;
    };
};
export type Line = {
    from: Coords;
    to: Coords;
};
export type Path = Coords[];
