import { useRef, useState } from "react";
import type {
    CanvasTileEngine as CanvasTileEngineCore,
    CanvasTileEngineConfig,
    Coords,
    Bounds,
    EventHandlers,
    FitBoundsOptions,
    DrawHandle,
    HitResult,
    HitTestOptions,
    HitTestRectOptions,
    ImageItem,
    Text,
    Circle,
    Line,
    Rect,
    LineStyle,
    DrawTransform,
    PathItem,
    RectDrawOptions,
    CircleDrawOptions,
    TextDrawOptions,
    LineDrawOptions,
    PathDrawOptions,
    DrawOptions,
    StaticDrawOptions,
} from "@canvas-tile-engine/core";

/** Dummy handle returned when engine is not ready */
const DUMMY_DRAW_HANDLE: DrawHandle = { layer: -1, id: Symbol("dummy") };

/**
 * Warn (dev only) and return the dummy handle when a draw method is called
 * before the engine mounts. Without the warning these calls are silent
 * no-ops, which makes remount/ordering bugs invisible.
 */
function droppedDraw(method: string): DrawHandle {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        console.warn(
            `Canvas Tile Engine: ${method}() was called before the engine mounted, so the call was dropped. ` +
                `Gate imperative draw calls on engine.isReady and include engine.instance in your effect deps ` +
                `so they re-run when the engine remounts.`,
        );
    }
    return DUMMY_DRAW_HANDLE;
}

/** Default config when engine is not ready */
const DEFAULT_CONFIG: Required<CanvasTileEngineConfig> = {
    size: {
        width: 0,
        height: 0,
        minWidth: 100,
        minHeight: 100,
        maxWidth: Infinity,
        maxHeight: Infinity,
    },
    responsive: false,
    scale: 1,
    minScale: 0.5,
    maxScale: 2,
    backgroundColor: "#ffffff",
    gridAligned: false,
    eventHandlers: {
        drag: true,
        zoom: "pointer",
        hover: false,
        click: false,
        rightClick: false,
        resize: false,
    },
    bounds: {
        minX: -Infinity,
        maxX: Infinity,
        minY: -Infinity,
        maxY: Infinity,
    },
    coordinates: {
        enabled: false,
        shownScaleRange: { min: 0, max: Infinity },
    },
    debug: {
        enabled: false,
        hud: {
            enabled: false,
            topLeftCoordinates: false,
            coordinates: false,
            scale: false,
            tilesInView: false,
            fps: false,
        },
        eventHandlers: {
            click: false,
            hover: false,
            drag: false,
            zoom: false,
            resize: false,
        },
    },
};

/**
 * Engine handle returned by useCanvasTileEngine hook.
 * Provides access to engine methods with proper typing.
 *
 * All methods return default/dummy values when engine is not ready,
 * allowing safe usage without null checks.
 */
export interface EngineHandle {
    /** @internal - Used by CanvasTileEngine component */
    readonly _containerRef: React.RefObject<HTMLDivElement>;
    /** @internal - Used by CanvasTileEngine component */
    _setInstance: (engine: CanvasTileEngineCore | null) => void;

    /** Whether the engine is ready (mounted and initialized) */
    readonly isReady: boolean;

    /** The underlying engine instance (null until component mounts) */
    readonly instance: CanvasTileEngineCore | null;

    /** Render a frame */
    render(): void;

    /** Get the current view center in world coordinates */
    getCenter(): Coords;

    /** Get visible world coordinate bounds of the viewport */
    getVisibleBounds(): {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };

    /** Move the view center instantly */
    setCenter(center: Coords): void;

    /** Animate the view center to target coordinates */
    goCenter(x: number, y: number, durationMs?: number, onComplete?: () => void): void;

    /** Resize the canvas */
    resize(width: number, height: number, durationMs?: number, onComplete?: () => void): void;

    /** Get current canvas size */
    getSize(): { width: number; height: number };

    /** Get current canvas scale */
    getScale(): number;

    /** Set the canvas scale directly, clamped to min/max bounds. */
    setScale(newScale: number): void;

