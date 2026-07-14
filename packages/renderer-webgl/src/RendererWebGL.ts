import {
    AnimationController,
    Config,
    CoordinateTransformer,
    Coords,
    GestureProcessor,
    ICamera,
    IDrawAPI,
    IImageLoader,
    IRenderer,
    NormalizedPointer,
    onClickCallback,
    onDrawCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseLeaveCallback,
    onMouseUpCallback,
    onRightClickCallback,
    onZoomCallback,
    RendererDependencies,
    ViewportState,
} from "@canvas-tile-engine/core";
import { WebGLDraw } from "./modules/WebGLDraw";
import { Layer } from "./modules/Layer";
import { CoordinateOverlayRenderer } from "./modules/CoordinateOverlayRenderer";
import { WebGLDebug } from "./modules/WebGLDebug";
import { EventBinder } from "./modules/EventBinder";
import { ResizeWatcher } from "./modules/ResizeWatcher";
import { ResponsiveWatcher } from "./modules/ResponsiveWatcher";
import { ImageLoader } from "./modules/ImageLoader";
import { SizeController } from "./modules/SizeController";
import { GLRenderer } from "./modules/gl/GLRenderer";
import { ColorParser } from "./utils/color";
import { createOverlayCanvas, getWebGLContext, initStyles } from "./utils/webgl";

/**
 * WebGL2/WebGL1 implementation of {@link IRenderer}.
 *
 * Primitives (rects, circles, images, lines, grid lines, paths) are rendered on
 * the GPU as batched draw calls. Text, the coordinate overlay, the debug HUD and
 * user-supplied draw callbacks are painted on a transparent 2D canvas stacked on
 * top, which keeps the public draw API identical to the Canvas2D renderer.
 *
 * Note: because text/overlays live on the upper 2D canvas, they always composite
 * above every WebGL primitive regardless of their layer index. Within each
 * surface, layer ordering is preserved.
 */
export class RendererWebGL implements IRenderer {
    //
    private canvasWrapper!: HTMLDivElement;
    private canvas!: HTMLCanvasElement;
    private gl!: WebGLRenderingContext;
    private glRenderer!: GLRenderer;

    // 2D overlay surface (text, coordinate overlay, debug, user draw functions)
    private overlayCanvas!: HTMLCanvasElement;
    private overlayCtx!: CanvasRenderingContext2D;

    private camera!: ICamera;
    private config!: Config;
    private viewport!: ViewportState;
    private layers!: Layer;
    private drawAPI!: WebGLDraw;
    private transformer!: CoordinateTransformer;
    private coordinateOverlayRenderer!: CoordinateOverlayRenderer;
    private debugOverlay?: WebGLDebug;
    private colorParser = new ColorParser();

    // Event handling
    private gestureProcessor!: GestureProcessor;
    private eventBinder!: EventBinder;
    private resizeWatcher?: ResizeWatcher;
    private responsiveWatcher?: ResponsiveWatcher;
    private eventsAttached = false;

    // Size control
    private sizeController!: SizeController;
    private animationController!: AnimationController;

    // Image loading
    private imageLoader = new ImageLoader();

    private handleContextLost = (e: Event): void => {
        // Prevent the default so the context can be restored later.
        e.preventDefault();
    };

    private handleContextRestored = (): void => {
        // All GL resources (programs, buffers, textures) died with the lost
        // context; rebuild them on the restored context and repaint. Textures
        // are re-uploaded lazily on the next draw.
        this.glRenderer = new GLRenderer(this.gl);
        this.render();
    };

    /** Optional user-provided draw hook executed after engine layers. */
    public onDraw?: onDrawCallback;

    /** Optional callback fired when canvas is resized. */
    public onResize?: () => void;

    // ─── Callback Getters/Setters (proxy to GestureProcessor) ───

    get onClick(): onClickCallback | undefined {
        return this.gestureProcessor?.onClick;
    }
    set onClick(cb: onClickCallback | undefined) {
        if (this.gestureProcessor) this.gestureProcessor.onClick = cb;
    }

    get onRightClick(): onRightClickCallback | undefined {
        return this.gestureProcessor?.onRightClick;
    }
    set onRightClick(cb: onRightClickCallback | undefined) {
        if (this.gestureProcessor) this.gestureProcessor.onRightClick = cb;
    }

    get onHover(): onHoverCallback | undefined {
        return this.gestureProcessor?.onHover;
    }
    set onHover(cb: onHoverCallback | undefined) {
        if (this.gestureProcessor) this.gestureProcessor.onHover = cb;
    }

