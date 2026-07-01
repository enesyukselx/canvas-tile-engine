import {
    Config,
    CoordinateTransformer,
    Coords,
    ICamera,
    IDrawAPI,
    IImageLoader,
    IRenderer,
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
import { createCanvas, type Canvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";
import { CanvasDraw } from "./modules/CanvasDraw";
import { CoordinateOverlayRenderer } from "./modules/CoordinateOverlayRenderer";
import { ImageLoaderServer } from "./modules/ImageLoaderServer";
import { Layer } from "./modules/Layer";
import type { ImageFormat, ServerMount } from "./types";

/** Construction options for {@link RendererServer}. */
export interface RendererServerOptions {
    /**
     * Backing pixel ratio, e.g. `2` for @2x/retina output. The logical
     * (world/viewport) size stays as configured; only the physical resolution
     * of the exported image is scaled. Default `1`.
     */
    pixelRatio?: number;
}

/**
 * Headless Canvas Tile Engine renderer for Node.js. Draws to an in-memory
 * `@napi-rs/canvas` surface and exports it as a PNG/JPEG/WebP `Buffer`.
 *
 * No DOM, no events, no animation loop — a single `render()` produces one
 * frame you can encode. Ideal for OG/share images, CDN tile pre-rendering,
 * emails, and visual snapshot tests.
 */
export class RendererServer implements IRenderer<ServerMount, Image> {
    private canvas!: Canvas;
    private ctx!: SKRSContext2D;
    private camera!: ICamera;
    private config!: Config;
    private viewport!: ViewportState;
    private transformer!: CoordinateTransformer;
    private layers!: Layer;
    private drawAPI!: CanvasDraw;
    private coordinateOverlay!: CoordinateOverlayRenderer;
    private imageLoader = new ImageLoaderServer();
    private readonly pixelRatio: number;

    /** Optional user-provided draw hook executed after engine layers. */
    public onDraw?: onDrawCallback;
    /** Optional callback fired after a programmatic resize. */
    public onResize?: () => void;
    /** Optional callback fired when the camera changes (unused headlessly). */
    public onCameraChange?: () => void;

    // Interaction callbacks are part of IRenderer but never fire on the server.
    public onClick?: onClickCallback;
    public onRightClick?: onRightClickCallback;
    public onHover?: onHoverCallback;
    public onMouseDown?: onMouseDownCallback;
    public onMouseUp?: onMouseUpCallback;
    public onMouseLeave?: onMouseLeaveCallback;
    public onZoom?: onZoomCallback;

    constructor(options: RendererServerOptions = {}) {
        this.pixelRatio = options.pixelRatio && options.pixelRatio > 0 ? options.pixelRatio : 1;
    }

    init(deps: RendererDependencies<ServerMount>): void {
        this.config = deps.config;
        this.camera = deps.camera;
        this.viewport = deps.viewport;
        this.transformer = deps.transformer;

        const { width, height } = this.viewport.getSize();
        this.canvas = createCanvas(this.physical(width), this.physical(height));

        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D canvas context from @napi-rs/canvas");
        }
        this.ctx = ctx;

        this.layers = new Layer();
        this.drawAPI = new CanvasDraw(this.layers, this.transformer, this.camera, (w, h) => createCanvas(w, h));
        this.coordinateOverlay = new CoordinateOverlayRenderer(this.ctx, this.camera, this.config, this.viewport);

        this.applyTransform();
    }

    /** Headless renderer has no DOM events to attach. */
    setupEvents(): void {
        // Intentionally empty — no interaction on the server.
    }

    getDrawAPI(): IDrawAPI<Image> {
        return this.drawAPI;
    }

    getImageLoader(): IImageLoader<Image> {
        return this.imageLoader;
    }

    render(): void {
        const size = this.viewport.getSize();
        const config = { ...this.config.get(), size: { ...size }, scale: this.camera.scale };
        const topLeft: Coords = { x: this.camera.x, y: this.camera.y };

        this.applyTransform();

        // Clear + background
        this.ctx.clearRect(0, 0, config.size.width, config.size.height);
        this.ctx.fillStyle = config.backgroundColor;
        this.ctx.fillRect(0, 0, config.size.width, config.size.height);

        // Engine layers
        this.layers.drawAll({
            ctx: this.ctx,
            camera: this.camera,
            transformer: this.transformer,
            config,
            topLeft,
        });

        // User custom draw callback (optional)
        this.onDraw?.(this.ctx, {
            scale: this.camera.scale,
            width: config.size.width,
            height: config.size.height,
            coords: topLeft,
        });

        // Coordinate overlay
        if (this.coordinateOverlay.shouldDraw(this.camera.scale)) {
            this.coordinateOverlay.draw();
        }
    }

    resize(width: number, height: number): void {
        this.viewport.setSize(width, height);
        this.canvas.width = this.physical(width);
        this.canvas.height = this.physical(height);
        this.applyTransform();
    }

    /**
     * Headless renderer cannot animate; applies the resize immediately, renders,
     * and invokes the completion callbacks synchronously.
     */
    resizeWithAnimation(width: number, height: number, _durationMs: number, onComplete?: () => void): void {
        this.resize(width, height);
        this.render();
        this.onResize?.();
        onComplete?.();
    }

    destroy(): void {
        this.drawAPI.destroy();
        this.layers.clear();
        this.imageLoader.clear();
    }

    // ─── Headless output API ───────────────────────

    /** The underlying `@napi-rs/canvas` canvas. */
    getCanvas(): Canvas {
        return this.canvas;
    }

    /** The underlying 2D context (useful for advanced custom drawing). */
    getContext(): SKRSContext2D {
        return this.ctx;
    }

    /**
     * Synchronously encode the current frame to an image `Buffer`.
     * @param format Output format (default `"png"`).
     * @param quality Quality 0–100 for `jpeg`/`webp` (ignored for `png`).
     */
    toBuffer(format: ImageFormat = "png", quality?: number): Buffer {
        switch (format) {
            case "jpeg":
                return this.canvas.toBuffer("image/jpeg", quality);
            case "webp":
                return this.canvas.toBuffer("image/webp", quality);
            default:
                return this.canvas.toBuffer("image/png");
        }
    }

    /**
     * Asynchronously encode the current frame to an image `Buffer`.
     * Prefer this over {@link toBuffer} to avoid blocking the event loop.
     * @param format Output format (default `"png"`).
     * @param quality Quality 0–100 for `jpeg`/`webp` (ignored for `png`).
     */
    async encode(format: ImageFormat = "png", quality?: number): Promise<Buffer> {
        switch (format) {
            case "jpeg":
                return this.canvas.encode("jpeg", quality);
            case "webp":
                return this.canvas.encode("webp", quality);
            default:
                return this.canvas.encode("png");
        }
    }

    // ─── Internal helpers ───────────────────────────

    /** Physical pixel dimension for a logical size, respecting `pixelRatio`. */
    private physical(size: number): number {
        return Math.max(1, Math.round(size * this.pixelRatio));
    }

    /** Reset the context transform to the current pixel ratio. */
    private applyTransform(): void {
        this.ctx.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
    }
}
