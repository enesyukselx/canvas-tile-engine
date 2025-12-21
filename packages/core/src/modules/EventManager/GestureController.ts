import {
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseLeaveCallback,
    onMouseUpCallback,
    onZoomCallback,
} from "../../types";
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

    // Pinch-to-zoom state
    private isPinching = false;
    private lastPinchDistance = 0;
    private lastPinchCenter = { x: 0, y: 0 };

    public onClick?: onClickCallback;
    public onRightClick?: onRightClickCallback;
    public onHover?: onHoverCallback;
    public onMouseDown?: onMouseDownCallback;
    public onMouseUp?: onMouseUpCallback;
    public onMouseLeave?: onMouseLeaveCallback;
    public onZoom?: onZoomCallback;

    constructor(
        private canvas: HTMLCanvasElement,
        private camera: ICamera,
        private viewport: ViewportState,
        private config: Config,
        private transformer: CoordinateTransformer,
        private onCameraChange: () => void
    ) {}

    private getEventCoords = (e: MouseEvent | { clientX: number; clientY: number }) => {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const world = this.transformer.screenToWorld(mouseX, mouseY);
        const screen = this.transformer.worldToScreen(Math.floor(world.x), Math.floor(world.y));

        return {
            coords: {
                raw: world,
                snapped: { x: Math.floor(world.x), y: Math.floor(world.y) },
            },
            mouse: {
                raw: { x: mouseX, y: mouseY },
                snapped: {
                    x: screen.x,
                    y: screen.y,
                },
            },
            client: {
                raw: { x: e.clientX, y: e.clientY },
                snapped: {
                    x: screen.x + rect.left,
                    y: screen.y + rect.top,
                },
            },
        };
    };

    handleClick = (e: MouseEvent) => {
        if (this.shouldPreventClick) {
            this.shouldPreventClick = false;
            return;
        }
        if (!this.config.get().eventHandlers.click || !this.onClick) {
            return;
        }
        const { coords, mouse, client } = this.getEventCoords(e);
        this.onClick(coords, mouse, client);
    };

    handleContextMenu = (e: MouseEvent) => {
        if (!this.config.get().eventHandlers.rightClick || !this.onRightClick) {
            return;
        }
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        const world = this.transformer.screenToWorld(mouseX, mouseY);
        const screen = this.transformer.worldToScreen(Math.floor(world.x), Math.floor(world.y));

        this.onRightClick(
            {
                raw: world,
                snapped: { x: Math.floor(world.x), y: Math.floor(world.y) },
            },
            {
                raw: { x: e.clientX - rect.left, y: e.clientY - rect.top },
                snapped: {
                    x: screen.x,
                    y: screen.y,
                },
            },
            {
                raw: { x: e.clientX, y: e.clientY },
                snapped: {
                    x: screen.x + rect.left,
                    y: screen.y + rect.top,
                },
            }
        );
    };

    handleMouseDown = (e: MouseEvent) => {
        if (this.onMouseDown) {
            const { coords, mouse, client } = this.getEventCoords(e);
            this.onMouseDown(coords, mouse, client);
        }

        if (!this.config.get().eventHandlers.drag) {
            return;
        }

        this.isDragging = true;
        this.shouldPreventClick = false;
        this.lastPos = { x: e.clientX, y: e.clientY };
    };

    handleMouseMove = (e: MouseEvent) => {
        if (!this.isDragging) {
            if (this.onHover && this.config.get().eventHandlers.hover) {
                const { coords, mouse, client } = this.getEventCoords(e);

                this.onHover(coords, mouse, client);
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

    handleMouseUp = (e: MouseEvent) => {
        if (this.onMouseUp) {
            const { coords, mouse, client } = this.getEventCoords(e);
            this.onMouseUp(coords, mouse, client);
        }

        this.isDragging = false;
        this.canvas.style.cursor = this.config.get().cursor.default || "default";
    };

    handleMouseLeave = (e: MouseEvent) => {
        if (this.onMouseLeave) {
            const { coords, mouse, client } = this.getEventCoords(e);
            this.onMouseLeave(coords, mouse, client);
        }

        this.isDragging = false;
        this.canvas.style.cursor = this.config.get().cursor.default || "default";
    };

    handleTouchStart = (e: TouchEvent) => {
        const eventHandlers = this.config.get().eventHandlers;

        // Handle pinch-to-zoom (2 fingers)
        if (e.touches.length === 2 && eventHandlers.zoom) {
            e.preventDefault();
            this.isPinching = true;
            this.isDragging = false;
            this.lastPinchDistance = this.getTouchDistance(e.touches);
            this.lastPinchCenter = this.getTouchCenter(e.touches);
            return;
        }

        // Handle single finger drag
        if (!eventHandlers.drag) return;
        if (e.touches.length !== 1) return;
        const t = e.touches[0];
        this.isDragging = true;
        this.isPinching = false;
        this.shouldPreventClick = false;
        this.lastPos = { x: t.clientX, y: t.clientY };
    };

    handleTouchMove = (e: TouchEvent) => {
        // Handle pinch-to-zoom
        if (this.isPinching && e.touches.length === 2) {
            e.preventDefault();

            const currentDistance = this.getTouchDistance(e.touches);
            const currentCenter = this.getTouchCenter(e.touches);
            const rect = this.canvas.getBoundingClientRect();

            // Calculate zoom factor from pinch distance change
            const scaleFactor = currentDistance / this.lastPinchDistance;

            // Get pinch center relative to canvas
            const centerX = currentCenter.x - rect.left;
            const centerY = currentCenter.y - rect.top;

            // Apply zoom
            this.camera.zoomByFactor(scaleFactor, centerX, centerY);

            // Also pan if pinch center moved
            const dx = currentCenter.x - this.lastPinchCenter.x;
            const dy = currentCenter.y - this.lastPinchCenter.y;
            if (dx !== 0 || dy !== 0) {
                this.camera.pan(dx, dy);
            }

            this.lastPinchDistance = currentDistance;
            this.lastPinchCenter = currentCenter;
            if (this.onZoom) {
                this.onZoom(this.camera.scale);
            }
            this.onCameraChange();
            return;
        }

        // Handle single finger drag
        if (!this.isDragging || e.touches.length !== 1) {
            return;
        }
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

    handleTouchEnd = (e: TouchEvent) => {
        // If we still have 2 fingers, stay in pinch mode
        if (e.touches.length >= 2 && this.isPinching) {
            this.lastPinchDistance = this.getTouchDistance(e.touches);
            this.lastPinchCenter = this.getTouchCenter(e.touches);
            return;
        }

        // If we have 1 finger left after pinching, switch to drag mode
        if (e.touches.length === 1 && this.isPinching) {
            this.isPinching = false;
            if (this.config.get().eventHandlers.drag) {
                this.isDragging = true;
                const t = e.touches[0];
                this.lastPos = { x: t.clientX, y: t.clientY };
            }
            return;
        }

        // All fingers lifted
        this.isDragging = false;
        this.isPinching = false;
        this.canvas.style.cursor = this.config.get().cursor.default || "default";
    };

    /**
     * Calculate the distance between two touch points.
     */
    private getTouchDistance(touches: TouchList): number {
        const dx = touches[1].clientX - touches[0].clientX;
        const dy = touches[1].clientY - touches[0].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate the center point between two touches.
     */
    private getTouchCenter(touches: TouchList): { x: number; y: number } {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2,
        };
    }

    handleWheel = (e: WheelEvent) => {
        if (!this.config.get().eventHandlers.zoom) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        this.camera.zoom(e.clientX, e.clientY, e.deltaY, rect);
        if (this.onZoom) {
            this.onZoom(this.camera.scale);
        }
        this.onCameraChange();
    };
}