    get onMouseDown(): onMouseDownCallback | undefined {
        return this.gestureProcessor?.onMouseDown;
    }
    set onMouseDown(cb: onMouseDownCallback | undefined) {
        if (this.gestureProcessor) this.gestureProcessor.onMouseDown = cb;
    }

    get onMouseUp(): onMouseUpCallback | undefined {
        return this.gestureProcessor?.onMouseUp;
    }
    set onMouseUp(cb: onMouseUpCallback | undefined) {
        if (this.gestureProcessor) this.gestureProcessor.onMouseUp = cb;
    }

    get onMouseLeave(): onMouseLeaveCallback | undefined {
        return this.gestureProcessor?.onMouseLeave;
    }
    set onMouseLeave(cb: onMouseLeaveCallback | undefined) {
        if (this.gestureProcessor) this.gestureProcessor.onMouseLeave = cb;
    }

    get onZoom(): onZoomCallback | undefined {
        return this.gestureProcessor?.onZoom;
    }
    set onZoom(cb: onZoomCallback | undefined) {
        if (this.gestureProcessor) this.gestureProcessor.onZoom = cb;
    }

    /** Callback fired when camera position changes (drag/zoom). */
    public onCameraChange?: () => void;

    init(deps: RendererDependencies) {
        this.config = deps.config;
        // Initialize canvas
        this.canvasWrapper = deps.wrapper;
        this.canvas = this.canvasWrapper.querySelector("canvas") as HTMLCanvasElement;
        if (!this.canvas) {
            throw new Error("Canvas element not found in wrapper");
        }

        initStyles(
            this.canvasWrapper,
            this.canvas,
            this.config.get().responsive,
            this.config.get().size.width,
            this.config.get().size.height,
        );

        // Acquire the WebGL context for the primary canvas.
        this.gl = getWebGLContext(this.canvas);
        this.canvas.addEventListener("webglcontextlost", this.handleContextLost, false);
        this.canvas.addEventListener("webglcontextrestored", this.handleContextRestored, false);
        this.glRenderer = new GLRenderer(this.gl);

        // Create the transparent 2D overlay stacked on top of the WebGL canvas.
        this.overlayCanvas = createOverlayCanvas(this.canvasWrapper);
        const overlayCtx = this.overlayCanvas.getContext("2d");
        if (!overlayCtx) {
            throw new Error("Failed to get 2D overlay context");
        }
        this.overlayCtx = overlayCtx;

        this.transformer = deps.transformer;
        this.viewport = deps.viewport;
        this.camera = deps.camera;
        this.layers = new Layer();
        this.drawAPI = new WebGLDraw(this.layers, deps.transformer, deps.camera);

        this.applyCanvasSize();

        this.coordinateOverlayRenderer = new CoordinateOverlayRenderer(
            this.overlayCtx,
            this.camera,
            this.config,
            this.viewport,
        );

        if (this.config.get().debug?.enabled) {
            this.debugOverlay = new WebGLDebug(this.overlayCtx, this.camera, this.config, this.viewport);
            if (this.config.get().debug?.hud?.fps) {
                this.debugOverlay.setFpsUpdateCallback(() => this.render());
                this.debugOverlay.startFpsLoop();
            }
        }

        // Initialize GestureProcessor
        this.gestureProcessor = new GestureProcessor(
            this.camera,
            this.config,
            this.transformer,
            () => this.canvas.getBoundingClientRect(),
            () => {
                this.onCameraChange?.();
            },
        );

        // Initialize EventBinder with normalized handlers
        this.eventBinder = new EventBinder(this.canvas, {
            click: this.handleClick,
            contextmenu: this.handleContextMenu,
            mousedown: this.handleMouseDown,
            mousemove: this.handleMouseMove,
            mouseup: this.handleMouseUp,
            mouseleave: this.handleMouseLeave,
            wheel: this.handleWheel,
            touchstart: this.handleTouchStart,
            touchmove: this.handleTouchMove,
            touchend: this.handleTouchEnd,
        });

        // Initialize AnimationController and SizeController
        this.animationController = new AnimationController(this.camera, this.viewport, () => this.render());
        this.sizeController = new SizeController(
            this.canvasWrapper,
            this.canvas,
            this.overlayCanvas,
            this.camera,
            this.viewport,
            this.config,
            () => this.render(),
        );
    }

    // ─── Event Setup ───

