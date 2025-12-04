import { Coords, DrawObject, CanvasTileEngineConfig } from "../types";
import { ICamera } from "./Camera";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { Layer } from "./Layer";
import { DEFAULT_VALUES, VISIBILITY_BUFFER } from "../constants";

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

    private isVisible(
        x: number,
        y: number,
        sizeWorld: number,
        topLeft: Coords,
        config: Required<CanvasTileEngineConfig>
    ) {
        const viewW = config.size.width / config.scale;
        const viewH = config.size.height / config.scale;
        const minX = topLeft.x - VISIBILITY_BUFFER.TILE_BUFFER;
        const minY = topLeft.y - VISIBILITY_BUFFER.TILE_BUFFER;
        const maxX = topLeft.x + viewW + VISIBILITY_BUFFER.TILE_BUFFER;
        const maxY = topLeft.y + viewH + VISIBILITY_BUFFER.TILE_BUFFER;
        return x + sizeWorld >= minX && x - sizeWorld <= maxX && y + sizeWorld >= minY && y - sizeWorld <= maxY;
    }

    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void,
        layer: number = 1
    ) {
        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            fn(ctx, topLeft, config);
        });
    }

    drawRect(items: Array<DrawObject> | DrawObject, layer: number = 1) {
        const list = Array.isArray(items) ? items : [items];

        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            for (const item of list) {
                const size = item.size ?? 1;
                const origin = {
                    mode: item.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                    x: item.origin?.x ?? 0.5,
                    y: item.origin?.y ?? 0.5,
                };
                const style = item.style;

                if (!this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;

                const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

                ctx.save();
                if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
                if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
                if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

                ctx.beginPath();
                ctx.rect(drawX, drawY, pxSize, pxSize);
                if (style?.fillStyle) ctx.fill();
                if (style?.strokeStyle) ctx.stroke();
                ctx.restore();
            }
        });
    }

    drawLine(
        items: Array<{ from: Coords; to: Coords }> | { from: Coords; to: Coords },
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ) {
        const list = Array.isArray(items) ? items : [items];

        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            ctx.save();
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

            ctx.beginPath();
            for (const item of list) {
                const centerX = (item.from.x + item.to.x) / 2;
                const centerY = (item.from.y + item.to.y) / 2;
                const halfExtent = Math.max(Math.abs(item.from.x - item.to.x), Math.abs(item.from.y - item.to.y)) / 2;
                if (!this.isVisible(centerX, centerY, halfExtent, topLeft, config)) continue;

                const a = this.transformer.worldToScreen(item.from.x, item.from.y);
                const b = this.transformer.worldToScreen(item.to.x, item.to.y);

                ctx.moveTo(a.x, a.y);
                ctx.lineTo(b.x, b.y);
            }
            ctx.stroke();
            ctx.restore();
        });
    }

    drawCircle(items: Array<DrawObject> | DrawObject, layer: number = 1) {
        const list = Array.isArray(items) ? items : [items];

        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            for (const item of list) {
                const size = item.size ?? 1;
                const origin = {
                    mode: item.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                    x: item.origin?.x ?? 0.5,
                    y: item.origin?.y ?? 0.5,
                };
                const style = item.style;

                if (!this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;
                const radius = pxSize / 2;

                const { x: drawX, y: drawY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

                ctx.save();
                if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
                if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
                if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

                ctx.beginPath();
                ctx.arc(drawX + radius, drawY + radius, radius, 0, Math.PI * 2);
                if (style?.fillStyle) ctx.fill();
                if (style?.strokeStyle) ctx.stroke();
                ctx.restore();
            }
        });
    }

    drawText(
        items: Array<{ coords: Coords; text: string }> | { coords: Coords; text: string },
        style?: { fillStyle?: string; font?: string; textAlign?: CanvasTextAlign; textBaseline?: CanvasTextBaseline },
        layer: number = 2
    ) {
        const list = Array.isArray(items) ? items : [items];

        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            ctx.save();
            if (style?.font) ctx.font = style.font;
            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            ctx.textAlign = style?.textAlign ?? "center";
            ctx.textBaseline = style?.textBaseline ?? "middle";

            for (const item of list) {
                if (!this.isVisible(item.coords.x, item.coords.y, 0, topLeft, config)) continue;
                const pos = this.transformer.worldToScreen(item.coords.x, item.coords.y);
                ctx.fillText(item.text, pos.x, pos.y);
            }
            ctx.restore();
        });
    }

    drawPath(
        items: Array<Coords[]> | Coords[],
        style?: { strokeStyle?: string; lineWidth?: number },
        layer: number = 1
    ) {
        const list = Array.isArray(items[0]) ? (items as Array<Coords[]>) : [items as Coords[]];

        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            ctx.save();
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;

            ctx.beginPath();
            for (const points of list) {
                if (!points.length) continue;
                const xs = points.map((p) => p.x);
                const ys = points.map((p) => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const centerX = (minX + maxX) / 2;
                const centerY = (minY + maxY) / 2;
                const halfExtent = Math.max(maxX - minX, maxY - minY) / 2;
                if (!this.isVisible(centerX, centerY, halfExtent, topLeft, config)) continue;

                const first = this.transformer.worldToScreen(points[0].x, points[0].y);
                ctx.moveTo(first.x, first.y);

                for (let i = 1; i < points.length; i++) {
                    const p = this.transformer.worldToScreen(points[i].x, points[i].y);
                    ctx.lineTo(p.x, p.y);
                }
            }
            ctx.stroke();
            ctx.restore();
        });
    }

    drawImage(
        items:
            | Array<Omit<DrawObject, "style"> & { img: HTMLImageElement }>
            | (Omit<DrawObject, "style"> & { img: HTMLImageElement }),
        layer: number = 1
    ) {
        const list = Array.isArray(items) ? items : [items];

        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            for (const item of list) {
                const size = item.size ?? 1;
                const origin = {
                    mode: item.origin?.mode === "self" ? "self" : ("cell" as "cell" | "self"),
                    x: item.origin?.x ?? 0.5,
                    y: item.origin?.y ?? 0.5,
                };

                if (!this.isVisible(item.x, item.y, size / 2, topLeft, config)) continue;

                const pos = this.transformer.worldToScreen(item.x, item.y);
                const pxSize = size * this.camera.scale;

                // preserve aspect
                const aspect = item.img.width / item.img.height;

                let drawW = pxSize;
                let drawH = pxSize;

                if (aspect > 1) drawH = pxSize / aspect;
                else drawW = pxSize * aspect;

                // origin SELF/CELL
                const { x: baseX, y: baseY } = this.computeOriginOffset(pos, pxSize, origin, this.camera);

                const offsetX = baseX + (pxSize - drawW) / 2;
                const offsetY = baseY + (pxSize - drawH) / 2;

                ctx.drawImage(item.img, offsetX, offsetY, drawW, drawH);
            }
        });
    }

    drawGridLines(cellSize: number, style: { strokeStyle: string; lineWidth: number }, layer: number = 0) {
        this.layers.add(layer, ({ ctx, config, topLeft }) => {
            const viewW = config.size.width / config.scale;
            const viewH = config.size.height / config.scale;

            const startX = Math.floor(topLeft.x / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endX = Math.ceil((topLeft.x + viewW) / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const startY = Math.floor(topLeft.y / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;
            const endY = Math.ceil((topLeft.y + viewH) / cellSize) * cellSize - DEFAULT_VALUES.CELL_CENTER_OFFSET;

            ctx.save();

            ctx.strokeStyle = style.strokeStyle;
            ctx.lineWidth = style.lineWidth;

            ctx.beginPath();

            for (let x = startX; x <= endX; x += cellSize) {
                const p1 = this.transformer.worldToScreen(x, startY);
                const p2 = this.transformer.worldToScreen(x, endY);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }

            for (let y = startY; y <= endY; y += cellSize) {
                const p1 = this.transformer.worldToScreen(startX, y);
                const p2 = this.transformer.worldToScreen(endX, y);
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
            }

            ctx.stroke();
            ctx.restore();
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