    /** Animate the canvas scale to a target value, clamped to min/max bounds */
    goScale(targetScale: number, durationMs?: number, onComplete?: () => void): void;

    /** Zoom in by a factor (default: 1.5) */
    zoomIn(factor?: number): void;

    /** Zoom out by a factor (default: 1.5) */
    zoomOut(factor?: number): void;

    /** Update the min/max scale limits at runtime, clamping the current scale into the new range */
    setScaleLimits(minScale: number, maxScale: number): void;

    /** Get current config */
    getConfig(): Required<CanvasTileEngineConfig>;

    /** Set map boundaries */
    setBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void;

    /** Fit a world rectangle into the viewport (centers and rescales, clamped to scale limits) */
    fitBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }, options?: FitBoundsOptions): void;

    /** Dynamically update event handlers at runtime */
    setEventHandlers(handlers: Partial<EventHandlers>): void;

    /** Register a custom draw function */
    addDrawFunction(
        fn: (ctx: unknown, coords: Coords, config: Required<CanvasTileEngineConfig>, transform: DrawTransform) => void,
        layer?: number,
    ): DrawHandle;

    /** Draw rectangles */
    drawRect<TData = unknown>(
        items: Rect<TData> | Rect<TData>[],
        layer?: number,
        options?: RectDrawOptions<TData>,
    ): DrawHandle;

    /** Draw static rectangles (cached) */
    drawStaticRect(items: Rect[], cacheKey: string, layer?: number, options?: StaticDrawOptions): DrawHandle;

    /** Draw circles */
    drawCircle<TData = unknown>(
        items: Circle<TData> | Circle<TData>[],
        layer?: number,
        options?: CircleDrawOptions<TData>,
    ): DrawHandle;

    /** Draw static circles (cached) */
    drawStaticCircle(items: Circle[], cacheKey: string, layer?: number, options?: StaticDrawOptions): DrawHandle;

    /** Draw lines */
    drawLine<TData = unknown>(
        items: Line<TData> | Line<TData>[],
        style?: LineStyle,
        layer?: number,
        options?: LineDrawOptions<TData>,
    ): DrawHandle;

    /** Draw text */
    drawText<TData = unknown>(
        items: Text<TData> | Text<TData>[],
        layer?: number,
        options?: TextDrawOptions<TData>,
    ): DrawHandle;

    /** Draw free-form paths: open/closed polylines, filled shapes, per-item styling */
    drawPath<TData = unknown>(
        items: PathItem<TData> | PathItem<TData>[],
        layer?: number,
        options?: PathDrawOptions<TData>,
    ): DrawHandle;

    /** Draw images */
    drawImage(items: ImageItem | ImageItem[], layer?: number, options?: DrawOptions): DrawHandle;

    /** Draw static images (cached) */
    drawStaticImage(items: ImageItem[], cacheKey: string, layer?: number, options?: StaticDrawOptions): DrawHandle;

    /** Draw grid lines */
    drawGridLines(cellSize: number, lineWidth?: number, strokeStyle?: string, layer?: number): DrawHandle;

    /** Clear a specific layer */
    clearLayer(layer: number): void;

    /** Clear all layers */
    clearAll(): void;

    /** Clear static cache */
    clearStaticCache(cacheKey?: string): void;

    /** Remove a previously registered draw callback */
    removeDrawHandle(handle: DrawHandle): void;

    /**
     * All rect/circle/image/path/line items under a world point, highest visual
     * priority first. Pass `coords.raw` from event callbacks. Empty before
     * mount.
     */
    hitTest<TData = unknown>(point: Coords, opts?: HitTestOptions): HitResult<HTMLImageElement, TData>[];

    /** The topmost item under a world point, or undefined. */
    hitTestFirst<TData = unknown>(point: Coords, opts?: HitTestOptions): HitResult<HTMLImageElement, TData> | undefined;

    /**
     * All items whose geometry intersects (default) or lies fully inside a
     * world rectangle — marquee/box selection. Corners may be in any order;
     * build them from event `coords.raw` values. Empty before mount.
     */
    hitTestRect<TData = unknown>(rect: Bounds, opts?: HitTestRectOptions): HitResult<HTMLImageElement, TData>[];

    /** Image loader instance (undefined until engine mounts) */
    readonly images: CanvasTileEngineCore["images"] | undefined;

    /**
     * Load an image using the engine's image loader.
     * Returns a rejected promise if engine is not ready.
     * @param src - Image URL to load
     * @param retry - Number of retries on failure (default: 1)
     * @example
     * ```tsx
     * const img = await engine.loadImage("/sprites/player.png");
     * ```
     */
    loadImage(src: string, retry?: number): Promise<HTMLImageElement>;
}

