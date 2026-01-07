import { Config } from "../modules/Config";
import { CoordinateTransformer } from "../modules/CoordinateTransformer";
import { ViewportState } from "../modules/ViewportState";
import {
    onClickCallback,
    onDrawCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseLeaveCallback,
    onMouseUpCallback,
    onRightClickCallback,
    onZoomCallback,
} from "./callback";
import { Circle, ImageItem, Line, Path, Rect, Text } from "./draw-object";
import { CanvasTileEngineConfig } from "./config";

export type Coords = {
    x: number;
    y: number;
};

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

export interface RendererDependencies {
    wrapper: HTMLDivElement;
    camera: ICamera;
    viewport: ViewportState;
    config: Config;
    transformer: CoordinateTransformer;
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
    onDraw?: onDrawCallback;
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

export * from "./callback";
export * from "./config";
export * from "./draw-object";
