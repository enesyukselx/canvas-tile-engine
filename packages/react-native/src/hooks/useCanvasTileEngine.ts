import { useRef, useState } from "react";
import type {
    CanvasTileEngine as CanvasTileEngineCore,
    CanvasTileEngineConfig,
    Circle,
    Coords,
    DrawHandle,
    EventHandlers,
    HitResult,
    HitTestOptions,
    ImageItem,
    Line,
    Rect,
    Text,
    LineStyle,
} from "@canvas-tile-engine/core";
import type { SkiaMount, SkCanvas, SkImage } from "@canvas-tile-engine/renderer-skia";

/** The concrete engine instance type for the Skia / React Native backend. */
export type SkiaEngine = CanvasTileEngineCore<SkiaMount, SkImage>;

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

/**
 * Engine handle returned by {@link useCanvasTileEngine}. Mirrors the web hook but
 * is typed for the Skia backend (`SkImage` instead of `HTMLImageElement`). All
 * methods are safe to call before the engine mounts (they no-op / return
 * defaults).
 */
export interface EngineHandle {
    /** @internal - set by the CanvasTileEngine component */
    _setInstance: (engine: SkiaEngine | null) => void;

    readonly isReady: boolean;
    readonly instance: SkiaEngine | null;

    render(): void;
    getCenterCoords(): Coords;
    getVisibleBounds(): { minX: number; maxX: number; minY: number; maxY: number };
    updateCoords(center: Coords): void;
    goCoords(x: number, y: number, durationMs?: number, onComplete?: () => void): void;
    getSize(): { width: number; height: number };
    getScale(): number;
    setScale(newScale: number): void;
    zoomIn(factor?: number): void;
    zoomOut(factor?: number): void;
    getConfig(): Required<CanvasTileEngineConfig> | undefined;
    setBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }): void;
    setEventHandlers(handlers: Partial<EventHandlers>): void;

    addDrawFunction(
        fn: (canvas: SkCanvas, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer?: number,
    ): DrawHandle;
    drawRect(items: Rect | Rect[], layer?: number): DrawHandle;
    drawStaticRect(items: Rect[], cacheKey: string, layer?: number): DrawHandle;
    drawCircle(items: Circle | Circle[], layer?: number): DrawHandle;
    drawStaticCircle(items: Circle[], cacheKey: string, layer?: number): DrawHandle;
    drawLine(items: Line | Line[], style?: LineStyle, layer?: number): DrawHandle;
    drawText(items: Text | Text[], layer?: number): DrawHandle;
    drawPath(
        items: Coords[] | Coords[][],
        style?: LineStyle,
        layer?: number,
    ): DrawHandle;
    drawImage(items: ImageItem<SkImage> | ImageItem<SkImage>[], layer?: number): DrawHandle;
    drawStaticImage(items: ImageItem<SkImage>[], cacheKey: string, layer?: number): DrawHandle;
    drawGridLines(cellSize: number, lineWidth?: number, strokeStyle?: string, layer?: number): DrawHandle;

    clearLayer(layer: number): void;
    clearAll(): void;
    clearStaticCache(cacheKey?: string): void;
    removeDrawHandle(handle: DrawHandle): void;

    /**
     * All rect/circle/image items under a world point, highest visual
     * priority first. Pass `coords.raw` from event callbacks. Empty before
     * mount.
     */
    hitTest(point: Coords, opts?: HitTestOptions): HitResult<SkImage>[];
    /** The topmost item under a world point, or undefined. */
    hitTestFirst(point: Coords, opts?: HitTestOptions): HitResult<SkImage> | undefined;

    readonly images: SkiaEngine["images"] | undefined;
    /** Decode and cache an image from a URI, resolving to a Skia `SkImage`. */
    loadImage(src: string, retry?: number): Promise<SkImage>;
}

/**
 * React hook that creates an engine handle for the `<CanvasTileEngine>` React
 * Native component.
 *
 * @example
 * ```tsx
 * const engine = useCanvasTileEngine();
 * return <CanvasTileEngine engine={engine} config={config} renderer={new RendererSkia()} />;
 * ```
 */
