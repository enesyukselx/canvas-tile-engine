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
import { CanvasDraw } from "./CanvasDraw";
import { Layer } from "./Layer";
import { initStyles } from "../utils/canvas";
import { CoordinateOverlayRenderer } from "./CoordinateOverlayRenderer";
import { CanvasDebug } from "./CanvasDebug";
import { EventBinder } from "./EventBinder";
import { ResizeWatcher } from "./ResizeWatcher";
import { ResponsiveWatcher } from "./ResponsiveWatcher";
import { ImageLoader } from "./ImageLoader";
import { SizeController } from "./SizeController";

export class RendererCanvas implements IRenderer {
    //
    private canvasWrapper!: HTMLDivElement;
    private canvas!: HTMLCanvasElement;
    private canvasContext!: CanvasRenderingContext2D;
    private camera!: ICamera;
    private config!: Config;
    private viewport!: ViewportState;
    private layers!: Layer;
    private drawAPI!: CanvasDraw;
    private transformer!: CoordinateTransformer;
    private coordinateOverlayRenderer!: CoordinateOverlayRenderer;
    private debugOverlay?: CanvasDebug;

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
            this.config.get().size.height
        );

        this.canvasContext = this.canvas.getContext("2d")!;

        if (!this.canvasContext) {
            throw new Error("Failed to get 2D canvas context");
        }

        this.transformer = deps.transformer;
        this.viewport = deps.viewport;
        this.camera = deps.camera;
        this.layers = new Layer();
        this.drawAPI = new CanvasDraw(this.layers, deps.transformer, deps.camera);

        this.applyCanvasSize();

        this.coordinateOverlayRenderer = new CoordinateOverlayRenderer(
            this.canvasContext,
            this.camera,
            this.config,
            this.viewport
        );

        if (this.config.get().debug?.enabled) {
            this.debugOverlay = new CanvasDebug(this.canvasContext, this.camera, this.config, this.viewport);
            // Start FPS loop if fps hud is enabled
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
                this.render();
            }
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
            this.camera,
            this.viewport,
            this.config,
            () => this.render()
        );
    }

    // ─── Event Setup ───

    setupEvents(): void {
        if (this.eventsAttached) return;
        this.eventBinder.attach();
        this.eventsAttached = true;

        // Setup responsive or resize watcher based on config
        if (this.config.get().responsive) {
            // Responsive mode - use ResponsiveWatcher
            if (this.config.get().eventHandlers?.resize) {
                console.warn(
                    "Canvas Tile Engine: eventHandlers.resize is ignored when responsive mode is enabled. " +
                        "Resizing is handled automatically."
                );
            }
            this.responsiveWatcher = new ResponsiveWatcher(
                this.canvasWrapper,
                this.canvas,
                this.camera,
                this.viewport,
                this.config,
                () => this.render()
            );
            this.responsiveWatcher.onResize = () => {
                if (this.onResize) {
                    this.onResize();
                }
            };
            this.responsiveWatcher.start();
        } else if (this.config.get().eventHandlers?.resize) {
            // Non-responsive mode with resize enabled - use ResizeWatcher
            this.resizeWatcher = new ResizeWatcher(
                this.canvasWrapper,
                this.canvas,
                this.viewport,
                this.camera,
                this.config,
                () => this.render()
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
        e.preventDefault();
        this.gestureProcessor.handleWheel(this.normalizePointer(e), e.deltaY);
    };

    private handleTouchStart = (e: TouchEvent): void => {
        e.preventDefault();
        this.gestureProcessor.handleTouchStart(this.normalizeTouches(e.touches));
    };

    private handleTouchMove = (e: TouchEvent): void => {
        e.preventDefault();
        this.gestureProcessor.handleTouchMove(this.normalizeTouches(e.touches));
    };

    private handleTouchEnd = (e: TouchEvent): void => {
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

    render(): void {
        const size = this.viewport.getSize();
        const dpr = this.viewport.dpr;
        const config = { ...this.config.get(), size: { ...size }, scale: this.camera.scale };
        const topLeft: Coords = { x: this.camera.x, y: this.camera.y };

        // Reset transform for HiDPI support (canvas.width/height changes reset transform)
        this.canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);

        // Clear background
        this.canvasContext.clearRect(0, 0, config.size.width, config.size.height);
        this.canvasContext.fillStyle = config.backgroundColor;
        this.canvasContext.fillRect(0, 0, config.size.width, config.size.height);

        // Draw engine layers
        this.layers.drawAll({
            ctx: this.canvasContext,
            camera: this.camera,
            transformer: this.transformer,
            config,
            topLeft,
        });

        // User custom draw callback (optional)
        this.onDraw?.(this.canvasContext, {
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

        // Set actual canvas resolution (physical pixels)
        this.canvas.width = width * dpr;
        this.canvas.height = height * dpr;

        // Set display size via CSS (logical pixels)
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;

        // Scale context to match DPR
        this.canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resizeWithAnimation(width: number, height: number, durationMs: number, onComplete?: () => void): void {
        if (this.config.get().responsive) {
            console.warn(
                "Canvas Tile Engine: resizeWithAnimation() is disabled when responsive mode is enabled. " +
                    "Canvas size is controlled by the wrapper element."
            );
            return;
        }
        this.sizeController.resizeWithAnimation(width, height, durationMs, this.animationController, () => {
            // Trigger onResize callback after programmatic resize completes
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
    }

    private applyCanvasSize() {
        const size = this.viewport.getSize();
        const dpr = this.viewport.dpr;

        // Set actual canvas resolution (physical pixels)
        this.canvas.width = size.width * dpr;
        this.canvas.height = size.height * dpr;

        // Set display size via CSS (logical pixels)
        this.canvas.style.width = `${size.width}px`;
        this.canvas.style.height = `${size.height}px`;

        // Scale context to match DPR
        this.canvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}
