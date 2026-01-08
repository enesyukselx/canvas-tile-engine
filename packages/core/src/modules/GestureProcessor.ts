import {
    Coords,
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseLeaveCallback,
    onMouseUpCallback,
    onZoomCallback,
} from "../types";
import { ICamera } from "./Camera";
import { Config } from "./Config";
import { CoordinateTransformer } from "./CoordinateTransformer";

/**
 * Normalized pointer input - renderer-agnostic format.
 * All coordinates should be canvas-relative.
 */
export interface NormalizedPointer {
    /** X position relative to canvas */
    x: number;
    /** Y position relative to canvas */
    y: number;
    /** X position relative to viewport (for callbacks) */
    clientX: number;
    /** Y position relative to viewport (for callbacks) */
    clientY: number;
}

/**
 * Normalized multi-pointer input for pinch gestures.
 */
export interface NormalizedPinch {
    /** First pointer */
    pointer1: NormalizedPointer;
    /** Second pointer */
    pointer2: NormalizedPointer;
}

/**
 * Processed coordinate result for callbacks.
 */
export interface ProcessedCoords {
    coords: {
        raw: Coords;
        snapped: Coords;
    };
    mouse: {
        raw: Coords;
        snapped: Coords;
    };
    client: {
        raw: Coords;
        snapped: Coords;
    };
}

/**
 * Canvas bounds for zoom calculation.
 * Compatible with DOMRect subset needed by Camera.zoom
 */
export interface CanvasBounds {
    left: number;
    top: number;
    width: number;
    height: number;
    x: number;
    y: number;
    bottom: number;
    right: number;
}

/**
 * Handles gesture logic (click, hover, drag, zoom) independent of DOM/platform.
 * Receives normalized input from renderer and performs calculations.
 */
export class GestureProcessor {
    // Gesture state
    private isDragging = false;
    private shouldPreventClick = false;
    private lastPos = { x: 0, y: 0 };

    // Pinch-to-zoom state
    private isPinching = false;
    private lastPinchDistance = 0;
    private lastPinchCenter = { x: 0, y: 0 };

    // User callbacks
    public onClick?: onClickCallback;
    public onRightClick?: onRightClickCallback;
    public onHover?: onHoverCallback;
    public onMouseDown?: onMouseDownCallback;
    public onMouseUp?: onMouseUpCallback;
    public onMouseLeave?: onMouseLeaveCallback;
    public onZoom?: onZoomCallback;

    constructor(
        private camera: ICamera,
        private config: Config,
        private transformer: CoordinateTransformer,
        private canvasBoundsGetter: () => CanvasBounds,
        private onCameraChange: () => void
    ) {}

    /**
     * Process pointer coordinates into world/screen coords for callbacks.
     */
    private processCoords(pointer: NormalizedPointer): ProcessedCoords {
        const world = this.transformer.screenToWorld(pointer.x, pointer.y);
        const screen = this.transformer.worldToScreen(Math.floor(world.x), Math.floor(world.y));
        const bounds = this.canvasBoundsGetter();

        return {
            coords: {
                raw: world,
                snapped: { x: Math.floor(world.x), y: Math.floor(world.y) },
            },
            mouse: {
                raw: { x: pointer.x, y: pointer.y },
                snapped: { x: screen.x, y: screen.y },
            },
            client: {
                raw: { x: pointer.clientX, y: pointer.clientY },
                snapped: {
                    x: screen.x + bounds.left,
                    y: screen.y + bounds.top,
                },
            },
        };
    }

