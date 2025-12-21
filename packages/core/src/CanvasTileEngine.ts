import { Camera } from "./modules/Camera";
import { Config } from "./modules/Config";
import { CoordinateTransformer } from "./modules/CoordinateTransformer";
import { CanvasDraw } from "./modules/CanvasDraw";
import { EventManager } from "./modules/EventManager";
import { ImageLoader } from "./modules/ImageLoader";
import { Layer, type LayerHandle } from "./modules/Layer";
import { ViewportState } from "./modules/ViewportState";
import { CanvasRenderer } from "./modules/Renderer/CanvasRenderer";
import { IRenderer } from "./modules/Renderer/Renderer";
import {
    Coords,
    DrawObject,
    CanvasTileEngineConfig,
    onClickCallback,
    onRightClickCallback,
    onDrawCallback,
    onHoverCallback,
    EventHandlers,
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
} from "./types";
import { SizeController } from "./modules/SizeController";
import { AnimationController } from "./modules/AnimationController";
import { RendererFactory } from "./modules/RendererFactory";

/**
 * Core engine wiring camera, config, renderer, events, and draw helpers.
 */
export class CanvasTileEngine {
    private config: Config;
    private camera: Camera;
    private viewport: ViewportState;
    private coordinateTransformer: CoordinateTransformer;
    private layers?: Layer;
    private renderer: IRenderer;
    private events: EventManager;
    private draw?: CanvasDraw;
    public images: ImageLoader;
    private sizeController: SizeController;
    private animationController: AnimationController;

    public canvasWrapper: HTMLDivElement;
    public canvas: HTMLCanvasElement;

    /** Callback: center coordinates change */
    public onCoordsChange?: (coords: Coords) => void;

    private _onClick?: onClickCallback;

    public get onClick(): onClickCallback | undefined {
        return this._onClick;
    }
    public set onClick(cb: onClickCallback | undefined) {
        this._onClick = cb;
        this.events.onClick = cb;
    }

    private _onRightClick?: onRightClickCallback;

    public get onRightClick(): onRightClickCallback | undefined {
        return this._onRightClick;
    }
    public set onRightClick(cb: onRightClickCallback | undefined) {
        this._onRightClick = cb;
        this.events.onRightClick = cb;
    }

    private _onHover?: onHoverCallback;
    public get onHover(): onHoverCallback | undefined {
        return this._onHover;
    }
    public set onHover(cb: onHoverCallback | undefined) {
        this._onHover = cb;
        this.events.onHover = cb;
    }

    private _onMouseDown?: onMouseDownCallback;
    public get onMouseDown(): onMouseDownCallback | undefined {
        return this._onMouseDown;
    }
    public set onMouseDown(cb: onMouseDownCallback | undefined) {
        this._onMouseDown = cb;
        this.events.onMouseDown = cb;
    }

    private _onMouseUp?: onMouseUpCallback;
    public get onMouseUp(): onMouseUpCallback | undefined {
        return this._onMouseUp;
    }
    public set onMouseUp(cb: onMouseUpCallback | undefined) {
        this._onMouseUp = cb;
        this.events.onMouseUp = cb;
    }

    private _onMouseLeave?: onMouseLeaveCallback;
    public get onMouseLeave(): onMouseLeaveCallback | undefined {
        return this._onMouseLeave;
    }
    public set onMouseLeave(cb: onMouseLeaveCallback | undefined) {
        this._onMouseLeave = cb;
        this.events.onMouseLeave = cb;
    }

    private _onDraw?: onDrawCallback;
    public get onDraw(): onDrawCallback | undefined {
        return this._onDraw;
    }
    public set onDraw(cb: onDrawCallback | undefined) {
        this._onDraw = cb;
        this.getCanvasRenderer().onDraw = cb;
    }

    private _onResize?: () => void;
    public get onResize(): (() => void) | undefined {
        return this._onResize;
    }
    public set onResize(cb: (() => void) | undefined) {
        this._onResize = cb;
        this.events.onResize = cb;
    }

    private _onZoom?: (scale: number) => void;
    /** Callback: zoom level changes (wheel or pinch) */
    public get onZoom(): ((scale: number) => void) | undefined {
        return this._onZoom;
    }
    public set onZoom(cb: ((scale: number) => void) | undefined) {
        this._onZoom = cb;
        this.events.onZoom = cb;
    }

