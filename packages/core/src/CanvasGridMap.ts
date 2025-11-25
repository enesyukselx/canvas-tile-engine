import type { CanvasGridMapConfig, CanvasGridMapDrawCallback, Coords, onClickCallback, onHoverCallback } from "./types";
import { Camera } from "./modules/Camera";
import { CoordinateTransformer } from "./modules/CoordinateTransformer";
import { ConfigManager } from "./modules/ConfigManager";
import { LayerManager } from "./modules/LayerManager";
import { Renderer } from "./modules/Renderer";
import { EventManager } from "./modules/EventManager";

export class CanvasGridMap {
    private configManager: ConfigManager;
    private camera: Camera;
    private transformer: CoordinateTransformer;
    private layers: LayerManager;
    private renderer: Renderer;
    private events: EventManager;

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

    private _onDraw?: CanvasGridMapDrawCallback;
    public get onDraw(): CanvasGridMapDrawCallback | undefined {
        return this._onDraw;
    }
    public set onDraw(cb: CanvasGridMapDrawCallback | undefined) {
        this._onDraw = cb;
        this.renderer.onDraw = cb;
    }

    private _onResize?: () => void;
    public get onResize(): (() => void) | undefined {
        return this._onResize;
    }
    public set onResize(cb: (() => void) | undefined) {
        this._onResize = cb;
        this.events.onResize = cb;
    }

    constructor(canvas: HTMLCanvasElement, config: CanvasGridMapConfig, center: Coords = { x: 0, y: 0 }) {
        this.canvas = canvas;

        this.configManager = new ConfigManager(config);

        const cfg = this.configManager.get();
        const initialTopLeft: Coords = {
            x: center.x - cfg.size.width / (2 * cfg.scale),
            y: center.y - cfg.size.height / (2 * cfg.scale),
        };

        this.camera = new Camera(initialTopLeft, cfg.scale, cfg.minScale, cfg.maxScale);
        this.transformer = new CoordinateTransformer(this.camera);
        this.layers = new LayerManager();
        this.renderer = new Renderer(this.canvas, this.camera, this.transformer, this.configManager, this.layers);

        this.events = new EventManager(this.canvas, this.camera, this.configManager, this.transformer, () => {
            this.handleCameraChange();
        });
    }

    // ─── PUBLIC API ──────────────────────────────

    setupEvents() {
        this.events.setupEvents();
    }

    destroy() {
        this.events.destroy();
    }

    render() {
        this.renderer.render();
    }

    getConfig(): Required<CanvasGridMapConfig> {
        return this.configManager.get();
    }

    /** Center coordinates of the map */
    getCenterCoords(): Coords {
        const cfg = this.configManager.get();
        return this.camera.getCenter(cfg.size.width, cfg.size.height);
    }

    /** Set center coordinates from outside (adjusts the camera accordingly) */
    updateCoords(newCenter: Coords) {
        const cfg = this.configManager.get();
        this.camera.setCenter(newCenter, cfg.size.width, cfg.size.height);
        this.handleCameraChange();
    }

    // ─── Draw helpers ────────────────────────

    /** generic draw function */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasGridMapConfig>) => void,
        layer: number = 1
    ) {
        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            fn(ctx, topLeft, config);
        });
    }

    drawRect(
        x: number,
        y: number,
        style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number },
        size: number = 1,
        layer: number = 1
    ) {
        this.layers.add(layer, ({ ctx, transformer, camera }) => {
            const pos = transformer.worldToScreen(x, y);
            const pxSize = size * camera.scale;
            const half = pxSize / 2;

            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

            ctx.beginPath();
            ctx.rect(pos.x - half, pos.y - half, pxSize, pxSize);
            if (style?.fillStyle) ctx.fill();
            if (style?.strokeStyle) ctx.stroke();
        });
    }

    drawLine(
        x1: number,
        y1: number,
        x2: number,
        y2: number,
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ) {
        this.layers.add(layer, ({ ctx, transformer }) => {
            const a = transformer.worldToScreen(x1, y1);
            const b = transformer.worldToScreen(x2, y2);

            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        });
    }

    drawCircle(
        x: number,
        y: number,
        style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number },
        size: number = 1,
        layer: number = 1
    ) {
        this.layers.add(layer, ({ ctx, transformer, camera }) => {
            const pos = transformer.worldToScreen(x, y);
            const radius = (size * camera.scale) / 2;

            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
            if (style?.fillStyle) ctx.fill();
            if (style?.strokeStyle) ctx.stroke();
        });
    }

    drawText(
        text: string,
        x: number,
        y: number,
        style?: { font?: string; fillStyle?: string; textAlign?: CanvasTextAlign; textBaseline?: CanvasTextBaseline },
        layer: number = 2
    ) {
        this.layers.add(layer, ({ ctx, transformer }) => {
            const pos = transformer.worldToScreen(x, y);
            if (style?.font) ctx.font = style.font;
            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            ctx.textAlign = style?.textAlign ?? "center";
            ctx.textBaseline = style?.textBaseline ?? "middle";
            ctx.fillText(text, pos.x, pos.y);
        });
    }

    drawPath(points: Array<Coords>, style?: { strokeStyle?: string; lineWidth?: number }, layer: number = 1) {
        this.layers.add(layer, ({ ctx, transformer }) => {
            if (!points.length) return;
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

            ctx.beginPath();
            const first = transformer.worldToScreen(points[0].x, points[0].y);
            ctx.moveTo(first.x, first.y);

            for (let i = 1; i < points.length; i++) {
                const p = transformer.worldToScreen(points[i].x, points[i].y);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        });
    }

    // ─── Internal ───────────────────────────────

    private handleCameraChange() {
        if (this.onCoordsChange) {
            this.onCoordsChange(this.getCenterCoords());
        }
        this.render();
    }
}
