import { Camera } from "./modules/Camera";
import { Config } from "./modules/Config";
import { CoordinateTransformer } from "./modules/CoordinateTransformer";
import { ViewportState } from "./modules/ViewportState";
import { AnimationController } from "./modules/AnimationController";
import { HitTester, HitResult, HitTestOptions } from "./modules/HitTester";
import { DEFAULT_VALUES } from "./constants";
import { validateCoords, validateScale } from "./utils/validateConfig";
import { snapCenterToGrid } from "./utils/viewport";
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
    DrawTransform,
} from "./types";

/**
 * Core engine wiring camera, config, renderer, events, and draw helpers.
 */
export class CanvasTileEngine<TMount = HTMLDivElement, TImage = HTMLImageElement> {
    private config: Config;
    private camera: Camera;
    private viewport: ViewportState;
    private coordinateTransformer: CoordinateTransformer;
    private renderer: IRenderer<TMount, TImage>;
    private animationController: AnimationController;
    private hitTester = new HitTester();

    public canvasWrapper: TMount;
    /**
     * The DOM canvas element, when the mount target is a DOM wrapper.
     * On non-DOM mounts (e.g. React Native / Skia) this is `undefined` at
     * runtime, and the type reflects that so consumers must null-check.
     */
    public canvas: TMount extends HTMLElement ? HTMLCanvasElement : HTMLCanvasElement | undefined;