/**
 * React hook that creates an engine handle for use with CanvasTileEngine component.
 *
 * @returns Engine handle to pass to CanvasTileEngine component
 *
 * @example
 * ```tsx
 * function App() {
 *   const mainMap = useCanvasTileEngine();
 *   const miniMap = useCanvasTileEngine();
 *
 *   useEffect(() => {
 *     if (mainMap.isReady && miniMap.isReady) {
 *       // Both engines are ready, draw items
 *       mainMap.drawGridLines(50);
 *       mainMap.render();
 *     }
 *   }, [mainMap.isReady, miniMap.isReady]);
 *
 *   return (
 *     <>
 *       <CanvasTileEngine engine={mainMap} config={...} />
 *       <CanvasTileEngine engine={miniMap} config={...} />
 *     </>
 *   );
 * }
 * ```
 */
export function useCanvasTileEngine(): EngineHandle {
    const instanceRef = useRef<CanvasTileEngineCore | null>(null);
    const containerRef = useRef<HTMLDivElement>(null!);
    // State is only used to trigger re-renders; actual values are read from refs.
    // This must be a counter, not a boolean: during a key remount _setInstance
    // runs twice (null, then the new engine) inside one flush, and a boolean
    // would collapse back to its previous value — React then discards the
    // re-render as a no-op WITHOUT running consumer effects, even ones whose
    // deps (engine.instance) changed. A distinct value per call guarantees the
    // post-remount render commits and those effects re-fire.
    const [, bumpInstanceVersion] = useState(0);
    // Keep isReady in a ref so the handle getter can read it without recreating handle
    const isReadyRef = useRef(false);

    // The handle must keep a single identity for the component's entire
    // lifetime, so it lives in a ref (isReady is read through isReadyRef so it
    // never needs to change). useMemo is not enough: React treats it as a
    // discardable cache — Fast Refresh recreates it, which remounts the engine
    // and races the children's draw effects against the new instance.
    const handleRef = useRef<EngineHandle | null>(null);
    if (handleRef.current === null) {
        handleRef.current = {
            _containerRef: containerRef,
            _setInstance: (engine: CanvasTileEngineCore | null) => {
                instanceRef.current = engine;
                isReadyRef.current = engine !== null;
                bumpInstanceVersion((v) => v + 1);
            },

            get isReady() {
                return isReadyRef.current;
            },

            get instance() {
                return instanceRef.current;
            },

            get images() {
                return instanceRef.current?.images;
            },

            render() {
                instanceRef.current?.render();
            },

            getCenter() {
                return instanceRef.current?.getCenter() ?? { x: 0, y: 0 };
            },

            getVisibleBounds() {
                return (
                    instanceRef.current?.getVisibleBounds() ?? {
                        minX: 0,
                        maxX: 0,
                        minY: 0,
                        maxY: 0,
                    }
                );
            },

            setCenter(center: Coords) {
                instanceRef.current?.setCenter(center);
            },

            goCenter(x: number, y: number, durationMs?: number, onComplete?: () => void) {
                instanceRef.current?.goCenter(x, y, durationMs, onComplete);
            },

            resize(width: number, height: number, durationMs?: number, onComplete?: () => void) {
                instanceRef.current?.resize(width, height, durationMs, onComplete);
            },

            getSize() {
                return instanceRef.current?.getSize() ?? { width: 0, height: 0 };
            },

            getScale() {
                return instanceRef.current?.getScale() ?? 1;
            },

            setScale(newScale: number) {
                instanceRef.current?.setScale(newScale);
            },

            goScale(targetScale: number, durationMs?: number, onComplete?: () => void) {
                instanceRef.current?.goScale(targetScale, durationMs, onComplete);
            },

            zoomIn(factor?: number) {
                instanceRef.current?.zoomIn(factor);
            },

            zoomOut(factor?: number) {
                instanceRef.current?.zoomOut(factor);
            },

            setScaleLimits(minScale: number, maxScale: number) {
                instanceRef.current?.setScaleLimits(minScale, maxScale);
            },

            getConfig() {
                return instanceRef.current?.getConfig() ?? DEFAULT_CONFIG;
            },

            setBounds(bounds) {
                instanceRef.current?.setBounds(bounds);
            },

            fitBounds(bounds, options) {
                instanceRef.current?.fitBounds(bounds, options);
            },

            setEventHandlers(handlers) {
                instanceRef.current?.setEventHandlers(handlers);
            },

            addDrawFunction(fn, layer) {
                return instanceRef.current?.addDrawFunction(fn, layer) ?? droppedDraw("addDrawFunction");
            },

            drawRect(items, layer, options) {
                return instanceRef.current?.drawRect(items, layer, options) ?? droppedDraw("drawRect");
            },

            drawStaticRect(items, cacheKey, layer, options) {
                return (
                    instanceRef.current?.drawStaticRect(items, cacheKey, layer, options) ??
                    droppedDraw("drawStaticRect")
                );
            },

            drawCircle(items, layer, options) {
                return instanceRef.current?.drawCircle(items, layer, options) ?? droppedDraw("drawCircle");
            },

            drawStaticCircle(items, cacheKey, layer, options) {
                return (
                    instanceRef.current?.drawStaticCircle(items, cacheKey, layer, options) ??
                    droppedDraw("drawStaticCircle")
                );
            },

            drawLine(items, style, layer, options) {
                return instanceRef.current?.drawLine(items, style, layer, options) ?? droppedDraw("drawLine");
            },

            drawText(items, layer, options) {
                return instanceRef.current?.drawText(items, layer, options) ?? droppedDraw("drawText");
            },

            drawPath(items, layer, options) {
                return instanceRef.current?.drawPath(items, layer, options) ?? droppedDraw("drawPath");
            },

            drawImage(items, layer, options) {
                return instanceRef.current?.drawImage(items, layer, options) ?? droppedDraw("drawImage");
            },

            drawStaticImage(items, cacheKey, layer, options) {
                return (
                    instanceRef.current?.drawStaticImage(items, cacheKey, layer, options) ??
                    droppedDraw("drawStaticImage")
                );
            },

            drawGridLines(cellSize, lineWidth, strokeStyle, layer) {
                return (
                    instanceRef.current?.drawGridLines(cellSize, lineWidth, strokeStyle, layer) ??
                    droppedDraw("drawGridLines")
                );
            },

            clearLayer(layer) {
                instanceRef.current?.clearLayer(layer);
            },

            clearAll() {
                instanceRef.current?.clearAll();
            },

            clearStaticCache(cacheKey) {
                instanceRef.current?.clearStaticCache(cacheKey);
            },

            removeDrawHandle(handle) {
                instanceRef.current?.removeDrawHandle(handle);
            },

            hitTest<TData>(point: Coords, opts?: HitTestOptions) {
                return instanceRef.current?.hitTest<TData>(point, opts) ?? [];
            },

            hitTestFirst<TData>(point: Coords, opts?: HitTestOptions) {
                return instanceRef.current?.hitTestFirst<TData>(point, opts);
            },
            hitTestRect<TData>(rect: Bounds, opts?: HitTestRectOptions) {
                return instanceRef.current?.hitTestRect<TData>(rect, opts) ?? [];
            },

            loadImage(src: string, retry?: number) {
                if (!instanceRef.current) {
                    return Promise.reject(new Error("Engine not ready. Wait for isReady before loading images."));
                }
                return instanceRef.current.images.load(src, retry);
            },
        };
    }

    return handleRef.current;
}