export function useCanvasTileEngine(): EngineHandle {
    const instanceRef = useRef<SkiaEngine | null>(null);
    // Counter, not a boolean: a key remount calls _setInstance(null) then
    // _setInstance(engine) in one flush; a boolean collapses back to its
    // previous value and React discards the re-render without running
    // consumer effects, even ones whose deps (engine.instance) changed.
    const [, bumpInstanceVersion] = useState(0);
    const isReadyRef = useRef(false);

    // The handle must keep a single identity for the component's entire
    // lifetime, so it lives in a ref (isReady is read through isReadyRef so it
    // never needs to change). useMemo is not enough: React treats it as a
    // discardable cache — Fast Refresh recreates it, which remounts the engine
    // and races the children's draw effects against the new instance.
    const handleRef = useRef<EngineHandle | null>(null);
    if (handleRef.current === null) {
        handleRef.current = {
            _setInstance: (engine: SkiaEngine | null) => {
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
            getCenterCoords() {
                return instanceRef.current?.getCenterCoords() ?? { x: 0, y: 0 };
            },
            getVisibleBounds() {
                return instanceRef.current?.getVisibleBounds() ?? { minX: 0, maxX: 0, minY: 0, maxY: 0 };
            },
            updateCoords(center) {
                instanceRef.current?.updateCoords(center);
            },
            goCoords(x, y, durationMs, onComplete) {
                instanceRef.current?.goCoords(x, y, durationMs, onComplete);
            },
            getSize() {
                return instanceRef.current?.getSize() ?? { width: 0, height: 0 };
            },
            getScale() {
                return instanceRef.current?.getScale() ?? 1;
            },
            setScale(newScale) {
                instanceRef.current?.setScale(newScale);
            },
            zoomIn(factor) {
                instanceRef.current?.zoomIn(factor);
            },
            zoomOut(factor) {
                instanceRef.current?.zoomOut(factor);
            },
            getConfig() {
                return instanceRef.current?.getConfig();
            },
            setBounds(bounds) {
                instanceRef.current?.setBounds(bounds);
            },
            setEventHandlers(handlers) {
                instanceRef.current?.setEventHandlers(handlers);
            },

            addDrawFunction(fn, layer) {
                // The core API is renderer-agnostic (`ctx: unknown`); on the Skia
                // backend the canvas is always an SkCanvas, so we narrow it here
                // to keep the cast out of user code.
                return (
                    instanceRef.current?.addDrawFunction(
                        fn as (ctx: unknown, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
                        layer,
                    ) ?? droppedDraw("addDrawFunction")
                );
            },
            drawRect(items, layer) {
                return instanceRef.current?.drawRect(items, layer) ?? droppedDraw("drawRect");
            },
            drawStaticRect(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticRect(items, cacheKey, layer) ?? droppedDraw("drawStaticRect");
            },
            drawCircle(items, layer) {
                return instanceRef.current?.drawCircle(items, layer) ?? droppedDraw("drawCircle");
            },
            drawStaticCircle(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticCircle(items, cacheKey, layer) ?? droppedDraw("drawStaticCircle");
            },
            drawLine(items, style, layer) {
                return instanceRef.current?.drawLine(items, style, layer) ?? droppedDraw("drawLine");
            },
            drawText(items, layer) {
                return instanceRef.current?.drawText(items, layer) ?? droppedDraw("drawText");
            },
            drawPath(items, style, layer) {
                return instanceRef.current?.drawPath(items, style, layer) ?? droppedDraw("drawPath");
            },
            drawImage(items, layer) {
                return instanceRef.current?.drawImage(items, layer) ?? droppedDraw("drawImage");
            },
            drawStaticImage(items, cacheKey, layer) {
                return instanceRef.current?.drawStaticImage(items, cacheKey, layer) ?? droppedDraw("drawStaticImage");
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

            hitTest(point, opts) {
                return instanceRef.current?.hitTest(point, opts) ?? [];
            },

            hitTestFirst(point, opts) {
                return instanceRef.current?.hitTestFirst(point, opts);
            },

            loadImage(src, retry) {
                if (!instanceRef.current) {
                    return Promise.reject(new Error("Engine not ready. Wait for isReady before loading images."));
                }
                return instanceRef.current.images.load(src, retry);
            },
        };
    }
    return handleRef.current;
}
