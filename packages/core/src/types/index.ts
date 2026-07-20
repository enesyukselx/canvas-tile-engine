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
    onWheelCallback,
    onZoomCallback,
} from "./callback";
import { Circle, DrawObject, ImageItem, Line, PathItem, PathStyle, Rect, Text } from "./draw-object";
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

/** Options for the engine's `fitBounds` method. */
export interface FitBoundsOptions {
    /** Extra world-unit margin added on every side of the rectangle. Default 0. */
    padding?: number;
    /** Animation duration in ms (default 500). Use 0 for an instant jump. */
    durationMs?: number;
    /** Fired when the fit completes (synchronously when instant). */
    onComplete?: () => void;
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
    onWheel?: onWheelCallback;
    onResize?: () => void;
    onCameraChange?: () => void;
    onDraw?: onDrawCallback;
}

export interface IDrawAPI<TImage = HTMLImageElement> {
    addDrawFunction(
        fn: (ctx: unknown, coords: Coords, config: Required<CanvasTileEngineConfig>, transform: DrawTransform) => void,
        layer?: number,
    ): DrawHandle;
    drawRect(
        items: Rect | Rect[],
        layer?: number,
        options?: RendererDrawOptions<Rect, ShapeDecorationStyle>,
    ): DrawHandle;
    drawCircle(
        items: Circle | Circle[],
        layer?: number,
        options?: RendererDrawOptions<Circle, ShapeDecorationStyle>,
    ): DrawHandle;
    drawLine(
        items: Line | Line[],
        style?: LineStyle,
        layer?: number,
        options?: RendererDrawOptions<Line, LineDecorationStyle>,
    ): DrawHandle;
    drawText(
        items: Text | Text[],
        layer?: number,
        options?: RendererDrawOptions<Text, TextDecorationStyle>,
    ): DrawHandle;
    drawImage(items: ImageItem<TImage> | ImageItem<TImage>[], layer?: number): DrawHandle;
    /** Receives fully normalized items: the engine converts every accepted
     * `drawPath` input (including the legacy `Coords[]` forms) before
     * delegating, so renderers only implement the item form. */
    drawPath(
        items: PathItem[],
        layer?: number,
        options?: RendererDrawOptions<PathItem, PathDecorationStyle>,
    ): DrawHandle;
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
 * Paint-time decoration callback. Runs for each item on every frame; the
 * returned fields overlay the item's own `style` for that frame only
 * (`undefined` leaves the item untouched). Because it runs at paint time it
 * reads external state live: mutate a selection set and call `render()` —
 * the items are never re-registered and the spatial index never rebuilds.
 *
 * Identify items through `item.data` (the same convention as `hitTest`
 * results); most items should return `undefined`.
 */
export type StyleOf<TItem, TStyle> = (item: TItem) => TStyle | undefined;

/**
 * Paint-time options the engine threads into a renderer's `IDrawAPI` draw
 * methods. Only `styleOf` reaches renderers — registration concerns (`id`)
 * are resolved in the engine.
 */
export interface RendererDrawOptions<TItem, TStyle> {
    styleOf?: StyleOf<TItem, TStyle>;
}

/** Decoration fields for `Rect`/`Circle` — the full shape style (stroke width
 * does not feed shape hit testing, so nothing needs to be excluded). */
export type ShapeDecorationStyle = NonNullable<DrawObject["style"]>;

/** Decoration fields for `Text` — the full text style. */
export type TextDecorationStyle = NonNullable<Text["style"]>;

/**
 * Decoration fields for `Line`. Excludes `lineWidth`/`lineWidthPx`: a line's
 * hit-test area is derived from its stroke width at registration time, so a
 * paint-time decoration must not change it.
 */
export type LineDecorationStyle = Omit<LineStyle, "lineWidth" | "lineWidthPx">;

/**
 * Decoration fields for `PathItem`. Excludes stroke width and corner radius:
 * both feed hit-test geometry resolved at registration time, so a paint-time
 * decoration must not change them.
 */
export type PathDecorationStyle = Omit<PathStyle, "lineWidth" | "lineWidthPx" | "cornerRadius" | "cornerRadiusPx">;

/**
 * Options accepted by the engine draw helpers (`drawRect`, `drawCircle`, ...).
 */
export interface DrawOptions {
    /**
     * Stable identity for this registration. Calling any draw method again
     * with the same id atomically replaces the previous registration: the old
     * draw callback and its hit-test entries are removed (and, for static
     * draws, the offscreen cache is invalidated) before the new one is added.
     * Ids share a single namespace across draw kinds and layers; static draw
     * helpers use their `cacheKey` as the id. Without an id, every call adds
     * a new registration (remove with the returned handle or `clearLayer`).
     */
    id?: string;
}

/** Options for {@link CanvasTileEngine.drawRect}. */
export interface RectDrawOptions<TData = unknown> extends DrawOptions {
    /** Paint-time decoration; see {@link StyleOf}. */
    styleOf?: StyleOf<Rect<TData>, ShapeDecorationStyle>;
}

/** Options for {@link CanvasTileEngine.drawCircle}. */
export interface CircleDrawOptions<TData = unknown> extends DrawOptions {
    /** Paint-time decoration; see {@link StyleOf}. */
    styleOf?: StyleOf<Circle<TData>, ShapeDecorationStyle>;
}

/** Options for {@link CanvasTileEngine.drawText}. */
export interface TextDrawOptions<TData = unknown> extends DrawOptions {
    /** Paint-time decoration; see {@link StyleOf}. */
    styleOf?: StyleOf<Text<TData>, TextDecorationStyle>;
}

/**
 * Options for {@link CanvasTileEngine.drawLine}. `styleOf` overlays the
 * call-level `style` per item, which also makes it the way to give individual
 * lines their own color.
 */
export interface LineDrawOptions<TData = unknown> extends DrawOptions {
    /** Paint-time decoration; see {@link StyleOf}. */
    styleOf?: StyleOf<Line<TData>, LineDecorationStyle>;
}

/** Options for {@link CanvasTileEngine.drawPath}. */
export interface PathDrawOptions<TData = unknown> extends DrawOptions {
    /**
     * Paint-time decoration; see {@link StyleOf}. Note: hit testing keeps the
     * registration-time semantics — decorating an unfilled path with a
     * `fillStyle` paints a fill but does not switch hit testing from
     * stroke to interior.
     */
    styleOf?: StyleOf<PathItem<TData>, PathDecorationStyle>;
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
