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
import { Skia, type SkCanvas, type SkImage, type SkPaint } from "@shopify/react-native-skia";
import { Layer } from "./modules/Layer";
import { SkiaDraw } from "./modules/SkiaDraw";
import { SkiaImageLoader } from "./modules/SkiaImageLoader";
import { SkiaMount } from "./types";

/**
 * React Native Skia implementation of {@link IRenderer}.
 *
 * Implements the same engine contract as the DOM renderers, but draws primitives
 * onto an `SkCanvas` recorded into a frame picture by the host (the
 * `@canvas-tile-engine/react-native` binding). The host owns mounting, layout
 * and gestures; it forwards normalized pointer input via the `dispatch*` methods
 * and supplies the canvas via {@link SkiaMount.present}.
 *
 * Note: the coordinate overlay and debug HUD from the Canvas2D renderer are not
 * yet implemented here; `onDraw` and all primitive/text drawing are supported.
 */
export class RendererSkia implements IRenderer<SkiaMount, SkImage> {
    private mount!: SkiaMount;
    private camera!: ICamera;
    private config!: Config;
    private viewport!: ViewportState;
    private transformer!: CoordinateTransformer;
    private layers!: Layer;
    private drawAPI!: SkiaDraw;
    private bgPaint!: SkPaint;

    private gestureProcessor!: GestureProcessor;
    private animationController!: AnimationController;

    private imageLoader = new SkiaImageLoader();

    /** Optional user-provided draw hook executed after engine layers. */
    public onDraw?: onDrawCallback;

    /** Optional callback fired when canvas is resized. */
    public onResize?: () => void;

    /** Callback fired when camera position changes (drag/zoom). */
    public onCameraChange?: () => void;

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

    init(deps: RendererDependencies<SkiaMount>): void {
        this.mount = deps.wrapper;
        this.config = deps.config;
        this.camera = deps.camera;
        this.viewport = deps.viewport;
        this.transformer = deps.transformer;

        this.layers = new Layer();
        this.drawAPI = new SkiaDraw(this.layers, deps.transformer, deps.camera);

        this.bgPaint = Skia.Paint();
        this.bgPaint.setAntiAlias(false);

        this.gestureProcessor = new GestureProcessor(
            this.camera,
            this.config,
            this.transformer,
            () => {
                const { width, height } = this.mount.getSize();
                return { left: 0, top: 0, x: 0, y: 0, width, height, right: width, bottom: height };
            },
            () => {
                this.onCameraChange?.();
            }
        );

        this.animationController = new AnimationController(this.camera, this.viewport, () => this.render());
    }

    /**
     * No-op: gestures are delivered by the host via the `dispatch*` methods, and
     * layout/resize is driven by the host's `onLayout`. Kept to satisfy IRenderer.
     */
    setupEvents(): void {
        // Intentionally empty for the Skia/React Native backend.
    }

    getDrawAPI(): IDrawAPI<SkImage> {
        return this.drawAPI;
    }

    getImageLoader(): IImageLoader<SkImage> {
        return this.imageLoader;
    }

    render(): void {
        this.mount.present((canvas) => this.paintFrame(canvas));
    }

    private paintFrame(canvas: SkCanvas): void {
        const size = this.viewport.getSize();
        const config = { ...this.config.get(), size: { ...size }, scale: this.camera.scale };
        const topLeft: Coords = { x: this.camera.x, y: this.camera.y };

        // Background
        this.bgPaint.setColor(Skia.Color(config.backgroundColor));
        canvas.drawRect(Skia.XYWHRect(0, 0, size.width, size.height), this.bgPaint);

        // Engine layers
        this.layers.drawAll({
            canvas,
            camera: this.camera,
            transformer: this.transformer,
            config,
            topLeft,
        });

        // User custom draw callback (optional) — receives the SkCanvas
        this.onDraw?.(canvas, {
            scale: this.camera.scale,
            width: config.size.width,
            height: config.size.height,
            coords: topLeft,
        });
    }

    resize(width: number, height: number): void {
        this.viewport.setSize(width, height);
        this.render();
    }

    resizeWithAnimation(width: number, height: number, durationMs: number, onComplete?: () => void): void {
        this.animationController.animateResize(
            width,
            height,
            durationMs,
            (w, h, center) => {
                this.viewport.setSize(Math.round(w), Math.round(h));
                this.camera.setCenter(center, Math.round(w), Math.round(h));
                this.render();
            },
            () => {
                this.onResize?.();
                onComplete?.();
            }
        );
    }

    destroy(): void {
        this.animationController?.cancelAll();
        this.drawAPI?.destroy();
        this.layers?.clear();
        this.imageLoader.clear();
    }

    // ─── Host → renderer gesture forwarding ───
    //
    // The React Native binding normalizes touch events into NormalizedPointer
    // (canvas-relative x/y, plus page-relative clientX/clientY) and calls these.

    dispatchTap(pointer: NormalizedPointer): void {
        this.gestureProcessor.handleClick(pointer);
    }

    dispatchPointerDown(pointer: NormalizedPointer): void {
        this.gestureProcessor.handlePointerDown(pointer);
    }

    dispatchPointerMove(pointer: NormalizedPointer): void {
        this.gestureProcessor.handlePointerMove(pointer);
    }

    dispatchPointerUp(pointer: NormalizedPointer): void {
        this.gestureProcessor.handlePointerUp(pointer);
    }

    dispatchPointerLeave(pointer: NormalizedPointer): void {
        this.gestureProcessor.handlePointerLeave(pointer);
    }

    dispatchTouchStart(pointers: NormalizedPointer[]): void {
        this.gestureProcessor.handleTouchStart(pointers);
    }

    dispatchTouchMove(pointers: NormalizedPointer[]): void {
        this.gestureProcessor.handleTouchMove(pointers);
    }

    dispatchTouchEnd(remaining: NormalizedPointer[], changed?: NormalizedPointer): void {
        this.gestureProcessor.handleTouchEnd(remaining, changed);
    }
}
