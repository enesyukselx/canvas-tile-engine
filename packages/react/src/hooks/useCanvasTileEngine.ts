import { useRef, useCallback, useState, useMemo } from "react";
import type {
    CanvasTileEngine as CanvasTileEngineCore,
    CanvasTileEngineConfig,
    Coords,
    DrawObject,
    EventHandlers,
    LayerHandle,
} from "@canvas-tile-engine/core";

/** Dummy handle returned when engine is not ready */
const DUMMY_LAYER_HANDLE: LayerHandle = { layer: -1, id: Symbol("dummy") };

/** Default config when engine is not ready */
const DEFAULT_CONFIG: Required<CanvasTileEngineConfig> = {
    size: { width: 0, height: 0, minWidth: 100, minHeight: 100, maxWidth: Infinity, maxHeight: Infinity },
    scale: 1,
    minScale: 0.5,
    maxScale: 2,
    backgroundColor: "#ffffff",
    gridAligned: false,
    renderer: "canvas",
    eventHandlers: {
        drag: true,
        zoom: true,
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
    cursor: {
        default: "default",
        move: "move",
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

    /** Get current center coordinates */
    getCenterCoords(): Coords;

    /** Get visible world coordinate bounds of the viewport */
    getVisibleBounds(): { minX: number; maxX: number; minY: number; maxY: number };

    /** Update center coordinates */
    updateCoords(center: Coords): void;

    /** Animate to target coordinates */
    goCoords(x: number, y: number, durationMs?: number, onComplete?: () => void): void;

    /** Resize the canvas */
    resize(width: number, height: number, durationMs?: number, onComplete?: () => void): void;

    /** Get current canvas size */
    getSize(): { width: number; height: number };

    /** Get current canvas scale */
    getScale(): number;

    /** Zoom in by a factor (default: 1.5) */
    zoomIn(factor?: number): void;

    /** Zoom out by a factor (default: 1.5) */
    zoomOut(factor?: number): void;

    /** Get current config */
    getConfig(): Required<CanvasTileEngineConfig>;

    /** Set map boundaries */
    setBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void;

    /** Dynamically update event handlers at runtime */
    setEventHandlers(handlers: Partial<EventHandlers>): void;

    /** Draw rectangles */
    drawRect(items: DrawObject | DrawObject[], layer?: number): LayerHandle;

    /** Draw static rectangles (cached) */
    drawStaticRect(items: DrawObject[], cacheKey: string, layer?: number): LayerHandle;

    /** Draw circles */
    drawCircle(items: DrawObject | DrawObject[], layer?: number): LayerHandle;

    /** Draw static circles (cached) */
    drawStaticCircle(items: DrawObject[], cacheKey: string, layer?: number): LayerHandle;

    /** Draw lines */
    drawLine(
        items: { from: Coords; to: Coords } | { from: Coords; to: Coords }[],
        style?: { strokeStyle?: string; lineWidth?: number },
        layer?: number
    ): LayerHandle;

    /** Draw text */
    drawText(
        items: { coords: Coords; text: string } | { coords: Coords; text: string }[],
        style?: { fillStyle?: string; font?: string; textAlign?: CanvasTextAlign; textBaseline?: CanvasTextBaseline },
        layer?: number
    ): LayerHandle;

    /** Draw paths/polylines */
    drawPath(
        items: Coords[] | Coords[][],
        style?: { strokeStyle?: string; lineWidth?: number },
        layer?: number
    ): LayerHandle;

    /** Draw images */
    drawImage(
        items:
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement })
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement })[],
        layer?: number
    ): LayerHandle;

    /** Draw static images (cached) */
    drawStaticImage(
        items: (Omit<DrawObject, "style"> & { img: HTMLImageElement })[],
        cacheKey: string,
        layer?: number
    ): LayerHandle;

    /** Draw grid lines */
    drawGridLines(cellSize: number, lineWidth?: number, strokeStyle?: string, layer?: number): LayerHandle;

    /** Add custom draw function */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer?: number
    ): LayerHandle;

    /** Clear a specific layer */
    clearLayer(layer: number): void;

    /** Clear all layers */
    clearAll(): void;

    /** Clear static cache */
    clearStaticCache(cacheKey?: string): void;

    /** Remove a previously registered draw callback */
    removeLayerHandle(handle: LayerHandle): void;

    /** Image loader instance (undefined until engine mounts) */
    readonly images: CanvasTileEngineCore["images"] | undefined;
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
    // _isReady state is only used to trigger re-renders, actual value is read from isReadyRef
    const [, setIsReady] = useState(false);
    // Keep isReady in a ref so the handle getter can read it without recreating handle
    const isReadyRef = useRef(false);

    const setInstance = useCallback((engine: CanvasTileEngineCore | null) => {
        instanceRef.current = engine;
        isReadyRef.current = engine !== null;
        setIsReady(engine !== null);
    }, []);

    // Create stable handle object using useMemo
    // Note: isReady is NOT in deps - we read from isReadyRef to keep handle stable
    const handle = useMemo<EngineHandle>(
        () => ({
            _containerRef: containerRef,
            _setInstance: setInstance,

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

            getCenterCoords() {
                return instanceRef.current?.getCenterCoords() ?? { x: 0, y: 0 };
            },

            getVisibleBounds() {
                return instanceRef.current?.getVisibleBounds() ?? { minX: 0, maxX: 0, minY: 0, maxY: 0 };
            },

            updateCoords(center: Coords) {
                instanceRef.current?.updateCoords(center);
            },

            goCoords(x: number, y: number, durationMs?: number, onComplete?: () => void) {
                instanceRef.current?.goCoords(x, y, durationMs, onComplete);
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

            zoomIn(factor?: number) {
                instanceRef.current?.zoomIn(factor);
            },

            zoomOut(factor?: number) {
                instanceRef.current?.zoomOut(factor);
            },

            getConfig() {
                return instanceRef.current?.getConfig() ?? DEFAULT_CONFIG;
            },

            setBounds(bounds) {
                instanceRef.current?.setBounds(bounds);
            },

            setEventHandlers(handlers) {
                instanceRef.current?.setEventHandlers(handlers);
            },

            drawRect(items, layer) {
                return instanceRef.current?.drawRect(items, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawStaticRect(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticRect(items, cacheKey, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawCircle(items, layer) {
                return instanceRef.current?.drawCircle(items, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawStaticCircle(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticCircle(items, cacheKey, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawLine(items, style, layer) {
                return instanceRef.current?.drawLine(items, style, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawText(items, style, layer) {
                return instanceRef.current?.drawText(items, style, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawPath(items, style, layer) {
                return instanceRef.current?.drawPath(items, style, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawImage(items, layer) {
                return instanceRef.current?.drawImage(items, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawStaticImage(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticImage(items, cacheKey, layer) ?? DUMMY_LAYER_HANDLE;
            },

            drawGridLines(cellSize, lineWidth, strokeStyle, layer) {
                return instanceRef.current?.drawGridLines(cellSize, lineWidth, strokeStyle, layer) ?? DUMMY_LAYER_HANDLE;
            },

            addDrawFunction(fn, layer) {
                return instanceRef.current?.addDrawFunction(fn, layer) ?? DUMMY_LAYER_HANDLE;
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

            removeLayerHandle(handle) {
                instanceRef.current?.removeLayerHandle(handle);
            },
        }),
        [setInstance]
    );

    return handle;
}
