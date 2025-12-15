import { useRef, useCallback, useState, useMemo } from "react";
import type {
    CanvasTileEngine as CanvasTileEngineCore,
    CanvasTileEngineConfig,
    Coords,
    DrawObject,
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

    /** Get current config */
    getConfig(): Required<CanvasTileEngineConfig> | null;

    /** Set map boundaries */
    setBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void;

    /** Draw rectangles */
    drawRect(items: DrawObject | DrawObject[], layer?: number): void;

    /** Draw static rectangles (cached) */
    drawStaticRect(items: DrawObject[], cacheKey: string, layer?: number): void;

    /** Draw circles */
    drawCircle(items: DrawObject | DrawObject[], layer?: number): void;

    /** Draw static circles (cached) */
    drawStaticCircle(items: DrawObject[], cacheKey: string, layer?: number): void;

    /** Draw lines */
    drawLine(
        items: { from: Coords; to: Coords } | { from: Coords; to: Coords }[],
        style?: { strokeStyle?: string; lineWidth?: number },
        layer?: number
    ): void;

    /** Draw text */
    drawText(
        items: { coords: Coords; text: string } | { coords: Coords; text: string }[],
        style?: { fillStyle?: string; font?: string; textAlign?: CanvasTextAlign; textBaseline?: CanvasTextBaseline },
        layer?: number
    ): void;

    /** Draw paths/polylines */
    drawPath(items: Coords[] | Coords[][], style?: { strokeStyle?: string; lineWidth?: number }, layer?: number): void;

    /** Draw images */
    drawImage(
        items:
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement })
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement })[],
        layer?: number
    ): void;

    /** Draw static images (cached) */
    drawStaticImage(
        items: (Omit<DrawObject, "style"> & { img: HTMLImageElement })[],
        cacheKey: string,
        layer?: number
    ): void;

    /** Draw grid lines */
    drawGridLines(cellSize: number, lineWidth?: number, strokeStyle?: string, layer?: number): void;

    /** Add custom draw function */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer?: number
    ): void;

    /** Clear a specific layer */
    clearLayer(layer: number): void;

    /** Clear all layers */
    clearAll(): void;

    /** Clear static cache */
    clearStaticCache(cacheKey?: string): void;

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

            getConfig() {
                return instanceRef.current?.getConfig() ?? null;
            },

            setBounds(bounds) {
                instanceRef.current?.setBounds(bounds);
            },

            drawRect(items, layer) {
                instanceRef.current?.drawRect(items, layer);
            },

            drawStaticRect(items, cacheKey, layer) {
                instanceRef.current?.drawStaticRect(items, cacheKey, layer);
            },

            drawCircle(items, layer) {
                instanceRef.current?.drawCircle(items, layer);
            },

            drawStaticCircle(items, cacheKey, layer) {
                instanceRef.current?.drawStaticCircle(items, cacheKey, layer);
            },

            drawLine(items, style, layer) {
                instanceRef.current?.drawLine(items, style, layer);
            },

            drawText(items, style, layer) {
                instanceRef.current?.drawText(items, style, layer);
            },

            drawPath(items, style, layer) {
                instanceRef.current?.drawPath(items, style, layer);
            },

            drawImage(items, layer) {
                instanceRef.current?.drawImage(items, layer);
            },

            drawStaticImage(items, cacheKey, layer) {
                instanceRef.current?.drawStaticImage(items, cacheKey, layer);
            },

            drawGridLines(cellSize, lineWidth, strokeStyle, layer) {
                instanceRef.current?.drawGridLines(cellSize, lineWidth, strokeStyle, layer);
            },

            addDrawFunction(fn, layer) {
                instanceRef.current?.addDrawFunction(fn, layer);
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
        }),
        [setInstance, isReady]
    );

    return handle;
}
