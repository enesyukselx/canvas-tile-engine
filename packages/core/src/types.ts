export type CanvasTileEngineConfig = {
    renderer?: "canvas";
    scale: number;
    maxScale?: number;
    minScale?: number;
    backgroundColor?: string;
    /** When true, center coordinates are snapped to cell centers (x.5, y.5) for pixel-perfect grid alignment */
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
    cursor?: {
        default?: string;
        move?: string;
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

export type EventHandlers = {
    click?: boolean;
    rightClick?: boolean;
    hover?: boolean;
    drag?: boolean;
    zoom?: boolean;
    resize?: boolean;
};

export type Coords = {
    x: number;
    y: number;
};

export type onDrawCallback = (
    ctx: CanvasRenderingContext2D,
    info: { scale: number; width: number; height: number; coords: Coords }
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
    }
) => void;

export type onClickCallback = MouseEventCallback;

export type onHoverCallback = MouseEventCallback;

export type onMouseDownCallback = MouseEventCallback;

export type onMouseUpCallback = MouseEventCallback;

export type onMouseLeaveCallback = MouseEventCallback;

export type onRightClickCallback = MouseEventCallback;

export type onZoomCallback = (scale: number) => void;

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
export type Text = Omit<DrawObject, "rotate" | "radius" | "size"> & {
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
