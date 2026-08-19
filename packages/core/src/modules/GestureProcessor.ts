import {
    Coords,
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseLeaveCallback,
    onMouseUpCallback,
    onWheelCallback,
    onZoomCallback,
} from "../types";
import { DEFAULT_VALUES } from "../constants";
import { ICamera } from "./Camera";
import { Config } from "./Config";
import { CoordinateTransformer } from "./CoordinateTransformer";

// Below this pinch distance (px) the scale factor is degenerate: two fingers
// nearly on the same point would divide by ~0 and snap the zoom to its limit.
const MIN_PINCH_DISTANCE = 1;

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
/**
 * A key press, normalized so core never touches a DOM `KeyboardEvent`.
 * Mirrors `KeyboardEvent.key` semantics.
 */
export interface NormalizedKey {
    /** The `KeyboardEvent.key` value, e.g. `"ArrowLeft"`, `"+"`, `"Enter"`, `" "`. */
    key: string;
    shiftKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
}

/** Resolved keyboard behaviour for the current config. */
interface KeyboardSettings {
    pan: boolean;
    zoom: boolean;
    activate: boolean;
    /** Pan step in screen pixels, already resolved from `pan`/`panPx`. */
    stepPx: number;
    zoomFactor: number;
}

const DEFAULT_KEYBOARD_PAN_PX = 80;
const DEFAULT_KEYBOARD_ZOOM_FACTOR = 1.5;

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
    public onWheel?: onWheelCallback;

    constructor(
        private camera: ICamera,
        private config: Config,
        private transformer: CoordinateTransformer,
        private canvasBoundsGetter: () => CanvasBounds,
        private onCameraChange: () => void,
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
     * Fire onWheel with processed coords for the gesture position. Coords are
     * processed after the zoom is applied, so they reflect the new camera
     * state (matching onZoom, which reports the new scale).
     */
    private notifyWheel(pointer: NormalizedPointer, deltaY: number, source: "wheel" | "pinch"): void {
        if (!this.onWheel || deltaY === 0) {
            return;
        }
        const { coords, mouse, client } = this.processCoords(pointer);
        this.onWheel(coords, mouse, client, {
            deltaY,
            direction: deltaY < 0 ? "in" : "out",
            source,
        });
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

    // ─── Keyboard ──────────────────────────────────────────────

    /**
     * Resolve what the keyboard may do right now. `undefined` mirrors the
     * pointer gates so keyboard grants nothing the app did not already grant;
     * `true` forces everything on; `false` turns it off.
     */
    private keyboardSettings(): KeyboardSettings | null {
        const handlers = this.config.get().eventHandlers;
        const keyboard = handlers.keyboard;
        if (keyboard === false) {
            return null;
        }

        const forced = keyboard === true;
        const options = typeof keyboard === "object" && keyboard !== null ? keyboard : {};
        // World units convert through the live scale; the *Px form wins, per
        // the convention used everywhere else in the API.
        const stepPx =
            options.panPx ?? (options.pan !== undefined ? options.pan * this.camera.scale : DEFAULT_KEYBOARD_PAN_PX);

        return {
            // `Required<>` is shallow, so these stay optional in the type
            // even though Config always fills them.
            pan: forced || handlers.drag === true,
            zoom: forced || handlers.zoom !== false,
            activate: forced || handlers.click === true,
            stepPx,
            zoomFactor: options.zoomFactor ?? DEFAULT_KEYBOARD_ZOOM_FACTOR,
        };
    }

    /**
     * Handle a key press. Returns `true` when the engine consumed the key, so
     * the caller knows whether to `preventDefault` — nothing else is ever
     * suppressed.
     *
     * `Tab`, `Escape`, `Home`, `End`, `PageUp` and `PageDown` are deliberately
     * absent and must stay absent: leaving them to the browser is what keeps
     * the surface escapable (SC 2.1.2). Any modifier combination is ignored so
     * browser and screen-reader shortcuts keep working.
     */
    handleKeyDown = (event: NormalizedKey): boolean => {
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
            return false;
        }

        const settings = this.keyboardSettings();
        if (!settings) {
            return false;
        }

        // `pan(dx, dy)` shifts the camera by `-d/scale`, so panning the view
        // right means a negative delta.
        const step = settings.stepPx;
        switch (event.key) {
            case "ArrowLeft":
                return settings.pan && this.panBy(step, 0);
            case "ArrowRight":
                return settings.pan && this.panBy(-step, 0);
            case "ArrowUp":
                return settings.pan && this.panBy(0, step);
            case "ArrowDown":
                return settings.pan && this.panBy(0, -step);
            case "+":
            case "=":
                return settings.zoom && this.zoomBy(settings.zoomFactor);
            case "-":
            case "_":
                return settings.zoom && this.zoomBy(1 / settings.zoomFactor);
            case "Enter":
            case " ":
                return settings.activate && this.activateAtCenter();
            default:
                return false;
        }
    };

    private panBy(dx: number, dy: number): boolean {
        this.camera.pan(dx, dy);
        this.onCameraChange();
        return true;
    }

    private zoomBy(factor: number): boolean {
        const bounds = this.canvasBoundsGetter();
        const prevScale = this.camera.scale;
        this.camera.zoomByFactor(factor, bounds.width / 2, bounds.height / 2);
        // Keyboard zoom reports through onZoom only, exactly like the
        // programmatic zoomIn/zoomOut path. onWheel means "a wheel or pinch
        // gesture happened", which this is not.
        if (this.camera.scale !== prevScale) {
            this.onZoom?.(this.camera.scale);
        }
        this.onCameraChange();
        return true;
    }

    /**
     * Fire the existing `onClick` at the viewport center — a crosshair picker
     * for keyboard users. Every coordinate is truthful: the center really is
     * where the activation points, so nothing is synthesized.
     */
    private activateAtCenter(): boolean {
        if (!this.onClick) {
            return false;
        }
        const bounds = this.canvasBoundsGetter();
        const x = bounds.width / 2;
        const y = bounds.height / 2;
        const { coords, mouse, client } = this.processCoords({
            x,
            y,
            clientX: bounds.left + x,
            clientY: bounds.top + y,
        });
        this.onClick(coords, mouse, client, { source: "keyboard" });
        return true;
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
        this.onClick(coords, mouse, client, { source: "pointer" });
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

        if (pointers.length !== 1) {
            return;
        }
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
            const scaleFactor =
                this.lastPinchDistance >= MIN_PINCH_DISTANCE ? currentDistance / this.lastPinchDistance : 1;

            // Zoom anchor relative to canvas: pinch midpoint, or canvas center in "center" mode
            const centerMode = this.config.get().eventHandlers.zoom === "center";
            const centerX = centerMode ? bounds.width / 2 : currentCenter.x - bounds.left;
            const centerY = centerMode ? bounds.height / 2 : currentCenter.y - bounds.top;

            // Apply zoom
            this.camera.zoomByFactor(scaleFactor, centerX, centerY);

            // Also pan if pinch center moved. Skipped in "center" mode: fingers
            // never move symmetrically, so following the midpoint would drift
            // the camera away from the fixed anchor the mode promises.
            if (!centerMode) {
                const dx = currentCenter.x - this.lastPinchCenter.x;
                const dy = currentCenter.y - this.lastPinchCenter.y;
                if (dx !== 0 || dy !== 0) {
                    this.camera.pan(dx, dy);
                }
            }

            this.lastPinchDistance = currentDistance;
            this.lastPinchCenter = currentCenter;
            // Deltas are synthesized as the wheel delta producing the same
            // zoom factor (factor = exp(-delta * sensitivity), inverted), so
            // wheel and pinch consumers read one consistent axis.
            this.notifyWheel(
                {
                    x: currentCenter.x - bounds.left,
                    y: currentCenter.y - bounds.top,
                    clientX: currentCenter.x,
                    clientY: currentCenter.y,
                },
                scaleFactor === 1 ? 0 : -Math.log(scaleFactor) / DEFAULT_VALUES.ZOOM_SENSITIVITY,
                "pinch",
            );
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
        const zoom = this.config.get().eventHandlers.zoom;
        if (!zoom) {
            return;
        }
        const bounds = this.canvasBoundsGetter();
        const anchor =
            zoom === "center"
                ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 }
                : { x: pointer.clientX, y: pointer.clientY };
        this.camera.zoom(anchor.x, anchor.y, deltaY, bounds as DOMRect);
        this.notifyWheel(pointer, deltaY, "wheel");
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
