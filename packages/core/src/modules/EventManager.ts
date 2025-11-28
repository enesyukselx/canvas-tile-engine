import { onClickCallback, onHoverCallback } from "../types";
import { ICamera } from "./Camera";
import { Config } from "./Config";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { ViewportState } from "./ViewportState";

/**
 * Attaches input events to the canvas and updates camera/config accordingly.
 * @internal
 */
export class EventManager {
    private isDragging = false;
    private shouldPreventClick = false;
    private lastPos = { x: 0, y: 0 };

    private wrapper?: HTMLDivElement;
    private resizeObserver?: ResizeObserver;

    public onResize?: () => void;
    public onClick?: onClickCallback;
    public onHover?: onHoverCallback;
    public onMouseLeave?: () => void;

    /**
     * @param canvas Target canvas element.
     * @param camera Camera to move/zoom.
     * @param config Normalized config store.
     * @param coordinateTransformer World/screen transformer.
     * @param onCameraChange Callback when camera changes.
     */
    constructor(
        private canvas: HTMLCanvasElement,
        private camera: ICamera,
        private viewport: ViewportState,
        private config: Config,
        private coordinateTransformer: CoordinateTransformer,
        private onCameraChange: () => void
    ) {}

    /**
     * Bind all configured event listeners.
     */
    setupEvents() {
        // Click
        this.canvas.addEventListener("click", this.onMouseClick);

        // Drag (Mouse)
        this.canvas.addEventListener("mousedown", this.onMouseDown);
        this.canvas.addEventListener("mousemove", this.onMouseMove);
        this.canvas.addEventListener("mouseup", this.onMouseUp);
        this.canvas.addEventListener("mouseleave", this.onMouseUp);

        // Drag (Touch)
        this.canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
        this.canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
        this.canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });

        // Zoom
        this.canvas.addEventListener("wheel", this.onWheel, { passive: false });

        // Resize
        if (this.config.get().eventHandlers.resize) {
            this.setupResizeObserver();
        }
    }

    /**
     * Remove all listeners and teardown helpers.
     */
    destroy() {
        this.canvas.removeEventListener("click", this.onMouseClick);

        this.canvas.removeEventListener("mousedown", this.onMouseDown);
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        this.canvas.removeEventListener("mouseup", this.onMouseUp);
        this.canvas.removeEventListener("mouseleave", this.onMouseUp);

        this.canvas.removeEventListener("touchstart", this.onTouchStart);
        this.canvas.removeEventListener("touchmove", this.onTouchMove);
        this.canvas.removeEventListener("touchend", this.onTouchEnd);

        this.canvas.removeEventListener("wheel", this.onWheel);

        if (this.resizeObserver && this.wrapper) {
            this.resizeObserver.unobserve(this.wrapper);
            this.resizeObserver.disconnect();
        }

        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.insertBefore(this.canvas, this.wrapper);
            this.wrapper.parentNode.removeChild(this.wrapper);
        }

        this.wrapper = undefined;
        this.resizeObserver = undefined;
    }

    // ── Click ────────────────────────────────────
    /** Handle click and emit mapped world/screen coords if enabled. */
    private onMouseClick = (e: MouseEvent) => {
        if (this.shouldPreventClick) {
            this.shouldPreventClick = false;
            return;
        }

        if (!this.config.get().eventHandlers.click || !this.onClick) {
            return;
        }

        const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
        const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;

        const worldCoords = this.coordinateTransformer.screenToWorld(mouseX, mouseY);

        this.onClick(
            {
                raw: worldCoords,
                snapped: {
                    x: Math.floor(worldCoords.x),
                    y: Math.floor(worldCoords.y),
                },
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

    // ── Mouse Drag ────────────────────────────────

    /** Start mouse drag for panning. */
    private onMouseDown = (e: MouseEvent) => {
        if (!this.config.get().eventHandlers.drag) {
            return;
        }

        this.isDragging = true;
        this.shouldPreventClick = false;
        this.lastPos = { x: e.clientX, y: e.clientY };
    };

    /** Move camera during drag; forward hover events when not dragging. */
    private onMouseMove = (e: MouseEvent) => {
        if (!this.isDragging) {
            if (this.onHover && this.config.get().eventHandlers.hover) {
                const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
                const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;
                this.onHover(
                    {
                        raw: this.coordinateTransformer.screenToWorld(mouseX, mouseY),
                        snapped: {
                            x: Math.floor(this.coordinateTransformer.screenToWorld(mouseX, mouseY).x),
                            y: Math.floor(this.coordinateTransformer.screenToWorld(mouseX, mouseY).y),
                        },
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

    /** End drag and reset cursor. */
    private onMouseUp = () => {
        if (!this.isDragging && this.onMouseLeave) {
            this.onMouseLeave();
        }
        this.isDragging = false;
        this.canvas.style.cursor = this.config.get().cursor.default || "default";
    };

    // ── Touch Drag ────────────────────────────────

    /** Start touch drag for panning. */
    private onTouchStart = (e: TouchEvent) => {
        if (!this.config.get().eventHandlers.drag) {
            return;
        }
        if (e.touches.length !== 1) {
            return;
        }

        const t = e.touches[0];
        this.isDragging = true;
        this.shouldPreventClick = false;
        this.lastPos = { x: t.clientX, y: t.clientY };
    };

    /** Move camera during touch drag. */
    private onTouchMove = (e: TouchEvent) => {
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

    /** End touch drag and reset cursor. */
    private onTouchEnd = () => {
        this.isDragging = false;
        this.canvas.style.cursor = this.config.get().cursor.default || "default";
    };

    // ── Wheel Zoom ────────────────────────────────

    /** Handle wheel zoom and sync scale to config. */
    private onWheel = (e: WheelEvent) => {
        if (!this.config.get().eventHandlers.zoom) {
            return;
        }

        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();

        this.camera.zoom(e.clientX, e.clientY, e.deltaY, rect);

        this.onCameraChange();
    };

    // ── Resize Observer ──────────────────────────

    private setupResizeObserver() {
        const wrapper = document.createElement("div");

        Object.assign(wrapper.style, {
            resize: "both",
            overflow: "hidden",
            width: `${this.viewport.getSize().width}px`,
            height: `${this.viewport.getSize().height}px`,
            touchAction: "none",
            position: "relative",
        });

        if (this.canvas.parentNode) {
            this.canvas.parentNode.insertBefore(wrapper, this.canvas);
            wrapper.appendChild(this.canvas);
        }

        this.wrapper = wrapper;

        this.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                const prev = this.viewport.getSize();
                const diffW = width - prev.width;
                const diffH = height - prev.height;

                // Center adjustment
                this.camera.adjustForResize(diffW, diffH);

                this.viewport.setSize(width, height);
                this.canvas.width = width;
                this.canvas.height = height;

                if (this.onResize) {
                    this.onResize();
                }
                this.onCameraChange();
            }
        });

        this.resizeObserver.observe(wrapper);
    }
}
