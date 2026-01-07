import { Config } from "./modules/Config";
import { CoordinateTransformer } from "./modules/CoordinateTransformer";
import { ViewportState } from "./modules/ViewportState";

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

////////////////////////////////////////////////////////////////////////

export interface RendererDependencies {
    wrapper: HTMLDivElement;
    camera: ICamera;
    viewport: ViewportState;
    config: Config;
    transformer: CoordinateTransformer;
    // gestureHandler: GestureHandler;
}

export interface IRenderer {
    // ─── Lifecycle ───
    init(deps: RendererDependencies): void;
    render(): void;
    resize(width: number, height: number): void;
    resizeWithAnimation(width: number, height: number, durationMs: number, onComplete?: () => void): void;
    destroy(): void;

    // ─── Draw API ───
    getDrawAPI(): IDrawAPI;

    // ─── Image Loader ───
    getImageLoader(): IImageLoader;

    // ─── Event Control ───
    setupEvents(): void;

    // ─── Event Callbacks ───
    onClick?: onClickCallback;
    onRightClick?: onRightClickCallback;
    onHover?: onHoverCallback;
    onMouseDown?: onMouseDownCallback;
    onMouseUp?: onMouseUpCallback;
    onMouseLeave?: onMouseLeaveCallback;
    onZoom?: onZoomCallback;
    onResize?: () => void;
    onCameraChange?: () => void;

    // ─── Draw Callback ───
    onDraw?: onDrawCallback;
}

/**
 * Platform-agnostic image loader interface.
 * Each renderer implements this with platform-specific image handling.
 */
export interface IImageLoader<TImage = unknown> {
    /**
     * Load an image from URL, with caching.
     * @param src Image URL.
     * @param retry Retry count on failure.
     */
    load(src: string, retry?: number): Promise<TImage>;

    /**
     * Get a cached image without loading.
     */
    get(src: string): TImage | undefined;

    /**
     * Check if an image is already cached.
     */
    has(src: string): boolean;

    /**
     * Clear all cached images.
     */
    clear(): void;

    /**
     * Register a callback fired when a new image finishes loading.
     * @returns Unsubscribe function.
     */
    onLoad(cb: () => void): () => void;
}
export interface IDrawAPI {
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer?: number
    ): DrawHandle;
    drawRect(items: Rect | Rect[], layer?: number): DrawHandle;
    drawCircle(items: Circle | Circle[], layer?: number): DrawHandle;
    drawLine(items: Line | Line[], style?: LineStyle, layer?: number): DrawHandle;
    drawText(items: Text | Text[], layer?: number): DrawHandle;
    drawImage(items: ImageItem | ImageItem[], layer?: number): DrawHandle;
    drawPath(items: Path | Path[], style?: LineStyle, layer?: number): DrawHandle;
    drawGridLines(cellSize: number, style: { lineWidth: number; strokeStyle: string }, layer?: number): DrawHandle;
    drawStaticRect(items: Rect[], cacheKey: string, layer?: number): DrawHandle;
    drawStaticCircle(items: Circle[], cacheKey: string, layer?: number): DrawHandle;
    drawStaticImage(items: ImageItem[], cacheKey: string, layer?: number): DrawHandle;
    removeDrawHandle(handle: DrawHandle): void;
    clearLayer(layer: number): void;
    clearAll(): void;
    clearStaticCache(cacheKey?: string): void;
}

export interface DrawHandle {
    readonly id: symbol;
    readonly layer: number;
}

export interface ICamera {
    readonly x: number;
    readonly y: number;
    readonly scale: number;

    pan(dx: number, dy: number): void;
    zoom(screenX: number, screenY: number, deltaY: number, bounds: ViewportBounds): void;
    zoomByFactor(factor: number, centerX: number, centerY: number): void;
    setScale(scale: number): void;
    setCenter(center: Coords, viewportWidth: number, viewportHeight: number): void;
    getCenter(viewportWidth: number, viewportHeight: number): Coords;
    getVisibleBounds(viewportWidth: number, viewportHeight: number): Bounds;
    setBounds(bounds: Bounds): void;
    adjustForResize(dw: number, dh: number): void;
}

// ─── Yardımcı Tipler ───
export interface LineStyle {
    strokeStyle?: string;
    lineWidth?: number;
}

export interface Bounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}

export interface ViewportBounds {
    left: number;
    top: number;
    width: number;
    height: number;
}
