import { Coords, GridEngineConfig } from "../types";
import { ICamera } from "./Camera";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { Layer } from "./Layer";

/**
 * Canvas-specific helpers for adding draw callbacks to the layer stack.
 * @internal
 */
export class CanvasDraw {
    constructor(private layers: Layer, private transformer: CoordinateTransformer, private camera: ICamera) {}

    /**
     * Register a generic draw callback; receives raw context, current coords, and config.
     * @param fn Callback invoked during render.
     * @param layer Layer order (lower draws first).
     */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<GridEngineConfig>) => void,
        layer: number = 1
    ) {
        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            fn(ctx, topLeft, config);
        });
    }

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
        this.layers.add(layer, ({ ctx }) => {
            const size = options?.size || 1;
            const origin = {
                mode: options?.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                x: options?.origin?.x ?? 0.5,
                y: options?.origin?.y ?? 0.5,
            };
            const style = options?.style;

            const pos = this.transformer.worldToScreen(x, y);
            const pxSize = size * this.camera.scale;

            const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

            ctx.beginPath();
            ctx.rect(drawX, drawY, pxSize, pxSize);
            if (style?.fillStyle) ctx.fill();
            if (style?.strokeStyle) ctx.stroke();
        });
    }

    /**
     * Draw a line between two world points.
     * @param x1 Start x in world space.
     * @param y1 Start y in world space.
     * @param x2 End x in world space.
     * @param y2 End y in world space.
     * @param options Line style.
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
        this.layers.add(layer, ({ ctx }) => {
            const a = this.transformer.worldToScreen(x1, y1);
            const b = this.transformer.worldToScreen(x2, y2);

            if (options?.style?.strokeStyle) ctx.strokeStyle = options.style.strokeStyle;
            if (options?.style?.lineWidth) ctx.lineWidth = options.style.lineWidth;

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
        });
    }

    /**
     * Draw a circle sized in world units.
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
        this.layers.add(layer, ({ ctx }) => {
            const size = options?.size ?? 1;
            const origin = {
                mode: options?.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                x: options?.origin?.x ?? 0.5,
                y: options?.origin?.y ?? 0.5,
            };
            const style = options?.style;

            const pos = this.transformer.worldToScreen(x, y);
            const pxSize = size * this.camera.scale;
            const radius = pxSize / 2;

            const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

            ctx.beginPath();
            ctx.arc(drawX + radius, drawY + radius, radius, 0, Math.PI * 2);
            if (style?.fillStyle) ctx.fill();
            if (style?.strokeStyle) ctx.stroke();
        });
    }

    /**
     * Draw text at a world position.
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
        this.layers.add(layer, ({ ctx }) => {
            const pos = this.transformer.worldToScreen(x, y);
            if (options?.style?.font) ctx.font = options.style.font;
            if (options?.style?.fillStyle) ctx.fillStyle = options.style.fillStyle;
            ctx.textAlign = options?.style?.textAlign ?? "center";
            ctx.textBaseline = options?.style?.textBaseline ?? "middle";
            ctx.fillText(text, pos.x, pos.y);
        });
    }

    /**
     * Draw a polyline through world points.
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
        this.layers.add(layer, ({ ctx }) => {
            if (!points.length) return;
            if (options?.style?.strokeStyle) ctx.strokeStyle = options.style.strokeStyle;
            if (options?.style?.lineWidth) ctx.lineWidth = options.style.lineWidth;

            ctx.beginPath();
            const first = this.transformer.worldToScreen(points[0].x, points[0].y);
            ctx.moveTo(first.x, first.y);

            for (let i = 1; i < points.length; i++) {
                const p = this.transformer.worldToScreen(points[i].x, points[i].y);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        });
    }

    /**
     * Draw an image scaled in world units.
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
        this.layers.add(layer, ({ ctx }) => {
            const size = options?.size ?? 1;
            const origin = {
                mode: options?.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                x: options?.origin?.x ?? 0.5,
                y: options?.origin?.y ?? 0.5,
            };

            const pos = this.transformer.worldToScreen(x, y);
            const pxSize = size * this.camera.scale;

            // preserve aspect
            const aspect = img.width / img.height;

            let drawW = pxSize;
            let drawH = pxSize;

            if (aspect > 1) drawH = pxSize / aspect;
            else drawW = pxSize * aspect;

            // origin SELF/CELL
            const { x: baseX, y: baseY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

            const offsetX = baseX + (pxSize - drawW) / 2;
            const offsetY = baseY + (pxSize - drawH) / 2;

            ctx.drawImage(img, offsetX, offsetY, drawW, drawH);
        });
    }

    private computeOriginOffset(
        pos: Coords,
        pxSize: number,
        origin: { mode: "cell" | "self"; x: number; y: number },
        camera: ICamera
    ) {
        if (origin.mode === "cell") {
            const cell = camera.scale;
            return {
                x: pos.x - cell / 2 + origin.x * cell - pxSize / 2,
                y: pos.y - cell / 2 + origin.y * cell - pxSize / 2,
            };
        }

        return {
            x: pos.x - origin.x * pxSize,
            y: pos.y - origin.y * pxSize,
        };
    }
}