    /**
     * @param canvas Target canvas element.
     * @param config Initial engine configuration.
     * @param center Initial center in world space.
     */
    constructor(canvasWrapper: HTMLDivElement, config: CanvasTileEngineConfig, center: Coords = { x: 0, y: 0 }) {
        this.canvasWrapper = canvasWrapper;
        this.canvas = canvasWrapper.querySelector("canvas")!;
        this.canvasWrapper.style.position = "relative";
        this.canvasWrapper.style.width = config.size.width + "px";
        this.canvasWrapper.style.height = config.size.height + "px";
        this.canvas.style.position = "absolute";

        this.config = new Config(config);

        const rendererType = config.renderer ?? "canvas";
        const initialTopLeft: Coords = {
            x: center.x - config.size.width / (2 * config.scale),
            y: center.y - config.size.height / (2 * config.scale),
        };

        this.viewport = new ViewportState(config.size.width, config.size.height);
        this.camera = new Camera(
            initialTopLeft,
            this.config.get().scale,
            this.config.get().minScale,
            this.config.get().maxScale,
            this.viewport
        );

        this.coordinateTransformer = new CoordinateTransformer(this.camera);

        // Initialize animation controller
        this.animationController = new AnimationController(this.camera, this.viewport, () => this.handleCameraChange());

        this.renderer = this.createRenderer(rendererType);

        this.images = new ImageLoader();

        this.events = new EventManager(
            this.canvasWrapper,
            this.canvas,
            this.camera,
            this.viewport,
            this.config,
            this.coordinateTransformer,
            () => this.handleCameraChange()
        );
        this.sizeController = new SizeController(
            this.canvasWrapper,
            this.canvas,
            this.camera,
            this.renderer,
            this.viewport,
            this.config,
            () => this.handleCameraChange()
        );
        this.events.setupEvents();

        // Apply initial bounds if provided
        if (config.bounds) {
            this.camera.setBounds(config.bounds);
        }
    }

    // ─── PUBLIC API ──────────────────────────────

    /** Tear down listeners and observers. */
    destroy() {
        this.events.destroy();
        this.animationController.cancelAll();
        this.draw?.destroy();
        this.layers?.clear();
        this.images.clear();
        this.renderer.destroy();
    }

    /** Render a frame using the active renderer. */
    render() {
        this.renderer.render();
    }

    /**
     * Manually update canvas size (e.g., user-driven select). Keeps view centered.
     * @param width New canvas width in pixels.
     * @param height New canvas height in pixels.
     * @param durationMs Animation duration in ms (default 500). Use 0 for instant resize.
     * @param onComplete Optional callback fired when resize animation completes.
     */
    resize(width: number, height: number, durationMs: number = 500, onComplete?: () => void) {
        this.sizeController.resizeWithAnimation(width, height, durationMs, this.animationController, () => {
            // Trigger onResize callback after programmatic resize completes
            this._onResize?.();
            onComplete?.();
        });
    }

    /**
     * Current canvas size.
     * @returns Current `{ width, height }` in pixels.
     */
    getSize() {
        return this.viewport.getSize();
    }

    /**
     * Current canvas scale.
     * @returns Current canvas scale.
     */
    getScale() {
        return this.camera.scale;
    }

    /**
     * Zoom in by a given factor, centered on the viewport.
     * @param factor Zoom multiplier (default: 1.5). Higher values zoom in more.
     */
    zoomIn(factor: number = 1.5) {
        const size = this.viewport.getSize();
        this.camera.zoomByFactor(factor, size.width / 2, size.height / 2);
        this.handleCameraChange();
    }

    /**
     * Zoom out by a given factor, centered on the viewport.
     * @param factor Zoom multiplier (default: 1.5). Higher values zoom out more.
     */
    zoomOut(factor: number = 1.5) {
        const size = this.viewport.getSize();
        this.camera.zoomByFactor(1 / factor, size.width / 2, size.height / 2);
        this.handleCameraChange();
    }

    /** Snapshot of current normalized config. */
    getConfig(): Required<CanvasTileEngineConfig> {
        const base = this.config.get();
        const size = this.viewport.getSize();
        return {
            ...base,
            scale: this.camera.scale,
            size: { ...size },
        };
    }

    /** Center coordinates of the map. */
    getCenterCoords(): Coords {
        const size = this.viewport.getSize();
        return this.camera.getCenter(size.width, size.height);
    }

    /** Set center coordinates from outside (adjusts the camera accordingly). */
    updateCoords(newCenter: Coords) {
        const size = this.viewport.getSize();
        this.camera.setCenter(newCenter, size.width, size.height);
        this.handleCameraChange();
    }

