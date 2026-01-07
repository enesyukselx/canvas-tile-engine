import { Camera } from "./modules/Camera";
import { Config } from "./modules/Config";
import { CoordinateTransformer } from "./modules/CoordinateTransformer";
import { ViewportState } from "./modules/ViewportState";
import { AnimationController } from "./modules/AnimationController";
import { validateCoords, validateScale } from "./utils/validateConfig";
import {
    Coords,
    CanvasTileEngineConfig,
    onClickCallback,
    onRightClickCallback,
    onDrawCallback,
    onHoverCallback,
    EventHandlers,
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
    Circle,
    ImageItem,
    Text,
    Rect,
    Line,
    Path,
    IRenderer,
    IImageLoader,
    DrawHandle,
} from "./types";

/**
 * Core engine wiring camera, config, renderer, events, and draw helpers.
 */
export class CanvasTileEngine {
    private config: Config;
    private camera: Camera;
    private viewport: ViewportState;
    private coordinateTransformer: CoordinateTransformer;
    private renderer: IRenderer;
    private animationController: AnimationController;

    public canvasWrapper: HTMLDivElement;
    public canvas: HTMLCanvasElement;

    /**
     * Image loader for loading and caching images.
     * Uses the renderer's platform-specific implementation.
     */
    public get images(): IImageLoader {
        return this.renderer.getImageLoader();
    }

    /**
     * Callback when center coordinates change (pan or zoom).
     * @param coords - Center world coordinates: `{ x, y }`
     * @example
     * ```ts
     * engine.onCoordsChange = (coords) => {
     *     console.log(`Center: ${coords.x}, ${coords.y}`);
     * };
     * ```
     */
    public onCoordsChange?: (coords: Coords) => void;

    private _onClick?: onClickCallback;

    /**
     * Callback when a tile is clicked (mouse or touch tap).
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```ts
     * engine.onClick = (coords, mouse, client) => {
     *     console.log(`Clicked tile: ${coords.snapped.x}, ${coords.snapped.y}`);
     * };
     * ```
     */
    public get onClick(): onClickCallback | undefined {
        return this._onClick;
    }
    public set onClick(cb: onClickCallback | undefined) {
        this._onClick = cb;
        this.renderer.onClick = cb;
    }

    private _onRightClick?: onRightClickCallback;

    /**
     * Callback when a tile is right-clicked.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```ts
     * engine.onRightClick = (coords) => {
     *     showContextMenu(coords.snapped.x, coords.snapped.y);
     * };
     * ```
     */
    public get onRightClick(): onRightClickCallback | undefined {
        return this._onRightClick;
    }
    public set onRightClick(cb: onRightClickCallback | undefined) {
        this._onRightClick = cb;
        this.renderer.onRightClick = cb;
    }

    private _onHover?: onHoverCallback;

    /**
     * Callback when hovering over tiles.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```ts
     * engine.onHover = (coords) => {
     *     setHoveredTile({ x: coords.snapped.x, y: coords.snapped.y });
     * };
     * ```
     */
    public get onHover(): onHoverCallback | undefined {
        return this._onHover;
    }
    public set onHover(cb: onHoverCallback | undefined) {
        this._onHover = cb;
        this.renderer.onHover = cb;
    }

    private _onMouseDown?: onMouseDownCallback;

    /**
     * Callback on mouse/touch down.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```ts
     * engine.onMouseDown = (coords) => {
     *     startPainting(coords.snapped.x, coords.snapped.y);
     * };
     * ```
     */
    public get onMouseDown(): onMouseDownCallback | undefined {
        return this._onMouseDown;
    }
    public set onMouseDown(cb: onMouseDownCallback | undefined) {
        this._onMouseDown = cb;
        this.renderer.onMouseDown = cb;
    }

    private _onMouseUp?: onMouseUpCallback;

    /**
     * Callback on mouse/touch up.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```ts
     * engine.onMouseUp = (coords) => {
     *     stopPainting();
     * };
     * ```
     */
    public get onMouseUp(): onMouseUpCallback | undefined {
        return this._onMouseUp;
    }
    public set onMouseUp(cb: onMouseUpCallback | undefined) {
        this._onMouseUp = cb;
        this.renderer.onMouseUp = cb;
    }

    private _onMouseLeave?: onMouseLeaveCallback;

    /**
     * Callback when mouse/touch leaves the canvas.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```ts
     * engine.onMouseLeave = () => {
     *     clearHoveredTile();
     * };
     * ```
     */
    public get onMouseLeave(): onMouseLeaveCallback | undefined {
        return this._onMouseLeave;
    }
    public set onMouseLeave(cb: onMouseLeaveCallback | undefined) {
        this._onMouseLeave = cb;
        this.renderer.onMouseLeave = cb;
    }

    private _onDraw?: onDrawCallback;

    /**
     * Callback after each draw frame. Use for custom canvas drawing.
     * @param ctx - The canvas 2D rendering context
     * @param info - Frame info: `scale`, `width`, `height`, `coords` (center)
     * @example
     * ```ts
     * engine.onDraw = (ctx, info) => {
     *     ctx.fillStyle = "red";
     *     ctx.fillText(`Scale: ${info.scale}`, 10, 20);
     * };
     * ```
     */
    public get onDraw(): onDrawCallback | undefined {
        return this._onDraw;
    }
    public set onDraw(cb: onDrawCallback | undefined) {
        this._onDraw = cb;
        this.renderer.onDraw = cb;
    }