    /**
     * Image loader for loading and caching images.
     * Uses the renderer's platform-specific implementation.
     */
    public get images(): IImageLoader<TImage> {
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
     * Callback after each draw frame, on top of all layers. Same signature as
     * `addDrawFunction` callbacks: platform context, top-left world coords,
     * live config, and coordinate transform helpers.
     * @example
     * ```ts
     * engine.onDraw = (ctx, coords, config, transform) => {
     *     const c = ctx as CanvasRenderingContext2D;
     *     c.fillStyle = "red";
     *     c.fillText(`Scale: ${config.scale}`, 10, 20);
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
        canvasWrapper: TMount,
        config: CanvasTileEngineConfig,
        renderer: IRenderer<TMount, TImage>,
        center: Coords = { x: 0, y: 0 },
    ) {
        this.canvasWrapper = canvasWrapper;
        // Resolve the DOM canvas only when the mount target is a DOM element.
        // Non-DOM platforms (e.g. React Native) leave this undefined.
        const maybeDom = canvasWrapper as { querySelector?: (selector: string) => HTMLCanvasElement | null };
        const resolvedCanvas =
            typeof maybeDom?.querySelector === "function" ? (maybeDom.querySelector("canvas") ?? undefined) : undefined;
        this.canvas = resolvedCanvas as this["canvas"];

        this.config = new Config(config);

        const tilesX = config.size.width / config.scale;
        const tilesY = config.size.height / config.scale;
        const alignedXCenter = config.gridAligned ? snapCenterToGrid(center.x, tilesX) : center.x;
        const alignedYCenter = config.gridAligned ? snapCenterToGrid(center.y, tilesY) : center.y;

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
            this.viewport,
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
        this.hitTester.clear();
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
                    "Canvas size is controlled by the wrapper element.",
            );
            return;
        }
        // onResize is not fired here: the setter mirrors it into the renderer,
        // whose resizeWithAnimation completion already invokes it once before
        // this onComplete runs.
        this.renderer.resizeWithAnimation(width, height, durationMs, onComplete);
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
        const prevScale = this.camera.scale;
        this.camera.setScale(newScale);
        this.notifyZoomIfChanged(prevScale);
        this.handleCameraChange();
    }

    /**
     * Smoothly animate the canvas scale to a target value over the given duration.
     * The zoom is anchored at the viewport center, matching zoomIn/zoomOut.
     * @param targetScale The desired scale value, clamped to min/max bounds.
     * @param durationMs Animation duration in milliseconds (default: 500ms). Set to 0 for instant change.
     * @param onComplete Optional callback fired when animation completes.
     * @throws {ConfigValidationError} If scale is not a positive finite number.
     */
    goScale(targetScale: number, durationMs: number = 500, onComplete?: () => void) {
        validateScale(targetScale);
        // Pre-clamp so the animation runs toward the effective value instead
        // of saturating at the limit partway through the duration.
        const clamped = Math.min(this.camera.maxScale, Math.max(this.camera.minScale, targetScale));
        this.animationController.animateZoomTo(
            clamped,
            durationMs,
            (prevScale) => this.notifyZoomIfChanged(prevScale),
            onComplete,
        );
    }

    /**
     * Zoom in by a given factor, centered on the viewport.
     * @param factor Zoom multiplier (default: 1.5). Higher values zoom in more.
     */
    zoomIn(factor: number = 1.5) {
        const size = this.viewport.getSize();
        const prevScale = this.camera.scale;
        this.camera.zoomByFactor(factor, size.width / 2, size.height / 2);
        this.notifyZoomIfChanged(prevScale);
        this.handleCameraChange();
    }

    /**
     * Zoom out by a given factor, centered on the viewport.
     * @param factor Zoom multiplier (default: 1.5). Higher values zoom out more.
     */
    zoomOut(factor: number = 1.5) {
        const size = this.viewport.getSize();
        const prevScale = this.camera.scale;
        this.camera.zoomByFactor(1 / factor, size.width / 2, size.height / 2);
        this.notifyZoomIfChanged(prevScale);
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
        // setBounds may clamp the camera position, so notify like the other
        // camera-mutating APIs (also renders).
        this.handleCameraChange();
    }

    // ─── Draw helpers ───────────

    /**
     * Draw one or many rectangles in world space.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Rectangle definitions.
     * @param layer Layer order (lower draws first).
     */
    drawRect(items: Rect | Array<Rect>, layer: number = 1): DrawHandle {
        const handle = this.renderer.getDrawAPI().drawRect(items, layer);
        this.hitTester.register(handle, "rect", items, layer);
        return handle;
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
        const handle = this.renderer.getDrawAPI().drawStaticRect(items, cacheKey, layer);
        this.hitTester.register(handle, "rect", items, layer);
        return handle;
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
        const handle = this.renderer.getDrawAPI().drawStaticCircle(items, cacheKey, layer);
        this.hitTester.register(handle, "circle", items, layer);
        return handle;
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
    drawStaticImage(items: Array<ImageItem<TImage>>, cacheKey: string, layer: number = 1): DrawHandle {
        const handle = this.renderer.getDrawAPI().drawStaticImage(items, cacheKey, layer);
        this.hitTester.register(handle, "image", items, layer);
        return handle;
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
        layer: number = 1,
    ): DrawHandle {
        return this.renderer.getDrawAPI().drawLine(items, style, layer);
    }

    /**
     * Draw one or many circles sized in world units.
     * @param items Circle definitions.
     * @param layer Layer order.
     */
    drawCircle(items: Circle | Array<Circle>, layer: number = 1): DrawHandle {
        const handle = this.renderer.getDrawAPI().drawCircle(items, layer);
        this.hitTester.register(handle, "circle", items, layer);
        return handle;
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
     *     size: 1, // 1 tile height, scales with zoom
     *     style: { fillStyle: "black", fontFamily: "Arial" }
     * });
     *
     * // Fixed-size label: always 14px on screen, regardless of zoom
     * engine.drawText({ x: 0, y: 0, text: "Ankara", fontPx: 14 });
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
        layer: number = 1,
    ): DrawHandle {
        return this.renderer.getDrawAPI().drawPath(items, style, layer);
    }

    /**
     * Draw one or many images scaled in world units.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Image definitions.
     * @param layer Layer order.
     */
    drawImage(items: Array<ImageItem<TImage>> | ImageItem<TImage>, layer: number = 1): DrawHandle {
        const handle = this.renderer.getDrawAPI().drawImage(items, layer);
        this.hitTester.register(handle, "image", items, layer);
        return handle;
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
        layer: number = 0,
    ): DrawHandle {
        return this.renderer.getDrawAPI().drawGridLines(cellSize, { lineWidth, strokeStyle }, layer);
    }

    /**
     * Register a custom draw function for complete rendering control.
     * Useful for complex or one-off drawing operations.
     * @param fn Function receiving canvas context, top-left coords, config, and
     * a `transform` helper — use `transform.worldToScreen(x, y)` to position
     * drawing at world coordinates instead of deriving the pixel math by hand.
     * @param layer Layer index (default 1).
     * @returns DrawHandle for removal.
     * @example
     * ```ts
     * engine.addDrawFunction((ctx, coords, config, transform) => {
     *     const c = ctx as CanvasRenderingContext2D;
     *     const p = transform.worldToScreen(5, 3); // center of cell (5, 3)
     *     c.fillStyle = "red";
     *     c.fillRect(p.x - 4, p.y - 4, 8, 8);
     * }, 4);
     * ```
     */
    addDrawFunction(
        fn: (ctx: unknown, coords: Coords, config: Required<CanvasTileEngineConfig>, transform: DrawTransform) => void,
        layer: number = 1,
    ): DrawHandle {
        return this.renderer.getDrawAPI().addDrawFunction(fn, layer);
    }

    /**
     * Remove a specific draw callback by handle.
     * Does not clear other callbacks on the same layer.
     */
    removeDrawHandle(handle: DrawHandle) {
        this.renderer.getDrawAPI().removeDrawHandle(handle);
        this.hitTester.remove(handle);
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
        this.hitTester.clearLayer(layer);
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
        this.hitTester.clear();
    }

    // ─── Hit testing ───────────

    /**
     * All rect/circle/image items under a world point, highest visual
     * priority first (higher layer, then later registration, then later
     * item within a draw call). Pass the `coords.raw` value from event
     * callbacks - origin anchoring, image aspect fit, and rotation are
     * handled internally.
     *
     * Line, Path, and Text items are not hit-testable. Like rendering,
     * results reflect item positions as of the draw call: mutating an
     * item's position requires re-registration (style mutation is fine).
     *
     * `padding` (world units) and `paddingPx` (screen pixels, zoom
     * independent) expand every item's hit geometry outward - generous
     * touch targets around small markers without invisible helper items.
     *
     * `TData` types the `data` field of returned items — it is an assertion,
     * not checked at runtime, so only pass it when every hit-testable item
     * carries that data shape (or narrow per hit).
     * @param point World coordinates (e.g. `coords.raw` from onClick/onHover).
     * @param opts Optional filters, e.g. `{ layer: 2, padding: 0.5 }`.
     * @example
     * ```ts
     * engine.onClick = (coords) => {
     *     // Accept clicks up to 0.6 world units around each station dot
     *     const hit = engine.hitTestFirst<Station>(coords.raw, { padding: 0.6 });
     *     if (hit?.item.data) openPanel(hit.item.data);
     * };
     * ```
     */
    hitTest<TData = unknown>(point: Coords, opts?: HitTestOptions): HitResult<TImage, TData>[] {
        return this.hitTester.hitTest<TData>(this.rawToItemSpace(point), this.resolveHitOptions(opts)) as HitResult<
            TImage,
            TData
        >[];
    }

    /**
     * The topmost item under a world point, or `undefined`.
     * See {@link hitTest} for semantics.
     */
    hitTestFirst<TData = unknown>(point: Coords, opts?: HitTestOptions): HitResult<TImage, TData> | undefined {
        return this.hitTester.hitTestFirst<TData>(this.rawToItemSpace(point), this.resolveHitOptions(opts)) as
            | HitResult<TImage, TData>
            | undefined;
    }

    /**
     * Fold `paddingPx` into the world-unit `padding` using the current scale;
     * the HitTester itself is scale-unaware.
     */
    private resolveHitOptions(opts?: HitTestOptions): HitTestOptions | undefined {
        if (!opts || opts.paddingPx === undefined) return opts;
        const { paddingPx, ...rest } = opts;
        return {
            ...rest,
            padding: Math.max(0, rest.padding ?? 0) + Math.max(0, paddingPx) / this.camera.scale,
        };
    }

    /**
     * Event payloads report `coords.raw` in corner space (the cell of item
     * `k` spans `[k, k+1]` there, which is why `snapped` floors it), while
     * item coordinates are cell centers. Shift by the cell-center offset so
     * hit geometry can work in item space.
     */
    private rawToItemSpace(point: Coords): Coords {
        return {
            x: point.x - DEFAULT_VALUES.CELL_CENTER_OFFSET,
            y: point.y - DEFAULT_VALUES.CELL_CENTER_OFFSET,
        };
    }

    // ─── Internal ───────────────────────────────

    /**
     * Fire onZoom for programmatic zoom changes (setScale/zoomIn/zoomOut),
     * matching the wheel/pinch paths which notify via the GestureProcessor.
     * Skipped when clamping left the scale unchanged.
     */
    private notifyZoomIfChanged(prevScale: number) {
        if (this.camera.scale !== prevScale) {
            this._onZoom?.(this.camera.scale);
        }
    }

    private handleCameraChange() {
        if (this.onCoordsChange) {
            this.onCoordsChange(this.getCenterCoords());
        }
        this.render();
    }
}