    setupEvents(): void {
        if (this.eventsAttached) return;
        this.eventBinder.attach();
        this.eventsAttached = true;

        if (this.config.get().responsive) {
            if (this.config.get().eventHandlers?.resize) {
                console.warn(
                    "Canvas Tile Engine: eventHandlers.resize is ignored when responsive mode is enabled. " +
                        "Resizing is handled automatically.",
                );
            }
            this.responsiveWatcher = new ResponsiveWatcher(
                this.canvasWrapper,
                this.canvas,
                this.overlayCanvas,
                this.camera,
                this.viewport,
                this.config,
                () => this.render(),
            );
            this.responsiveWatcher.onResize = () => {
                if (this.onResize) {
                    this.onResize();
                }
            };
            // preserve-viewport resizes change the camera scale; surface it
            // through onZoom like every other engine-driven scale change
            this.responsiveWatcher.onScaleChange = (scale) => {
                this.onZoom?.(scale);
            };
            this.responsiveWatcher.start();
        } else if (this.config.get().eventHandlers?.resize) {
            this.resizeWatcher = new ResizeWatcher(
                this.canvasWrapper,
                this.canvas,
                this.overlayCanvas,
                this.viewport,
                this.camera,
                this.config,
                () => this.render(),
            );
            this.resizeWatcher.onResize = () => {
                if (this.onResize) {
                    this.onResize();
                }
            };
            this.resizeWatcher.start();
        }
    }

    // ─── Normalize Helpers ───

