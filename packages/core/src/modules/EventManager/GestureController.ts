import { onClickCallback, onHoverCallback } from "../../types";
import { ICamera } from "../Camera";
import { Config } from "../Config";
import { CoordinateTransformer } from "../CoordinateTransformer";
import { ViewportState } from "../ViewportState";

/**
 * Handles gesture logic (click, hover, drag, zoom) independent of DOM binding.
 * @internal
 */
export class GestureController {
    private isDragging = false;
    private shouldPreventClick = false;
    private lastPos = { x: 0, y: 0 };

    public onClick?: onClickCallback;
    public onHover?: onHoverCallback;
    public onMouseLeave?: () => void;

    constructor(
        private canvas: HTMLCanvasElement,
        private camera: ICamera,
        private viewport: ViewportState,
        private config: Config,
        private transformer: CoordinateTransformer,
        private onCameraChange: () => void
    ) {}

    handleClick = (e: MouseEvent) => {
        if (this.shouldPreventClick) {
            this.shouldPreventClick = false;
            return;
        }
        if (!this.config.get().eventHandlers.click || !this.onClick) {
            return;
        }
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const worldCoords = this.transformer.screenToWorld(mouseX, mouseY);

        this.onClick(
            {
                raw: worldCoords,
                snapped: { x: Math.floor(worldCoords.x), y: Math.floor(worldCoords.y) },
            },
            {
                raw: { x: mouseX, y: mouseY },
                snapped: {
                    x: Math.round(mouseX / this.camera.scale) * this.camera.scale,
                    y: Math.round(mouseY / this.camera.scale) * this.camera.scale,
                },
            },
            {
                raw: { x: e.clientX, y: e.clientY },
                snapped: {
                    x: Math.round(e.clientX / this.camera.scale) * this.camera.scale,
                    y: Math.round(e.clientY / this.camera.scale) * this.camera.scale,
                },
            }
        );
    };

    handleMouseDown = (e: MouseEvent) => {
        if (!this.config.get().eventHandlers.drag) return;
        this.isDragging = true;
        this.shouldPreventClick = false;
        this.lastPos = { x: e.clientX, y: e.clientY };
    };

    handleMouseMove = (e: MouseEvent) => {
        if (!this.isDragging) {
            if (this.onHover && this.config.get().eventHandlers.hover) {
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const world = this.transformer.screenToWorld(mouseX, mouseY);
                this.onHover(
                    { raw: world, snapped: { x: Math.floor(world.x), y: Math.floor(world.y) } },
                    {
                        raw: { x: mouseX, y: mouseY },
                        snapped: {
                            x: Math.round(mouseX / this.camera.scale) * this.camera.scale,
                            y: Math.round(mouseY / this.camera.scale) * this.camera.scale,
                        },
                    },
                    {
                        raw: { x: e.clientX, y: e.clientY },
                        snapped: {
                            x: Math.round(e.clientX / this.camera.scale) * this.camera.scale,
                            y: Math.round(e.clientY / this.camera.scale) * this.camera.scale,
                        },
                    }
                );
            }
            return;
        }

        const dx = e.clientX - this.lastPos.x;
        const dy = e.clientY - this.lastPos.y;
        if (dx !== 0 || dy !== 0) {
            this.canvas.style.cursor = this.config.get().cursor.move || "move";
            this.shouldPreventClick = true;
        }
        this.camera.pan(dx, dy);
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.onCameraChange();
    };

    handleMouseUp = () => {
        if (!this.isDragging && this.onMouseLeave) {
            this.onMouseLeave();
        }
        this.isDragging = false;
        this.canvas.style.cursor = this.config.get().cursor.default || "default";
    };

    handleTouchStart = (e: TouchEvent) => {
        if (!this.config.get().eventHandlers.drag) return;
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        this.isDragging = true;
        this.shouldPreventClick = false;
        this.lastPos = { x: t.clientX, y: t.clientY };
    };

    handleTouchMove = (e: TouchEvent) => {
        if (!this.isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - this.lastPos.x;
        const dy = t.clientY - this.lastPos.y;
        if (dx !== 0 || dy !== 0) {
            this.canvas.style.cursor = this.config.get().cursor.move || "move";
            this.shouldPreventClick = true;
        }
        this.camera.pan(dx, dy);
        this.lastPos = { x: t.clientX, y: t.clientY };
        this.onCameraChange();
    };

    handleTouchEnd = () => {
        this.isDragging = false;
        this.canvas.style.cursor = this.config.get().cursor.default || "default";
    };

    handleWheel = (e: WheelEvent) => {
        if (!this.config.get().eventHandlers.zoom) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.camera.zoom(e.clientX, e.clientY, e.deltaY, rect);
        this.onCameraChange();
    };
}
