import { useRef, useCallback, useState, useMemo } from "react";
import type {
    CanvasTileEngine as CanvasTileEngineCore,
    CanvasTileEngineConfig,
    Coords,
    DrawObject,
    EventHandlers,
    LayerHandle,
} from "@canvas-tile-engine/core";

/**
 * Engine handle returned by useCanvasTileEngine hook.
 * Provides access to engine methods with proper typing.
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
    getCenterCoords(): Coords | null;

    /** Update center coordinates */
    updateCoords(center: Coords): void;

    /** Animate to target coordinates */
    goCoords(x: number, y: number, durationMs?: number): void;

    /** Resize the canvas */
    resize(width: number, height: number, durationMs?: number): void;

    /** Get current canvas size */
    getSize(): { width: number; height: number } | null;

    /** Get current canvas scale */
    getScale(): number | null;

    /** Get current config */
    getConfig(): Required<CanvasTileEngineConfig> | null;

    /** Set map boundaries */
    setBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void;

    /** Dynamically update event handlers at runtime */
    setEventHandlers(handlers: Partial<EventHandlers>): void;

    /** Draw rectangles */
    drawRect(items: DrawObject | DrawObject[], layer?: number): LayerHandle | null;

    /** Draw static rectangles (cached) */
    drawStaticRect(items: DrawObject[], cacheKey: string, layer?: number): LayerHandle | null;

    /** Draw circles */
    drawCircle(items: DrawObject | DrawObject[], layer?: number): LayerHandle | null;

    /** Draw static circles (cached) */
    drawStaticCircle(items: DrawObject[], cacheKey: string, layer?: number): LayerHandle | null;

    /** Draw lines */
    drawLine(
        items: { from: Coords; to: Coords } | { from: Coords; to: Coords }[],
        style?: { strokeStyle?: string; lineWidth?: number },
        layer?: number
    ): LayerHandle | null;

    /** Draw text */
    drawText(
        items: { coords: Coords; text: string } | { coords: Coords; text: string }[],
        style?: { fillStyle?: string; font?: string; textAlign?: CanvasTextAlign; textBaseline?: CanvasTextBaseline },
        layer?: number
    ): LayerHandle | null;

    /** Draw paths/polylines */
    drawPath(
        items: Coords[] | Coords[][],
        style?: { strokeStyle?: string; lineWidth?: number },
        layer?: number
    ): LayerHandle | null;

    /** Draw images */
    drawImage(
        items:
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement })
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement })[],
        layer?: number
    ): LayerHandle | null;

    /** Draw static images (cached) */
    drawStaticImage(
        items: (Omit<DrawObject, "style"> & { img: HTMLImageElement })[],
        cacheKey: string,
        layer?: number
    ): LayerHandle | null;

    /** Draw grid lines */
    drawGridLines(cellSize: number, lineWidth?: number, strokeStyle?: string, layer?: number): LayerHandle | null;

    /** Add custom draw function */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer?: number
    ): LayerHandle | null;

    /** Clear a specific layer */
    clearLayer(layer: number): void;

    /** Clear all layers */
    clearAll(): void;

    /** Clear static cache */
    clearStaticCache(cacheKey?: string): void;

    /** Remove a previously registered draw callback */
    removeLayerHandle(handle: LayerHandle): void;

    /** Image loader instance */
    readonly images: CanvasTileEngineCore["images"] | null;
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
    const [isReady, setIsReady] = useState(false);

    const setInstance = useCallback((engine: CanvasTileEngineCore | null) => {
        instanceRef.current = engine;
        setIsReady(engine !== null);
    }, []);

    // Create stable handle object using useMemo
    const handle = useMemo<EngineHandle>(
        () => ({
            _containerRef: containerRef,
            _setInstance: setInstance,

            get isReady() {
                return isReady;
            },

            get instance() {
                return instanceRef.current;
            },

            get images() {
                return instanceRef.current?.images ?? null;
            },

            render() {
                instanceRef.current?.render();
            },

            getCenterCoords() {
                return instanceRef.current?.getCenterCoords() ?? null;
            },

            updateCoords(center: Coords) {
                instanceRef.current?.updateCoords(center);
            },

            goCoords(x: number, y: number, durationMs?: number) {
                instanceRef.current?.goCoords(x, y, durationMs);
            },

            resize(width: number, height: number, durationMs?: number) {
                instanceRef.current?.resize(width, height, durationMs);
            },

            getSize() {
                return instanceRef.current?.getSize() ?? null;
            },

            getScale() {
                return instanceRef.current?.getScale() ?? NaN;
            },

            getConfig() {
                return instanceRef.current?.getConfig() ?? null;
            },

            setBounds(bounds) {
                instanceRef.current?.setBounds(bounds);
            },

            setEventHandlers(handlers) {
                instanceRef.current?.setEventHandlers(handlers);
            },

            drawRect(items, layer) {
                return instanceRef.current?.drawRect(items, layer) ?? null;
            },

            drawStaticRect(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticRect(items, cacheKey, layer) ?? null;
            },

            drawCircle(items, layer) {
                return instanceRef.current?.drawCircle(items, layer) ?? null;
            },

            drawStaticCircle(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticCircle(items, cacheKey, layer) ?? null;
            },

            drawLine(items, style, layer) {
                return instanceRef.current?.drawLine(items, style, layer) ?? null;
            },

            drawText(items, style, layer) {
                return instanceRef.current?.drawText(items, style, layer) ?? null;
            },

            drawPath(items, style, layer) {
                return instanceRef.current?.drawPath(items, style, layer) ?? null;
            },

            drawImage(items, layer) {
                return instanceRef.current?.drawImage(items, layer) ?? null;
            },

            drawStaticImage(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticImage(items, cacheKey, layer) ?? null;
            },

            drawGridLines(cellSize, lineWidth, strokeStyle, layer) {
                return instanceRef.current?.drawGridLines(cellSize, lineWidth, strokeStyle, layer) ?? null;
            },

            addDrawFunction(fn, layer) {
                return instanceRef.current?.addDrawFunction(fn, layer) ?? null;
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
        [setInstance, isReady]
    );

    return handle;
}
