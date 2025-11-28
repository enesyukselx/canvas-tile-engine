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
import { Coords, GridEngineConfig, onClickCallback, onDrawCallback, onHoverCallback } from "./types";

/**
 * Core engine wiring camera, config, renderer, events, and draw helpers.
 */
export class GridEngine {
    private config: Config;
    private camera: Camera;
    private viewport: ViewportState;
    private coordinateTransformer: CoordinateTransformer;
    private layers?: Layer;
    private renderer: IRenderer;
    private events: EventManager;
    private draw?: CanvasDraw;
    public images: ImageLoader;
    private moveAnimationId?: number;

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
    constructor(canvas: HTMLCanvasElement, config: GridEngineConfig, center: Coords = { x: 0, y: 0 }) {
        this.canvas = canvas;

        this.config = new Config(config);

        const rendererType = config.renderer ?? "canvas";
        const initialTopLeft: Coords = {
            x: center.x - config.size.width / (2 * config.scale),
            y: center.y - config.size.height / (2 * config.scale),
        };

        this.viewport = new ViewportState(config.size.width, config.size.height);
        this.camera = new Camera(initialTopLeft, config.scale, config.minScale, config.maxScale);
        this.coordinateTransformer = new CoordinateTransformer(this.camera);
        this.renderer = this.createRenderer(rendererType);

        this.images = new ImageLoader();

        this.events = new EventManager(
            this.canvas,
            this.camera,
            this.viewport,
            this.config,
            this.coordinateTransformer,
            () => {
                this.handleCameraChange();
            }
        );
    }

    // ─── PUBLIC API ──────────────────────────────

    /** Attach event listeners configured in `eventHandlers`. */
    setupEvents() {
        this.events.setupEvents();
    }

    /** Tear down listeners and observers. */
    destroy() {
        this.events.destroy();
    }

    /** Render a frame using the active renderer. */
    render() {
        this.renderer.render();
    }

    /** Snapshot of current normalized config. */
    getConfig(): Required<GridEngineConfig> {
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
        if (this.moveAnimationId !== undefined) {
            cancelAnimationFrame(this.moveAnimationId);
        }

        if (durationMs <= 0) {
            const size = this.viewport.getSize();
            this.camera.setCenter({ x, y }, size.width, size.height);
            this.handleCameraChange();
            this.moveAnimationId = undefined;
            return;
        }

        const startCenter = this.getCenterCoords();
        const target = { x, y };
        const size = this.viewport.getSize();
        const start = performance.now();

        const step = (now: number) => {
            const elapsed = now - start;
            const t = Math.min(1, elapsed / durationMs);

            const nextCenter = {
                x: startCenter.x + (target.x - startCenter.x) * t,
                y: startCenter.y + (target.y - startCenter.y) * t,
            };

            this.camera.setCenter(nextCenter, size.width, size.height);
            this.handleCameraChange();

            if (t < 1) {
                this.moveAnimationId = requestAnimationFrame(step);
            } else {
                this.moveAnimationId = undefined;
            }
        };

        this.moveAnimationId = requestAnimationFrame(step);
    }

    // ─── Draw helpers (canvas renderer only) ───────────

    /**
     * Register a generic draw callback (canvas renderer only).
     * @param fn Callback invoked with context, top-left coords, and config.
     * @param layer Layer order (lower draws first).
     */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<GridEngineConfig>) => void,
        layer: number = 1
    ) {
        this.ensureCanvasDraw().addDrawFunction(fn, layer);
    }

    /**
     * Draw a rectangle in world space (canvas renderer only).
     * @param x World x.
     * @param y World y.
     * @param options Size/origin/style overrides.
     * @param layer Layer order (lower draws first).
     */
    drawRect(
        x: number,
        y: number,
        options?: {
            size?: number;
            origin?: {
                mode?: "cell" | "self";
                x?: number; // 0 to 1
                y?: number; // 0 to 1
            };
            style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number };
        },
        layer: number = 1
    ) {
        this.ensureCanvasDraw().drawRect(x, y, options, layer);
    }

    /**
     * Draw a line between two world points (canvas renderer only).
     * @param x1 Start x in world space.
     * @param y1 Start y in world space.
     * @param x2 End x in world space.
     * @param y2 End y in world space.
     * @param options Line style overrides.
     * @param layer Layer order.
     */
    drawLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        options?: { style?: { strokeStyle?: string; lineWidth?: number } },
        layer: number = 1
    ) {
        this.ensureCanvasDraw().drawLine(x1, y1, x2, y2, options, layer);
    }

    /**
     * Draw a circle sized in world units (canvas renderer only).
     * @param x Center x in world space.
     * @param y Center y in world space.
     * @param options Size/origin/style overrides.
     * @param layer Layer order.
     */
    drawCircle(
        x: number,
        y: number,
        options?: {
            size?: number;
            origin?: {
                mode?: "cell" | "self";
                x?: number;
                y?: number;
            };
            style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number };
        },
        layer: number = 1
    ) {
        this.ensureCanvasDraw().drawCircle(x, y, options, layer);
    }

    /**
     * Draw text at a world position (canvas renderer only).
     * @param text Text content.
     * @param x World x.
     * @param y World y.
     * @param options Text style overrides.
     * @param layer Layer order.
     */
    drawText(
        text: string,
        x: number,
        y: number,
        options?: {
            style?: {
                font?: string;
                fillStyle?: string;
                textAlign?: CanvasTextAlign;
                textBaseline?: CanvasTextBaseline;
            };
        },
        layer: number = 2
    ) {
        this.ensureCanvasDraw().drawText(text, x, y, options, layer);
    }

    /**
     * Draw a polyline through world points (canvas renderer only).
     * @param points World-space points.
     * @param options Stroke style overrides.
     * @param layer Layer order.
     */
    drawPath(
        points: Array<Coords>,
        options?: {
            style?: { strokeStyle?: string; lineWidth?: number };
        },
        layer: number = 1
    ) {
        this.ensureCanvasDraw().drawPath(points, options, layer);
    }

    /**
     * Draw an image scaled in world units (canvas renderer only).
     * @param img Loaded image.
     * @param x World x.
     * @param y World y.
     * @param options Size/origin overrides.
     * @param layer Layer order.
     */
    drawImage(
        img: HTMLImageElement,
        x: number,
        y: number,
        options?: {
            size?: number; // world size
            origin?: {
                mode?: "cell" | "self";
                x?: number;
                y?: number;
            };
        },
        layer: number = 1
    ) {
        this.ensureCanvasDraw().drawImage(img, x, y, options, layer);
    }

    /**
     * Build the active renderer based on config.
     * @param type Renderer type requested.
     */
    private createRenderer(type: GridEngineConfig["renderer"]): IRenderer {
        switch (type) {
            case "canvas": {
                this.layers = new Layer();
                this.draw = new CanvasDraw(this.layers, this.coordinateTransformer, this.camera);
                return new CanvasRenderer(
                    this.canvas,
                    this.camera,
                    this.coordinateTransformer,
                    this.config,
                    this.viewport,
                    this.layers
                );
            }
            default:
                throw new Error(`Renderer "${type ?? "unknown"}" is not supported yet.`);
        }
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