    /**
     * Calculate distance between two pointers.
     */
    private getPointerDistance(p1: NormalizedPointer, p2: NormalizedPointer): number {
        const dx = p2.clientX - p1.clientX;
        const dy = p2.clientY - p1.clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Calculate center point between two pointers (in client coords).
     */
    private getPointerCenter(p1: NormalizedPointer, p2: NormalizedPointer): { x: number; y: number } {
        return {
            x: (p1.clientX + p2.clientX) / 2,
            y: (p1.clientY + p2.clientY) / 2,
        };
    }

    // ─── Single Pointer Handlers ───────────────────────────────

    handleClick = (pointer: NormalizedPointer): void => {
        if (this.shouldPreventClick) {
            this.shouldPreventClick = false;
            return;
        }
        if (!this.config.get().eventHandlers.click || !this.onClick) {
            return;
        }
        const { coords, mouse, client } = this.processCoords(pointer);
        this.onClick(coords, mouse, client);
    };

    handleRightClick = (pointer: NormalizedPointer): void => {
        if (!this.config.get().eventHandlers.rightClick || !this.onRightClick) {
            return;
        }
        const { coords, mouse, client } = this.processCoords(pointer);
        this.onRightClick(coords, mouse, client);
    };

    handlePointerDown = (pointer: NormalizedPointer): void => {
        if (this.onMouseDown) {
            const { coords, mouse, client } = this.processCoords(pointer);
            this.onMouseDown(coords, mouse, client);
        }

        if (!this.config.get().eventHandlers.drag) {
            return;
        }

        this.isDragging = true;
        this.shouldPreventClick = false;
        this.lastPos = { x: pointer.clientX, y: pointer.clientY };
    };

    handlePointerMove = (pointer: NormalizedPointer): void => {
        if (!this.isDragging) {
            if (this.onHover && this.config.get().eventHandlers.hover) {
                const { coords, mouse, client } = this.processCoords(pointer);
                this.onHover(coords, mouse, client);
            }
            return;
        }

        const dx = pointer.clientX - this.lastPos.x;
        const dy = pointer.clientY - this.lastPos.y;
        if (dx !== 0 || dy !== 0) {
            this.shouldPreventClick = true;
        }
        this.camera.pan(dx, dy);
        this.lastPos = { x: pointer.clientX, y: pointer.clientY };
        this.onCameraChange();
    };

    handlePointerUp = (pointer: NormalizedPointer): void => {
        if (this.onMouseUp) {
            const { coords, mouse, client } = this.processCoords(pointer);
            this.onMouseUp(coords, mouse, client);
        }

        this.isDragging = false;
    };

    handlePointerLeave = (pointer: NormalizedPointer): void => {
        if (this.onMouseLeave) {
            const { coords, mouse, client } = this.processCoords(pointer);
            this.onMouseLeave(coords, mouse, client);
        }

        this.isDragging = false;
    };

    // ─── Touch Handlers ───────────────────────────────

    handleTouchStart = (pointers: NormalizedPointer[]): void => {
        const eventHandlers = this.config.get().eventHandlers;

        // Handle pinch-to-zoom (2 fingers)
        if (pointers.length === 2 && eventHandlers.zoom) {
            this.isPinching = true;
            this.isDragging = false;
            this.shouldPreventClick = true;
            this.lastPinchDistance = this.getPointerDistance(pointers[0], pointers[1]);
            this.lastPinchCenter = this.getPointerCenter(pointers[0], pointers[1]);
            return;
        }

        if (pointers.length !== 1) return;
        const pointer = pointers[0];

        // Fire onMouseDown callback for touch
        if (this.onMouseDown) {
            const { coords, mouse, client } = this.processCoords(pointer);
            this.onMouseDown(coords, mouse, client);
        }

        // Handle single finger drag
        if (!eventHandlers.drag) {
            return;
        }
        this.isDragging = true;
        this.isPinching = false;
        this.shouldPreventClick = false;
        this.lastPos = { x: pointer.clientX, y: pointer.clientY };
    };

    handleTouchMove = (pointers: NormalizedPointer[]): void => {
        // Handle pinch-to-zoom
        if (this.isPinching && pointers.length === 2) {
            const currentDistance = this.getPointerDistance(pointers[0], pointers[1]);
            const currentCenter = this.getPointerCenter(pointers[0], pointers[1]);
            const bounds = this.canvasBoundsGetter();

            // Calculate zoom factor from pinch distance change
            const scaleFactor = currentDistance / this.lastPinchDistance;

            // Get pinch center relative to canvas
            const centerX = currentCenter.x - bounds.left;
            const centerY = currentCenter.y - bounds.top;

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

        if (pointers.length !== 1) {
            return;
        }

        const pointer = pointers[0];

        // Fire onHover callback for touch move
        if (this.onHover && this.config.get().eventHandlers.hover) {
            const { coords, mouse, client } = this.processCoords(pointer);
            this.onHover(coords, mouse, client);
        }

        // Handle single finger drag
        if (!this.isDragging) {
            return;
        }
        const dx = pointer.clientX - this.lastPos.x;
        const dy = pointer.clientY - this.lastPos.y;
        if (dx !== 0 || dy !== 0) {
            this.shouldPreventClick = true;
        }
        this.camera.pan(dx, dy);
        this.lastPos = { x: pointer.clientX, y: pointer.clientY };
        this.onCameraChange();
    };

    handleTouchEnd = (remainingPointers: NormalizedPointer[], changedPointer?: NormalizedPointer): void => {
        // If we still have 2 fingers, stay in pinch mode
        if (remainingPointers.length >= 2 && this.isPinching) {
            this.lastPinchDistance = this.getPointerDistance(remainingPointers[0], remainingPointers[1]);
            this.lastPinchCenter = this.getPointerCenter(remainingPointers[0], remainingPointers[1]);
            return;
        }

        // If we have 1 finger left after pinching, switch to drag mode
        if (remainingPointers.length === 1 && this.isPinching) {
            this.isPinching = false;
            if (this.config.get().eventHandlers.drag) {
                this.isDragging = true;
                const pointer = remainingPointers[0];
                this.lastPos = { x: pointer.clientX, y: pointer.clientY };
            }
            return;
        }

        // Fire onMouseUp for touch end
        if (changedPointer && this.onMouseUp) {
            const { coords, mouse, client } = this.processCoords(changedPointer);
            this.onMouseUp(coords, mouse, client);
        }

        // Fire onClick for tap gesture (touch end without drag)
        if (changedPointer && !this.shouldPreventClick && this.config.get().eventHandlers.click && this.onClick) {
            const { coords, mouse, client } = this.processCoords(changedPointer);
            this.onClick(coords, mouse, client);
        }

        // All fingers lifted
        this.isDragging = false;
        this.isPinching = false;
        this.shouldPreventClick = false;
    };

    // ─── Wheel Zoom Handler ───────────────────────────────

    handleWheel = (pointer: NormalizedPointer, deltaY: number): void => {
        if (!this.config.get().eventHandlers.zoom) return;
        const bounds = this.canvasBoundsGetter();
        this.camera.zoom(pointer.clientX, pointer.clientY, deltaY, bounds as DOMRect);
        if (this.onZoom) {
            this.onZoom(this.camera.scale);
        }
        this.onCameraChange();
    };

    // ─── State Queries ───────────────────────────────

    get dragging(): boolean {
        return this.isDragging;
    }

    get pinching(): boolean {
        return this.isPinching;
    }
}
