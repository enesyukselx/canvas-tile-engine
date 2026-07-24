import { Camera } from "./modules/Camera";
import { Config } from "./modules/Config";
import { CoordinateTransformer } from "./modules/CoordinateTransformer";
import { ViewportState } from "./modules/ViewportState";
import { AnimationController } from "./modules/AnimationController";
import { HitTester, HitResult, HitTestOptions, HitTestRectOptions } from "./modules/HitTester";
import { DEFAULT_VALUES } from "./constants";
import { validateCoords, validateScale } from "./utils/validateConfig";
import { fitScale } from "./utils/fitScale";
import { snapCenterToGrid } from "./utils/viewport";
import {
    Bounds,
    Coords,
    CanvasTileEngineConfig,
    FitBoundsOptions,
    onClickCallback,
    onRightClickCallback,
    onDrawCallback,
    onHoverCallback,
    EventHandlers,
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
    onWheelCallback,
    Circle,
    ImageItem,
    Text,
    Rect,
    Line,
    LineStyle,
    PathItem,
    IRenderer,
    IImageLoader,
    DrawHandle,
    DrawOptions,
    DrawTransform,
    RectDrawOptions,
    CircleDrawOptions,
    TextDrawOptions,
    LineDrawOptions,
    PathDrawOptions,
    StyleOf,
    ShapeDecorationStyle,
    TextDecorationStyle,
    LineDecorationStyle,
    PathDecorationStyle,
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
    private hitTester = new HitTester(() => this.camera.scale);
    /** Registrations tracked by user-facing id (static draws: their cacheKey). */
    private drawIds = new Map<string, { handle: DrawHandle; cacheKey?: string }>();
    private drawIdByHandle = new Map<symbol, string>();

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

    private _onWheel?: onWheelCallback;

    /**
     * Callback for wheel (desktop) and pinch (touch) zoom gestures. Requires
     * `eventHandlers.zoom`; fires even when the scale is clamped at a limit.
     * Unlike `onZoom` (which reports the resulting scale, including
     * programmatic changes), this reports the input gesture itself with its
     * position. For pinch, the coordinates describe the pinch midpoint and
     * `deltaY` is the wheel delta that would produce the same zoom factor.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @param wheel - Gesture details: `deltaY` (negative = zoom in), `direction`, `source`
     * @example
     * ```ts
     * engine.onWheel = (coords, mouse, client, wheel) => {
     *     console.log(`${wheel.source} zoom ${wheel.direction} at`, coords.snapped);
     * };
     * ```
     */
    public get onWheel(): onWheelCallback | undefined {
        return this._onWheel;
    }
    public set onWheel(cb: onWheelCallback | undefined) {
        this._onWheel = cb;
        this.renderer.onWheel = cb;
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
        this.drawIds.clear();
        this.drawIdByHandle.clear();
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
     * The change is anchored at the viewport center, matching goScale/zoomIn/zoomOut.
     * @param newScale The desired scale value.
     * @throws {ConfigValidationError} If scale is not a positive finite number.
     */
    setScale(newScale: number) {
        validateScale(newScale);
        const prevScale = this.camera.scale;
        const size = this.viewport.getSize();
        // Restore the center after the scale change: camera.setScale alone
        // anchors at the top-left corner, which would drift the view.
        const center = this.camera.getCenter(size.width, size.height);
        this.camera.setScale(newScale);
        this.camera.setCenter(center, size.width, size.height);
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

    /**
     * Update the minimum and maximum scale limits at runtime.
     * The current scale is clamped into the new range immediately.
     * @param minScale New minimum scale.
     * @param maxScale New maximum scale.
     * @throws {ConfigValidationError} If limits are not positive finite numbers or minScale is greater than maxScale.
     * @example
     * ```ts
     * // Allow zooming between 0.25x and 8x
     * engine.setScaleLimits(0.25, 8);
     * ```
     */
    setScaleLimits(minScale: number, maxScale: number) {
        this.config.updateScaleLimits(minScale, maxScale);
        const prevScale = this.camera.scale;
        this.camera.setScaleLimits(minScale, maxScale);
        // Clamping into the new range may change the scale, so notify like
        // the other camera-mutating APIs (also renders).
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

    /**
     * Current center of the view in world coordinates.
     * @returns Center coordinates `{ x, y }`.
     */
    getCenter(): Coords {
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
     * Move the view center to new world coordinates instantly.
     * @param newCenter The new center coordinates.
     * @throws {ConfigValidationError} If coordinates are not finite numbers.
     */
    setCenter(newCenter: Coords) {
        validateCoords(newCenter.x, newCenter.y);
        const size = this.viewport.getSize();
        this.camera.setCenter(newCenter, size.width, size.height);
        this.handleCameraChange();
    }

    /**
     * Smoothly animate the view center to target world coordinates over the given duration.
     * @param x Target world x.
     * @param y Target world y.
     * @param durationMs Animation duration in milliseconds (default: 500ms). Set to 0 for instant move.
     * @param onComplete Optional callback fired when animation completes.
     * @throws {ConfigValidationError} If coordinates are not finite numbers.
     */
    goCenter(x: number, y: number, durationMs: number = 500, onComplete?: () => void) {
        validateCoords(x, y);
        this.animationController.animateMoveTo(x, y, durationMs, onComplete);
    }

    /**
     * Fit a world-space rectangle into the viewport: centers the view on the
     * rectangle and picks the largest scale that keeps the whole (padded)
     * area visible, clamped to the scale limits. Animated by default; not
     * related to setBounds, which restricts camera movement.
     * @param bounds Rectangle to fit. Every edge must be finite.
     * @param options `padding` in world units (default 0) or `paddingPx` in
     * screen pixels (wins over `padding`), `durationMs` (default 500,
     * 0 = instant), and `onComplete`.
     * @throws {ConfigValidationError} If an edge is not finite, min >= max on
     * an axis, or a padding value is negative.
     * @example
     * ```ts
     * // Show the whole board with one cell of margin
     * engine.fitBounds({ minX: 0, maxX: 32, minY: 0, maxY: 32 }, { padding: 1 });
     *
     * // 24px of air around any selection, small or huge
     * engine.fitBounds(selectionBounds, { paddingPx: 24 });
     *
     * // Jump to a selection instantly
     * engine.fitBounds(selectionBounds, { durationMs: 0 });
     * ```
     */
    fitBounds(bounds: Bounds, options: FitBoundsOptions = {}) {
        const { padding = 0, paddingPx, durationMs = DEFAULT_VALUES.ANIMATION_DURATION_MS, onComplete } = options;

        const size = this.viewport.getSize();
        // Shared with the config-time helper (it also validates), so the
        // scale a caller derives from fitScale() is exactly the scale this
        // method targets before clamping.
        const rawScale = fitScale(bounds, size, { padding, paddingPx });
        const targetScale = Math.min(this.camera.maxScale, Math.max(this.camera.minScale, rawScale));
        const center = {
            x: (bounds.minX + bounds.maxX) / 2,
            y: (bounds.minY + bounds.maxY) / 2,
        };

        if (durationMs <= 0) {
            const prevScale = this.camera.scale;
            this.camera.setScale(targetScale);
            // Center after the scale change so the final center is exact
            // regardless of how the scale change shifted the view.
            this.camera.setCenter(center, size.width, size.height);
            this.notifyZoomIfChanged(prevScale);
            this.handleCameraChange();
            onComplete?.();
            return;
        }

        // Concurrent move and zoom animations cooperate: the zoom step
        // re-reads the (moving) center every frame. onComplete rides on the
        // zoom animation; both share the same duration.
        this.animationController.animateMoveTo(center.x, center.y, durationMs);
        this.animationController.animateZoomTo(
            targetScale,
            durationMs,
            (prevScale) => this.notifyZoomIfChanged(prevScale),
            onComplete,
        );
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
     * Tear down the registration previously stored under `id`, if any:
     * draw callback, hit-test entries, and (for static draws) the offscreen
     * cache. Runs before the replacement is registered so the new call sees
     * clean state.
     */
    private replacePreviousDraw(id: string | undefined) {
        if (id === undefined) return;
        const prev = this.drawIds.get(id);
        if (!prev) return;
        this.drawIds.delete(id);
        this.drawIdByHandle.delete(prev.handle.id);
        this.renderer.getDrawAPI().removeDrawHandle(prev.handle);
        this.hitTester.remove(prev.handle);
        if (prev.cacheKey !== undefined) this.renderer.getDrawAPI().clearStaticCache(prev.cacheKey);
    }

    private trackDrawId(id: string | undefined, handle: DrawHandle, cacheKey?: string) {
        if (id === undefined) return;
        this.drawIds.set(id, { handle, cacheKey });
        this.drawIdByHandle.set(handle.id, id);
    }

    /**
     * Drop the id bookkeeping for a handle removed through `removeDrawHandle`
     * (or in bulk via `clearLayer`/`clearAll`), so the id can be reused.
     */
    private untrackDrawHandle(handle: DrawHandle) {
        const id = this.drawIdByHandle.get(handle.id);
        if (id === undefined) return;
        this.drawIdByHandle.delete(handle.id);
        const entry = this.drawIds.get(id);
        this.drawIds.delete(id);
        // A removed static registration leaves its offscreen cache orphaned —
        // and silently stale if the same cacheKey is later re-registered with
        // different items — so drop the cache with the registration.
        if (entry?.cacheKey !== undefined) this.renderer.getDrawAPI().clearStaticCache(entry.cacheKey);
    }

    /**
     * Draw one or many rectangles in world space.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Rectangle definitions.
     * @param layer Layer order (lower draws first).
     * @param options Optional `id` (re-registering with the same id replaces
     * the previous registration) and `styleOf` (paint-time decoration: the
     * returned fields overlay the item's `style` each frame without
     * re-registering — mutate your state and call `render()`).
     */
    drawRect<TData = unknown>(
        items: Rect<TData> | Array<Rect<TData>>,
        layer: number = 1,
        options?: RectDrawOptions<TData>,
    ): DrawHandle {
        this.replacePreviousDraw(options?.id);
        // TData only narrows the callback's item type for callers; renderers
        // hand back items from this same registration, so widening is safe.
        const handle = this.renderer
            .getDrawAPI()
            .drawRect(items, layer, { styleOf: options?.styleOf as StyleOf<Rect, ShapeDecorationStyle> | undefined });
        this.hitTester.register(handle, "rect", items, layer);
        this.trackDrawId(options?.id, handle);
        return handle;
    }

    /**
     * Draw rectangles with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like mini-maps where items don't change.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Array of rectangle definitions.
     * @param cacheKey Unique key for this cache (e.g., "minimap-items"). Also
     * acts as the registration id: calling again with the same key replaces
     * the previous registration and invalidates its cache.
     * @param layer Layer order (lower draws first).
     */
    drawStaticRect(items: Array<Rect>, cacheKey: string, layer: number = 1): DrawHandle {
        this.replacePreviousDraw(cacheKey);
        const handle = this.renderer.getDrawAPI().drawStaticRect(items, cacheKey, layer);
        this.hitTester.register(handle, "rect", items, layer, { ignoreSizePx: true });
        this.trackDrawId(cacheKey, handle, cacheKey);
        return handle;
    }

    /**
     * Draw circles with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like mini-maps where items don't change.
     * @param items Array of circle definitions.
     * @param cacheKey Unique key for this cache (e.g., "minimap-circles"). Also
     * acts as the registration id: calling again with the same key replaces
     * the previous registration and invalidates its cache.
     * @param layer Layer order (lower draws first).
     */
    drawStaticCircle(items: Array<Circle>, cacheKey: string, layer: number = 1): DrawHandle {
        this.replacePreviousDraw(cacheKey);
        const handle = this.renderer.getDrawAPI().drawStaticCircle(items, cacheKey, layer);
        this.hitTester.register(handle, "circle", items, layer, { ignoreSizePx: true });
        this.trackDrawId(cacheKey, handle, cacheKey);
        return handle;
    }

    /**
     * Draw images with pre-rendering cache.
     * Renders all items once to an offscreen canvas, then blits the visible portion each frame.
     * Ideal for large static datasets like terrain tiles or static decorations.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Array of image definitions with HTMLImageElement.
     * @param cacheKey Unique key for this cache (e.g., "terrain-cache"). Also
     * acts as the registration id: calling again with the same key replaces
     * the previous registration and invalidates its cache.
     * @param layer Layer order (lower draws first).
     */
    drawStaticImage(items: Array<ImageItem<TImage>>, cacheKey: string, layer: number = 1): DrawHandle {
        this.replacePreviousDraw(cacheKey);
        const handle = this.renderer.getDrawAPI().drawStaticImage(items, cacheKey, layer);
        this.hitTester.register(handle, "image", items, layer, { ignoreSizePx: true });
        this.trackDrawId(cacheKey, handle, cacheKey);
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
     * Lines participate in hit testing: a point within half the stroke width
     * of a segment (with a minimum tap width for hairlines) hits it.
     * @param items Line segments.
     * @param style Line style overrides.
     * @param layer Layer order.
     * @param options Optional `id` (re-registering with the same id replaces
     * the previous registration) and `styleOf` (paint-time decoration overlaid
     * on the call-level `style` per item — also the way to give individual
     * lines their own color). Decorations cannot change `lineWidth`: the
     * hit-test area derives from the registration-time stroke width.
     */
    drawLine<TData = unknown>(
        items: Array<Line<TData>> | Line<TData>,
        style?: LineStyle,
        layer: number = 1,
        options?: LineDrawOptions<TData>,
    ): DrawHandle {
        this.replacePreviousDraw(options?.id);
        const handle = this.renderer.getDrawAPI().drawLine(items, style, layer, {
            styleOf: options?.styleOf as StyleOf<Line, LineDecorationStyle> | undefined,
        });
        this.hitTester.register(handle, "line", items, layer, { style });
        this.trackDrawId(options?.id, handle);
        return handle;
    }

    /**
     * Draw one or many circles sized in world units.
     * @param items Circle definitions.
     * @param layer Layer order.
     * @param options Optional `id` (re-registering with the same id replaces
     * the previous registration) and `styleOf` (paint-time decoration: the
     * returned fields overlay the item's `style` each frame without
     * re-registering — mutate your state and call `render()`).
     */
    drawCircle<TData = unknown>(
        items: Circle<TData> | Array<Circle<TData>>,
        layer: number = 1,
        options?: CircleDrawOptions<TData>,
    ): DrawHandle {
        this.replacePreviousDraw(options?.id);
        const handle = this.renderer.getDrawAPI().drawCircle(items, layer, {
            styleOf: options?.styleOf as StyleOf<Circle, ShapeDecorationStyle> | undefined,
        });
        this.hitTester.register(handle, "circle", items, layer);
        this.trackDrawId(options?.id, handle);
        return handle;
    }

    /**
     * Draw one or many texts at world positions.
     * @param items Text definitions with position, text, size, and style.
     * @param layer Layer order.
     * @param options Optional `id`: re-registering with the same id replaces
     * the previous registration instead of accumulating alongside it.
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
    drawText<TData = unknown>(
        items: Array<Text<TData>> | Text<TData>,
        layer: number = 2,
        options?: TextDrawOptions<TData>,
    ): DrawHandle {
        this.replacePreviousDraw(options?.id);
        const handle = this.renderer
            .getDrawAPI()
            .drawText(items, layer, { styleOf: options?.styleOf as StyleOf<Text, TextDecorationStyle> | undefined });
        this.trackDrawId(options?.id, handle);
        return handle;
    }

    /**
     * Draw one or many free-form paths through world points.
     *
     * Each `PathItem` owns its geometry and style: `points` traces the
     * outline, `closed` joins it back to the start, `style.fillStyle` fills
     * the interior (under `fillRule`), and stroke/dash/corner options follow
     * the shared world-vs-`*Px` unit convention. Paths participate in hit
     * testing: filled paths hit on their interior, unfilled paths on the
     * stroke itself.
     *
     * @param items Path item(s).
     * @param layer Layer order.
     * @param options Optional `id`: re-registering with the same id replaces
     * the previous registration instead of accumulating alongside it.
     * @example
     * ```ts
     * // Filled shape with a rounded outline
     * engine.drawPath({
     *     points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 3 }, { x: 0, y: 3 }],
     *     closed: true,
     *     style: { fillStyle: "#22c55e", strokeStyle: "#166534", lineWidthPx: 2, cornerRadius: 0.5 },
     *     data: { id: "zone-a" },
     * });
     *
     * // Open route line
     * engine.drawPath({ points: route, style: { strokeStyle: "#3b82f6", lineWidthPx: 4 } });
     * ```
     */
    drawPath<TData = unknown>(
        items: PathItem<TData> | Array<PathItem<TData>>,
        layer: number = 1,
        options?: PathDrawOptions<TData>,
    ): DrawHandle {
        this.replacePreviousDraw(options?.id);
        const list = Array.isArray(items) ? items : [items];
        const handle = this.renderer.getDrawAPI().drawPath(list, layer, {
            styleOf: options?.styleOf as StyleOf<PathItem, PathDecorationStyle> | undefined,
        });
        this.hitTester.register(handle, "path", list, layer);
        this.trackDrawId(options?.id, handle);
        return handle;
    }

    /**
     * Draw one or many images scaled in world units.
     * Supports rotation via the `rotate` property (degrees, positive = clockwise).
     * @param items Image definitions.
     * @param layer Layer order.
     * @param options Optional `id`: re-registering with the same id replaces
     * the previous registration instead of accumulating alongside it.
     */
    drawImage(
        items: Array<ImageItem<TImage>> | ImageItem<TImage>,
        layer: number = 1,
        options?: DrawOptions,
    ): DrawHandle {
        this.replacePreviousDraw(options?.id);
        const handle = this.renderer.getDrawAPI().drawImage(items, layer);
        this.hitTester.register(handle, "image", items, layer);
        this.trackDrawId(options?.id, handle);
        return handle;
    }

    /**
     * Draw grid lines at specified cell size.
     * @param cellSize Size of each grid cell in world units.
     * @param options Optional `id`: re-registering with the same id replaces
     * the previous registration instead of accumulating alongside it.
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
        options?: DrawOptions,
    ): DrawHandle {
        this.replacePreviousDraw(options?.id);
        const handle = this.renderer.getDrawAPI().drawGridLines(cellSize, { lineWidth, strokeStyle }, layer);
        this.trackDrawId(options?.id, handle);
        return handle;
    }

    /**
     * Register a custom draw function for complete rendering control.
     * Useful for complex or one-off drawing operations.
     * @param fn Function receiving canvas context, top-left coords, config, and
     * a `transform` helper — use `transform.worldToScreen(x, y)` to position
     * drawing at world coordinates instead of deriving the pixel math by hand.
     * @param layer Layer index (default 1).
     * @param options Optional `id`: re-registering with the same id replaces
     * the previous registration instead of accumulating alongside it.
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
        options?: DrawOptions,
    ): DrawHandle {
        this.replacePreviousDraw(options?.id);
        const handle = this.renderer.getDrawAPI().addDrawFunction(fn, layer);
        this.trackDrawId(options?.id, handle);
        return handle;
    }

    /**
     * Remove a specific draw callback by handle.
     * Does not clear other callbacks on the same layer.
     */
    removeDrawHandle(handle: DrawHandle) {
        this.renderer.getDrawAPI().removeDrawHandle(handle);
        this.hitTester.remove(handle);
        this.untrackDrawHandle(handle);
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
        for (const [id, entry] of this.drawIds) {
            if (entry.handle.layer !== layer) continue;
            this.drawIds.delete(id);
            this.drawIdByHandle.delete(entry.handle.id);
            if (entry.cacheKey !== undefined) this.renderer.getDrawAPI().clearStaticCache(entry.cacheKey);
        }
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
        // Every static cache is orphaned once all callbacks are gone; dropping
        // them prevents stale reuse when the same cacheKey is registered again.
        this.renderer.getDrawAPI().clearStaticCache();
        this.hitTester.clear();
        this.drawIds.clear();
        this.drawIdByHandle.clear();
    }

    // ─── Hit testing ───────────

    /**
     * All rect/circle/image/path/line items under a world point, highest visual
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
    /**
     * All items whose geometry intersects (default) or lies fully inside a
     * world rectangle — the marquee/box-selection query. Corners may be
     * passed in any order (a drag can travel in any direction); build them
     * from event `coords.raw` values, like `hitTest`. Region tests run on
     * item GEOMETRY — stroke widths are not expanded — and filled paths
     * count interior overlap with holes excluded.
     * @example
     * ```ts
     * // Marquee selection between drag start and end (raw coords)
     * const hits = engine.hitTestRect(
     *     { minX: start.x, minY: start.y, maxX: end.x, maxY: end.y },
     *     { layer: 2, mode: "contain" },
     * );
     * select(hits.map((h) => h.item.data));
     * ```
     */
    hitTestRect<TData = unknown>(rect: Bounds, opts?: HitTestRectOptions): HitResult<TImage, TData>[] {
        const region = {
            minX: Math.min(rect.minX, rect.maxX) - DEFAULT_VALUES.CELL_CENTER_OFFSET,
            maxX: Math.max(rect.minX, rect.maxX) - DEFAULT_VALUES.CELL_CENTER_OFFSET,
            minY: Math.min(rect.minY, rect.maxY) - DEFAULT_VALUES.CELL_CENTER_OFFSET,
            maxY: Math.max(rect.minY, rect.maxY) - DEFAULT_VALUES.CELL_CENTER_OFFSET,
        };
        return this.hitTester.hitTestRect<TData>(region, opts) as HitResult<TImage, TData>[];
    }

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
            this.onCoordsChange(this.getCenter());
        }
        this.render();
    }
}
