import { Camera } from "./modules/Camera";
import { Config } from "./modules/Config";
import { CoordinateTransformer } from "./modules/CoordinateTransformer";
import { CanvasDraw } from "./modules/CanvasDraw";
import { EventManager } from "./modules/EventManager";
import { ImageLoader } from "./modules/ImageLoader";
import { Layer } from "./modules/Layer";
import { ViewportState } from "./modules/ViewportState";
import { CanvasRenderer } from "./modules/Renderer/CanvasRenderer";
import { IRenderer } from "./modules/Renderer/Renderer";
import { Coords, DrawObject, CanvasTileEngineConfig, onClickCallback, onDrawCallback, onHoverCallback } from "./types";
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

    private _onHover?: onHoverCallback;
    public get onHover(): onHoverCallback | undefined {
        return this._onHover;
    }
    public set onHover(cb: onHoverCallback | undefined) {
        this._onHover = cb;
        this.events.onHover = cb;
    }

    private _onMouseLeave?: () => void;
    public get onMouseLeave(): (() => void) | undefined {
        return this._onMouseLeave;
    }
    public set onMouseLeave(cb: (() => void) | undefined) {
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

    /**
     * @param canvas Target canvas element.
     * @param config Initial engine configuration.
     * @param center Initial center in world space.
     */
    constructor(canvasWrapper: HTMLDivElement, config: CanvasTileEngineConfig, center: Coords = { x: 0, y: 0 }) {
        this.canvasWrapper = canvasWrapper;
        this.canvas = canvasWrapper.querySelector("canvas")!;

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
            this.config.get().maxScale
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
    }

    // ─── PUBLIC API ──────────────────────────────

    /** Tear down listeners and observers. */
    destroy() {
        this.events.destroy();
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
     */
    resize(width: number, height: number, durationMs: number = 500) {
        this.sizeController.resizeWithAnimation(width, height, durationMs, this.animationController);
    }

    /**
     * Current canvas size.
     * @returns Current `{ width, height }` in pixels.
     */
    getSize() {
        return this.viewport.getSize();
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
        const cfg = this.config.get();
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
     */
    goCoords(x: number, y: number, durationMs: number = 500) {
        this.animationController.animateMoveTo(x, y, durationMs);
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
    ) {
        this.ensureCanvasDraw().addDrawFunction(fn, layer);
    }

    /**
     * Draw one or many rectangles in world space (canvas renderer only).
     * @param items Rectangle definitions.
     * @param layer Layer order (lower draws first).
     */
    drawRect(items: DrawObject | Array<DrawObject>, layer: number = 1) {
        this.ensureCanvasDraw().drawRect(items, layer);
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
    ) {
        this.ensureCanvasDraw().drawLine(items, style, layer);
    }

    /**
     * Draw one or many circles sized in world units (canvas renderer only).
     * @param items Circle definitions.
     * @param layer Layer order.
     */
    drawCircle(items: DrawObject | Array<DrawObject>, layer: number = 1) {
        this.ensureCanvasDraw().drawCircle(items, layer);
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
    ) {
        this.ensureCanvasDraw().drawText(items, style, layer);
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
    ) {
        this.ensureCanvasDraw().drawPath(items, style, layer);
    }

    /**
     * Draw one or many images scaled in world units (canvas renderer only).
     * @param items Image definitions.
     * @param layer Layer order.
     */
    drawImage(
        items:
            | Array<Omit<DrawObject, "style"> & { img: HTMLImageElement }>
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement }),
        layer: number = 1
    ) {
        this.ensureCanvasDraw().drawImage(items, layer);
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