    /**
     * Smoothly move the camera center to target coordinates over the given duration.
     * @param x Target world x.
     * @param y Target world y.
     * @param durationMs Animation duration in milliseconds (default: 500ms). Set to 0 for instant move.
     * @param onComplete Optional callback fired when animation completes.
     */
    goCoords(x: number, y: number, durationMs: number = 500, onComplete?: () => void) {
        this.animationController.animateMoveTo(x, y, durationMs, onComplete);
    }

    /**
     * Update event handlers at runtime.
     * This allows you to enable or disable specific interactions dynamically.
     * @param handlers Partial event handlers to update.
     * @example
     * ```ts
     * // Disable drag temporarily
     * engine.setEventHandlers({ drag: false });
     *
     * // Enable painting mode
     * engine.setEventHandlers({ drag: false, hover: true });
     *
     * // Re-enable drag
     * engine.setEventHandlers({ drag: true });
     * ```
     */
    setEventHandlers(handlers: Partial<EventHandlers>) {
        this.config.updateEventHandlers(handlers);
    }

    /**
     * Set or update map boundaries to restrict camera movement.
     * @param bounds Boundary limits. Use Infinity/-Infinity to remove limits.
     * @example
     * ```ts
     * // Restrict map to -100 to 100 on both axes
     * engine.setBounds({ minX: -100, maxX: 100, minY: -100, maxY: 100 });
     *
     * // Remove boundaries
     * engine.setBounds({ minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity });
     *
     * // Only limit X axis
     * engine.setBounds({ minX: 0, maxX: 500, minY: -Infinity, maxY: Infinity });
     * ```
     */
    setBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
        this.config.updateBounds(bounds);
        this.camera.setBounds(bounds);
        this.render();
    }

    // ─── Draw helpers (canvas renderer only) ───────────

    /**
     * Register a generic draw callback (canvas renderer only).
     * @param fn Callback invoked with context, top-left coords, and config.
     * @param layer Layer order (lower draws first).
     */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer: number = 1
    ): LayerHandle {
        return this.ensureCanvasDraw().addDrawFunction(fn, layer);
    }

    /**
     * Draw one or many rectangles in world space (canvas renderer only).
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Rectangle definitions.
     * @param layer Layer order (lower draws first).
     */
    drawRect(items: DrawObject | Array<DrawObject>, layer: number = 1): LayerHandle {
        return this.ensureCanvasDraw().drawRect(items, layer);
    }

    /**
     * Draw rectangles with pre-rendering cache (canvas renderer only).
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like mini-maps where items don't change.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Array of rectangle definitions.
     * @param cacheKey Unique key for this cache (e.g., "minimap-items").
     * @param layer Layer order (lower draws first).
     */
    drawStaticRect(items: Array<DrawObject>, cacheKey: string, layer: number = 1): LayerHandle {
        return this.ensureCanvasDraw().drawStaticRect(items, cacheKey, layer);
    }

    /**
     * Draw circles with pre-rendering cache (canvas renderer only).
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like mini-maps where items don't change.
     * @param items Array of circle definitions.
     * @param cacheKey Unique key for this cache (e.g., "minimap-circles").
     * @param layer Layer order (lower draws first).
     */
    drawStaticCircle(items: Array<DrawObject>, cacheKey: string, layer: number = 1): LayerHandle {
        return this.ensureCanvasDraw().drawStaticCircle(items, cacheKey, layer);
    }

    /**
     * Draw images with pre-rendering cache (canvas renderer only).
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like terrain tiles or static decorations.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Array of image definitions with HTMLImageElement.
     * @param cacheKey Unique key for this cache (e.g., "terrain-cache").
     * @param layer Layer order (lower draws first).
     */
    drawStaticImage(
        items: Array<Omit<DrawObject, "style"> & { img: HTMLImageElement }>,
        cacheKey: string,
        layer: number = 1
    ): LayerHandle {
        return this.ensureCanvasDraw().drawStaticImage(items, cacheKey, layer);
    }

    /**
     * Clear a static rendering cache.
     * @param cacheKey The cache key to clear, or undefined to clear all caches.
     */
    clearStaticCache(cacheKey?: string) {
        this.ensureCanvasDraw().clearStaticCache(cacheKey);
    }

    /**
     * Draw one or many lines between world points (canvas renderer only).
     * @param items Line segments.
     * @param style Line style overrides.
     * @param layer Layer order.
     */
    drawLine(
        items: Array<{ from: Coords; to: Coords }> | { from: Coords; to: Coords },
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): LayerHandle {
        return this.ensureCanvasDraw().drawLine(items, style, layer);
    }

    /**
     * Draw one or many circles sized in world units (canvas renderer only).
     * @param items Circle definitions.
     * @param layer Layer order.
     */
    drawCircle(items: DrawObject | Array<DrawObject>, layer: number = 1): LayerHandle {
        return this.ensureCanvasDraw().drawCircle(items, layer);
    }

    /**
     * Draw one or many texts at world positions (canvas renderer only).
     * @param items Text definitions.
     * @param style Text style overrides.
     * @param layer Layer order.
     */
    drawText(
        items: Array<{ coords: Coords; text: string }> | { coords: Coords; text: string },
        style?: { fillStyle?: string; font?: string; textAlign?: CanvasTextAlign; textBaseline?: CanvasTextBaseline },
        layer: number = 2
    ): LayerHandle {
        return this.ensureCanvasDraw().drawText(items, style, layer);
    }

    /**
     * Draw one or many polylines through world points (canvas renderer only).
     * @param items Polyline point collections.
     * @param style Stroke style overrides.
     * @param layer Layer order.
     */
    drawPath(
        items: Array<Coords[]> | Coords[],
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): LayerHandle {
        return this.ensureCanvasDraw().drawPath(items, style, layer);
    }

    /**
     * Draw one or many images scaled in world units (canvas renderer only).
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Image definitions.
     * @param layer Layer order.
     */
    drawImage(
        items:
            | Array<Omit<DrawObject, "style"> & { img: HTMLImageElement }>
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement }),
        layer: number = 1
    ): LayerHandle {
        return this.ensureCanvasDraw().drawImage(items, layer);
    }

    /**
     *  Draw grid lines at specified cell size (canvas renderer only).
     * @param cellSize Size of each grid cell in world units.
     * @example
     * ```ts
     * engine.drawGridLines(50);
     * ```
     */
    drawGridLines(
        cellSize: number,
        lineWidth: number = 1,
        strokeStyle: string = "black",
        layer: number = 0
    ): LayerHandle {
        return this.ensureCanvasDraw().drawGridLines(cellSize, { lineWidth, strokeStyle }, layer);
    }

    /**
     * Remove a specific draw callback by handle (canvas renderer only).
     * Does not clear other callbacks on the same layer.
     */
    removeLayerHandle(handle: LayerHandle) {
        if (!this.layers) {
            throw new Error("removeLayerHandle is only available when renderer is set to 'canvas'.");
        }
        this.layers.remove(handle);
    }

    /**
     * Clear all draw callbacks from a specific layer (canvas renderer only).
     * Use this before redrawing dynamic content to prevent accumulation.
     * @param layer Layer index to clear.
     * @example
     * ```ts
     * engine.clearLayer(1);
     * engine.drawRect(newRects, 1);
     * engine.render();
     * ```
     */
    clearLayer(layer: number) {
        if (!this.layers) {
            throw new Error("clearLayer is only available when renderer is set to 'canvas'.");
        }
        this.layers.clear(layer);
    }

    /**
     * Clear all draw callbacks from all layers (canvas renderer only).
     * Useful for complete scene reset.
     * @example
     * ```ts
     * engine.clearAll();
     * // Redraw everything from scratch
     * ```
     */
    clearAll() {
        if (!this.layers) {
            throw new Error("clearAll is only available when renderer is set to 'canvas'.");
        }
        this.layers.clear();
    }

    /**
     * Build the active renderer based on config.
     * @param type Renderer type requested.
     */
    private createRenderer(type: CanvasTileEngineConfig["renderer"]): IRenderer {
        // Initialize layers and draw helpers for canvas renderer
        if (type === "canvas") {
            this.layers = new Layer();
            this.draw = new CanvasDraw(this.layers, this.coordinateTransformer, this.camera);
        }

        return RendererFactory.createRenderer(
            type ?? "canvas",
            this.canvas,
            this.camera,
            this.coordinateTransformer,
            this.config,
            this.viewport,
            this.layers!
        );
    }

    private ensureCanvasDraw(): CanvasDraw {
        if (!this.draw) {
            throw new Error("Draw helpers are only available when renderer is set to 'canvas'.");
        }
        return this.draw;
    }

    private getCanvasRenderer(): CanvasRenderer {
        if (!(this.renderer instanceof CanvasRenderer)) {
            throw new Error("Canvas renderer required for this operation.");
        }
        return this.renderer;
    }

    // ─── Internal ───────────────────────────────

    private handleCameraChange() {
        if (this.onCoordsChange) {
            this.onCoordsChange(this.getCenterCoords());
        }
        this.render();
    }
}