    private normalizePointer(e: MouseEvent | Touch): NormalizedPointer {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            clientX: e.clientX,
            clientY: e.clientY,
        };
    }

    private normalizeTouches(touches: TouchList): NormalizedPointer[] {
        return Array.from(touches).map((t) => this.normalizePointer(t));
    }

    // ─── Event Handlers (DOM → Normalize → GestureProcessor) ───

    private handleClick = (e: MouseEvent): void => {
        this.gestureProcessor.handleClick(this.normalizePointer(e));
    };

    private handleContextMenu = (e: MouseEvent): void => {
        // Claim the event only when right-click handling is opted into;
        // otherwise the browser context menu must keep working.
        if (!this.config.get().eventHandlers.rightClick) return;
        e.preventDefault();
        this.gestureProcessor.handleRightClick(this.normalizePointer(e));
    };

    private handleMouseDown = (e: MouseEvent): void => {
        this.gestureProcessor.handlePointerDown(this.normalizePointer(e));
    };

    private handleMouseMove = (e: MouseEvent): void => {
        this.gestureProcessor.handlePointerMove(this.normalizePointer(e));
    };

    private handleMouseUp = (e: MouseEvent): void => {
        this.gestureProcessor.handlePointerUp(this.normalizePointer(e));
    };

    private handleMouseLeave = (e: MouseEvent): void => {
        this.gestureProcessor.handlePointerLeave(this.normalizePointer(e));
    };

    private handleWheel = (e: WheelEvent): void => {
        // Without zoom opted in, the wheel must keep scrolling the page.
        if (!this.config.get().eventHandlers.zoom) return;
        e.preventDefault();
        this.gestureProcessor.handleWheel(this.normalizePointer(e), e.deltaY);
    };

    // Touch events are claimed only while some touch-driven interaction is
    // enabled (checked per event: setEventHandlers can toggle at runtime).
    // While claimed, preventDefault stays unconditional: it stops page
    // scrolling mid-gesture and suppresses the synthetic mouse events that
    // would double-fire click/mouse callbacks. When nothing is enabled the
    // events are left alone so the page scrolls, and taps still reach the
    // mouse callbacks via the browser's synthetic mouse events.
    private touchInteractionsEnabled(): boolean {
        const eventHandlers = this.config.get().eventHandlers;
        return Boolean(eventHandlers.click || eventHandlers.drag || eventHandlers.zoom || eventHandlers.hover);
    }

    private handleTouchStart = (e: TouchEvent): void => {
        if (!this.touchInteractionsEnabled()) return;
        e.preventDefault();
        this.gestureProcessor.handleTouchStart(this.normalizeTouches(e.touches));
    };

    private handleTouchMove = (e: TouchEvent): void => {
        if (!this.touchInteractionsEnabled()) return;
        e.preventDefault();
        this.gestureProcessor.handleTouchMove(this.normalizeTouches(e.touches));
    };

    private handleTouchEnd = (e: TouchEvent): void => {
        if (!this.touchInteractionsEnabled()) {
            // Handlers may have been disabled mid-gesture: reset the
            // processor's drag/pinch state (no changed pointer → no
            // callbacks) without claiming the event.
            this.gestureProcessor.handleTouchEnd(this.normalizeTouches(e.touches));
            return;
        }
        e.preventDefault();
        const remaining = this.normalizeTouches(e.touches);
        const changed = e.changedTouches.length > 0 ? this.normalizePointer(e.changedTouches[0]) : undefined;
        this.gestureProcessor.handleTouchEnd(remaining, changed);
    };

    getDrawAPI(): IDrawAPI {
        return this.drawAPI;
    }

    getImageLoader(): IImageLoader<HTMLImageElement> {
        return this.imageLoader;
    }

    /**
     * Drop the cached GPU texture for an image source so the next frame
     * re-uploads its current pixels.
     *
     * Image sources are uploaded to the GPU once and cached; dimension changes
     * are detected automatically, but mutating a source's pixels at the same
     * size (e.g. redrawing an offscreen canvas) requires this call. The
     * Canvas2D renderer has no such cache and always paints current pixels.
     */
    invalidateTexture(source: TexImageSource): void {
        this.glRenderer.invalidateTexture(source);
    }

    render(): void {
        const size = this.viewport.getSize();
        const dpr = this.viewport.dpr;
        const config = { ...this.config.get(), size: { ...size }, scale: this.camera.scale };
        const topLeft: Coords = { x: this.camera.x, y: this.camera.y };

        // ── WebGL surface: viewport + background clear ──
        this.glRenderer.setSize(size.width * dpr, size.height * dpr, size.width, size.height);
        this.glRenderer.clear(this.colorParser.parse(config.backgroundColor));

        // ── Overlay surface: reset transform (cleared each frame) ──
        this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.overlayCtx.clearRect(0, 0, config.size.width, config.size.height);

        // Draw engine layers (GL primitives + overlay text/draw functions)
        this.layers.drawAll({
            gl: this.glRenderer,
            ctx: this.overlayCtx,
            camera: this.camera,
            transformer: this.transformer,
            config,
            topLeft,
        });

        // User custom draw callback (optional) — receives the 2D overlay context
        this.onDraw?.(this.overlayCtx, {
            scale: this.camera.scale,
            width: config.size.width,
            height: config.size.height,
            coords: topLeft,
        });

        // Coordinate overlay
        if (this.coordinateOverlayRenderer.shouldDraw(this.camera.scale)) {
            this.coordinateOverlayRenderer.draw();
        }

        // Debug overlay
        if (config.debug?.enabled && this.debugOverlay) {
            if (config.debug?.hud?.fps) {
                this.debugOverlay.setFpsUpdateCallback(() => this.render());
                this.debugOverlay.startFpsLoop();
            }
            this.debugOverlay.draw();
        }
    }

    resize(width: number, height: number): void {
        const dpr = this.viewport.dpr;

        this.viewport.setSize(width, height);

        for (const el of [this.canvas, this.overlayCanvas]) {
            el.width = width * dpr;
            el.height = height * dpr;
            el.style.width = `${width}px`;
            el.style.height = `${height}px`;
        }

        this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.glRenderer.setSize(width * dpr, height * dpr, width, height);
    }

    resizeWithAnimation(width: number, height: number, durationMs: number, onComplete?: () => void): void {
        if (this.config.get().responsive) {
            console.warn(
                "Canvas Tile Engine: resizeWithAnimation() is disabled when responsive mode is enabled. " +
                    "Canvas size is controlled by the wrapper element.",
            );
            return;
        }
        this.sizeController.resizeWithAnimation(width, height, durationMs, this.animationController, () => {
            this.onResize?.();
            onComplete?.();
        });
    }

    destroy(): void {
        // Detach events
        if (this.eventsAttached) {
            this.eventBinder.detach();
            this.eventsAttached = false;
        }
        this.canvas.removeEventListener("webglcontextlost", this.handleContextLost, false);
        this.canvas.removeEventListener("webglcontextrestored", this.handleContextRestored, false);
        this.resizeWatcher?.stop();
        this.resizeWatcher = undefined;
        this.responsiveWatcher?.stop();
        this.responsiveWatcher = undefined;

        // Cancel animations
        this.animationController.cancelAll();

        // Cleanup drawing
        this.drawAPI.destroy();
        this.layers.clear();
        this.debugOverlay?.destroy();
        this.imageLoader.clear();
        this.colorParser.clear();
        this.glRenderer.dispose();

        // Remove the overlay canvas we created.
        this.overlayCanvas.remove();
    }

    private applyCanvasSize() {
        const size = this.viewport.getSize();
        const dpr = this.viewport.dpr;

        for (const el of [this.canvas, this.overlayCanvas]) {
            el.width = size.width * dpr;
            el.height = size.height * dpr;
            el.style.width = `${size.width}px`;
            el.style.height = `${size.height}px`;
        }

        this.overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.glRenderer.setSize(size.width * dpr, size.height * dpr, size.width, size.height);
    }
}
