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
    /**
     * Line thickness in world units; scales with zoom.
     * Ignored when {@link lineWidthPx} is set. Default: 1px hairline.
     */
    lineWidth?: number;
    /**
     * Line thickness in screen pixels, independent of zoom.
     * Takes precedence over {@link lineWidth}.
     */
    lineWidthPx?: number;
    /**
     * Dash pattern in world units (dashes are anchored to the world and scale
     * with zoom). Follows Canvas2D `setLineDash` semantics. Ignored when
     * {@link lineDashPx} is set. Omit for a solid line.
     */
    lineDash?: number[];
    /**
     * Dash pattern in screen pixels, independent of zoom.
     * Takes precedence over {@link lineDash}.
     */
    lineDashPx?: number[];
    /**
     * Corner rounding radius for Path polylines, in world units (scales with
     * zoom). Clamped per corner so short segments never overlap. Ignored when
     * {@link cornerRadiusPx} is set; has no effect on Line items (single
     * segments have no corners).
     */
    cornerRadius?: number;
    /**
     * Corner rounding radius in screen pixels, independent of zoom.
     * Takes precedence over {@link cornerRadius}.
     */
    cornerRadiusPx?: number;
}

/**
 * Coordinate transform helpers handed to custom draw callbacks
 * (`addDrawFunction` / `onDraw`), so user code never re-derives the
 * `(world - topLeft) * scale` formula or the cell-center offset.
 */
export interface DrawTransform {
    /**
     * Item-space world coordinate → canvas pixel position. Integers are cell
     * centers (the same space item `x`/`y` live in), so `worldToScreen(k, k)`
     * is the pixel at the center of cell `k`.
     */
    worldToScreen(x: number, y: number): Coords;
    /**
     * Canvas pixel position → raw (corner-space) world coordinate — the same
     * space event payloads report as `coords.raw`.
     */
    screenToWorld(x: number, y: number): Coords;
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

/**
 * Dependencies injected into a renderer's `init`.
 *
 * `TMount` is the platform-specific mount target the engine is constructed with.
 * It defaults to `HTMLDivElement` so existing DOM renderers stay source- and
 * type-compatible; non-DOM renderers (e.g. React Native / Skia) parameterize it
 * with their own mount type.
 */
export interface RendererDependencies<TMount = HTMLDivElement> {
    wrapper: TMount;
    camera: ICamera;
    viewport: ViewportState;
    config: Config;
    transformer: CoordinateTransformer;
}

export interface IRenderer<TMount = HTMLDivElement, TImage = HTMLImageElement> {
    // ─── Lifecycle ───
    init(deps: RendererDependencies<TMount>): void;
    render(): void;
    resize(width: number, height: number): void;
    resizeWithAnimation(width: number, height: number, durationMs: number, onComplete?: () => void): void;
    destroy(): void;

    // ─── Draw API ───
    getDrawAPI(): IDrawAPI<TImage>;

    // ─── Image Loader ───
    getImageLoader(): IImageLoader<TImage>;

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

export interface IDrawAPI<TImage = HTMLImageElement> {
    addDrawFunction(
        fn: (ctx: unknown, coords: Coords, config: Required<CanvasTileEngineConfig>, transform: DrawTransform) => void,
        layer?: number,
    ): DrawHandle;
    drawRect(items: Rect | Rect[], layer?: number): DrawHandle;
    drawCircle(items: Circle | Circle[], layer?: number): DrawHandle;
    drawLine(items: Line | Line[], style?: LineStyle, layer?: number): DrawHandle;
    drawText(items: Text | Text[], layer?: number): DrawHandle;
    drawImage(items: ImageItem<TImage> | ImageItem<TImage>[], layer?: number): DrawHandle;
    drawPath(items: Path | Path[], style?: LineStyle, layer?: number): DrawHandle;
    drawGridLines(cellSize: number, style: { lineWidth: number; strokeStyle: string }, layer?: number): DrawHandle;
    drawStaticRect(items: Rect[], cacheKey: string, layer?: number): DrawHandle;
    drawStaticCircle(items: Circle[], cacheKey: string, layer?: number): DrawHandle;
    drawStaticImage(items: ImageItem<TImage>[], cacheKey: string, layer?: number): DrawHandle;
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
export interface IImageLoader<TImage = HTMLImageElement> {
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
    setScaleLimits(minScale: number, maxScale: number): void;
    setCenter(center: Coords, viewportWidth: number, viewportHeight: number): void;
    getCenter(viewportWidth: number, viewportHeight: number): Coords;
    getVisibleBounds(viewportWidth: number, viewportHeight: number): Bounds;
    setBounds(bounds: Bounds): void;
    adjustForResize(dw: number, dh: number): void;
}

export * from "./callback";
export * from "./config";
export * from "./draw-object";