    private _onResize?: () => void;

    /**
     * Callback on canvas resize.
     * @example
     * ```ts
     * engine.onResize = () => {
     *     console.log("Canvas resized:", engine.getSize());
     * };
     * ```
     */
    public get onResize(): (() => void) | undefined {
        return this._onResize;
    }
    public set onResize(cb: (() => void) | undefined) {
        this._onResize = cb;
        this.renderer.onResize = cb;
    }

    private _onZoom?: (scale: number) => void;

    /**
     * Callback when zoom level changes (wheel or pinch).
     * @param scale - The new scale value
     * @example
     * ```ts
     * engine.onZoom = (scale) => {
     *     console.log(`Zoom level: ${scale}`);
     * };
     * ```
     */
    public get onZoom(): ((scale: number) => void) | undefined {
        return this._onZoom;
    }
    public set onZoom(cb: ((scale: number) => void) | undefined) {
        this._onZoom = cb;
        this.renderer.onZoom = cb;
    }

    /**
     * @param canvasWrapper Canvas wrapper element containing a canvas child.
     * @param config Initial engine configuration.
     * @param renderer The renderer implementation to use (e.g., RendererCanvas).
     * @param center Initial center in world space.
     */
    constructor(
        canvasWrapper: HTMLDivElement,
        config: CanvasTileEngineConfig,
        renderer: IRenderer,
        center: Coords = { x: 0, y: 0 }
    ) {
        this.canvasWrapper = canvasWrapper;
        this.canvas = canvasWrapper.querySelector("canvas")!;

        this.config = new Config(config);

        const tilesX = config.size.width / config.scale;
        const tilesY = config.size.height / config.scale;
        const alignedXCenter = config.gridAligned && tilesX % 2 === 0 ? Math.floor(center.x) + 0.5 : center.x;
        const alignedYCenter = config.gridAligned && tilesY % 2 === 0 ? Math.floor(center.y) + 0.5 : center.y;

        const initialTopLeft: Coords = {
            x: alignedXCenter - config.size.width / (2 * config.scale),
            y: alignedYCenter - config.size.height / (2 * config.scale),
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

        // Initialize renderer with dependencies
        this.renderer = renderer;
        this.renderer.init({
            wrapper: this.canvasWrapper,
            camera: this.camera,
            viewport: this.viewport,
            config: this.config,
            transformer: this.coordinateTransformer,
        });

        // Connect camera change callback from renderer to engine
        this.renderer.onCameraChange = () => this.handleCameraChange();

        // Setup event handling (includes resize/responsive watchers)
        this.renderer.setupEvents();

        // Apply initial bounds if provided
        if (config.bounds) {
            this.camera.setBounds(config.bounds);
        }
    }

    // ─── PUBLIC API ──────────────────────────────

    /** Tear down listeners and observers. */
    destroy() {
        this.animationController.cancelAll();
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
        if (this.config.get().responsive) {
            console.warn(
                "Canvas Tile Engine: resize() is disabled when responsive mode is enabled. " +
                    "Canvas size is controlled by the wrapper element."
            );
            return;
        }
        this.renderer.resizeWithAnimation(width, height, durationMs, () => {
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
     * Set the canvas scale directly, clamped to min/max bounds.
     * @param newScale The desired scale value.
     * @throws {ConfigValidationError} If scale is not a positive finite number.
     */
    setScale(newScale: number) {
        validateScale(newScale);
        this.camera.setScale(newScale);
        this.handleCameraChange();
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

    /**
     * Get the visible world coordinate bounds of the viewport.
     * Returns floored/ceiled values representing which cells are visible.
     * @returns Visible bounds with min/max coordinates.
     * @example
     * ```ts
     * const bounds = engine.getVisibleBounds();
     * // { minX: 0, maxX: 10, minY: 0, maxY: 10 }
     *
     * // Use for random placement within visible area
     * const x = bounds.minX + Math.floor(Math.random() * (bounds.maxX - bounds.minX));
     * ```
     */
    getVisibleBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
        const size = this.viewport.getSize();
        return this.camera.getVisibleBounds(size.width, size.height);
    }

    /**
     * Set center coordinates from outside (adjusts the camera accordingly).
     * @param newCenter The new center coordinates.
     * @throws {ConfigValidationError} If coordinates are not finite numbers.
     */
    updateCoords(newCenter: Coords) {
        validateCoords(newCenter.x, newCenter.y);
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
     * @throws {ConfigValidationError} If coordinates are not finite numbers.
     */
    goCoords(x: number, y: number, durationMs: number = 500, onComplete?: () => void) {
        validateCoords(x, y);
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

    // ─── Draw helpers ───────────

    /**
     * Draw one or many rectangles in world space.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Rectangle definitions.
     * @param layer Layer order (lower draws first).
     */
    drawRect(items: Rect | Array<Rect>, layer: number = 1): DrawHandle {
        return this.renderer.getDrawAPI().drawRect(items, layer);
    }

    /**
     * Draw rectangles with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like mini-maps where items don't change.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Array of rectangle definitions.
     * @param cacheKey Unique key for this cache (e.g., "minimap-items").
     * @param layer Layer order (lower draws first).
     */
    drawStaticRect(items: Array<Rect>, cacheKey: string, layer: number = 1): DrawHandle {
        return this.renderer.getDrawAPI().drawStaticRect(items, cacheKey, layer);
    }

    /**
     * Draw circles with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like mini-maps where items don't change.
     * @param items Array of circle definitions.
     * @param cacheKey Unique key for this cache (e.g., "minimap-circles").
     * @param layer Layer order (lower draws first).
     */
    drawStaticCircle(items: Array<Circle>, cacheKey: string, layer: number = 1): DrawHandle {
        return this.renderer.getDrawAPI().drawStaticCircle(items, cacheKey, layer);
    }

    /**
     * Draw images with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like terrain tiles or static decorations.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Array of image definitions with HTMLImageElement.
     * @param cacheKey Unique key for this cache (e.g., "terrain-cache").
     * @param layer Layer order (lower draws first).
     */
    drawStaticImage(items: Array<ImageItem>, cacheKey: string, layer: number = 1): DrawHandle {
        return this.renderer.getDrawAPI().drawStaticImage(items, cacheKey, layer);
    }

    /**
     * Clear a static rendering cache.
     * @param cacheKey The cache key to clear, or undefined to clear all caches.
     */
    clearStaticCache(cacheKey?: string) {
        this.renderer.getDrawAPI().clearStaticCache(cacheKey);
    }

    /**
     * Draw one or many lines between world points.
     * @param items Line segments.
     * @param style Line style overrides.
     * @param layer Layer order.
     */
    drawLine(
        items: Array<Line> | Line,
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): DrawHandle {
        return this.renderer.getDrawAPI().drawLine(items, style, layer);
    }

    /**
     * Draw one or many circles sized in world units.
     * @param items Circle definitions.
     * @param layer Layer order.
     */
    drawCircle(items: Circle | Array<Circle>, layer: number = 1): DrawHandle {
        return this.renderer.getDrawAPI().drawCircle(items, layer);
    }

    /**
     * Draw one or many texts at world positions.
     * @param items Text definitions with position, text, size, and style.
     * @param layer Layer order.
     * @example
     * ```ts
     * engine.drawText({
     *     x: 0,
     *     y: 0,
     *     text: "Hello",
     *     size: 1, // 1 tile height
     *     style: { fillStyle: "black", fontFamily: "Arial" }
     * });
     *
     * // Multiple texts
     * engine.drawText([
     *     { x: 0, y: 0, text: "A", size: 2 },
     *     { x: 1, y: 0, text: "B", size: 2 }
     * ]);
     * ```
     */
    drawText(items: Array<Text> | Text, layer: number = 2): DrawHandle {
        return this.renderer.getDrawAPI().drawText(items, layer);
    }

    /**
     * Draw one or many polylines through world points.
     * @param items Polyline point collections.
     * @param style Stroke style overrides.
     * @param layer Layer order.
     */
    drawPath(
        items: Array<Path> | Path,
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ): DrawHandle {
        return this.renderer.getDrawAPI().drawPath(items, style, layer);
    }

    /**
     * Draw one or many images scaled in world units.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Image definitions.
     * @param layer Layer order.
     */
    drawImage(items: Array<ImageItem> | ImageItem, layer: number = 1): DrawHandle {
        return this.renderer.getDrawAPI().drawImage(items, layer);
    }

    /**
     * Draw grid lines at specified cell size.
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
    ): DrawHandle {
        return this.renderer.getDrawAPI().drawGridLines(cellSize, { lineWidth, strokeStyle }, layer);
    }

    /**
     * Register a custom draw function for complete rendering control.
     * Useful for complex or one-off drawing operations.
     * @param fn Function receiving canvas context, top-left coords, and config.
     * @param layer Layer index (default 1).
     * @returns DrawHandle for removal.
     */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer: number = 1
    ): DrawHandle {
        return this.renderer.getDrawAPI().addDrawFunction(fn, layer);
    }

    /**
     * Remove a specific draw callback by handle.
     * Does not clear other callbacks on the same layer.
     */
    removeDrawHandle(handle: DrawHandle) {
        this.renderer.getDrawAPI().removeDrawHandle(handle);
    }

    /**
     * Clear all draw callbacks from a specific layer.
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
        this.renderer.getDrawAPI().clearLayer(layer);
    }

    /**
     * Clear all draw callbacks from all layers.
     * Useful for complete scene reset.
     * @example
     * ```ts
     * engine.clearAll();
     * // Redraw everything from scratch
     * ```
     */
    clearAll() {
        this.renderer.getDrawAPI().clearAll();
    }

    // ─── Internal ───────────────────────────────

    private handleCameraChange() {
        if (this.onCoordsChange) {
            this.onCoordsChange(this.getCenterCoords());
        }
        this.render();
    }
}
