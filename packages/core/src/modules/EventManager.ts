import { Coords } from "../types";
import { Camera } from "./Camera";
import { ConfigManager } from "./ConfigManager";
import { CoordinateTransformer } from "./CoordinateTransformer";

export class EventManager {
    private isDragging = false;
    private shouldPreventClick = false;
    private lastPos = { x: 0, y: 0 };

    private wrapper?: HTMLDivElement;
    private resizeObserver?: ResizeObserver;

    public onResize?: () => void;
    public onClick?: (coords: Coords, mouse: Coords, client: Coords) => void;
    public onHover?: (coords: Coords, mouse: Coords, client: Coords) => void;

    constructor(
        private canvas: HTMLCanvasElement,
        private camera: Camera,
        private configManager: ConfigManager,
        private transformer: CoordinateTransformer,
        private onCameraChange: () => void
    ) {}

    setupEvents() {
        const config = this.configManager.get();

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
        if (config.events.resize) {
            this.setupResizeObserver();
        }
    }

    destroy() {
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
    private onMouseClick = (e: MouseEvent) => {
        if (this.shouldPreventClick) {
            this.shouldPreventClick = false;
            return;
        }

        if (!this.configManager.get().events.click || !this.onClick) {
            return;
        }

        const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
        const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;

        this.onClick(
            this.transformer.screenToWorld(mouseX, mouseY),
            {
                x: mouseX,
                y: mouseY,
            },
            { x: e.clientX, y: e.clientY }
        );
    };

    // ── Mouse Drag ────────────────────────────────

    private onMouseDown = (e: MouseEvent) => {
        if (!this.configManager.get().events.drag) {
            return;
        }

        this.isDragging = true;
        this.shouldPreventClick = false;
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = this.configManager.get().cursor.move || "move";
    };

    private onMouseMove = (e: MouseEvent) => {
        if (!this.isDragging) {
            if (this.onHover && this.configManager.get().events.hover) {
                const mouseX = e.clientX - this.canvas.getBoundingClientRect().left;
                const mouseY = e.clientY - this.canvas.getBoundingClientRect().top;
                this.onHover(
                    this.transformer.screenToWorld(mouseX, mouseY),
                    { x: mouseX, y: mouseY },
                    { x: e.clientX, y: e.clientY }
                );
            }
            return;
        }

        const dx = e.clientX - this.lastPos.x;
        const dy = e.clientY - this.lastPos.y;

        if (dx !== 0 || dy !== 0) {
            this.shouldPreventClick = true;
        }

        this.camera.pan(dx, dy);
        this.lastPos = { x: e.clientX, y: e.clientY };

        this.onCameraChange();
    };

    private onMouseUp = () => {
        this.isDragging = false;
        this.canvas.style.cursor = this.configManager.get().cursor.default || "default";
    };

    // ── Touch Drag ────────────────────────────────

    private onTouchStart = (e: TouchEvent) => {
        if (!this.configManager.get().events.drag) {
            return;
        }
        if (e.touches.length !== 1) {
            return;
        }

        const t = e.touches[0];
        this.isDragging = true;
        this.lastPos = { x: t.clientX, y: t.clientY };
        this.canvas.style.cursor = this.configManager.get().cursor.move || "move";
    };

    private onTouchMove = (e: TouchEvent) => {
        if (!this.isDragging || e.touches.length !== 1) {
            return;
        }

        e.preventDefault();
        const t = e.touches[0];
        const dx = t.clientX - this.lastPos.x;
        const dy = t.clientY - this.lastPos.y;

        this.camera.pan(dx, dy);
        this.lastPos = { x: t.clientX, y: t.clientY };

        this.onCameraChange();
    };

    private onTouchEnd = () => {
        this.isDragging = false;
        this.canvas.style.cursor = this.configManager.get().cursor.default || "default";
    };

    // ── Wheel Zoom ────────────────────────────────

    private onWheel = (e: WheelEvent) => {
        if (!this.configManager.get().events.zoom) {
            return;
        }

        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const config = this.configManager.get();

        this.camera.zoom(e.clientX, e.clientY, e.deltaY, rect);
        this.configManager.setScale(this.camera.scale);

        this.onCameraChange();
    };

    // ── Resize Observer ──────────────────────────

    private setupResizeObserver() {
        const config = this.configManager.get();

        const wrapper = document.createElement("div");
        Object.assign(wrapper.style, {
            resize: "both",
            overflow: "hidden",
            width: `${config.size.width}px`,
            height: `${config.size.height}px`,
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
                const prev = this.configManager.get();
                const diffW = width - prev.size.width;
                const diffH = height - prev.size.height;

                // Center adjustment
                this.camera.x -= diffW / (2 * this.camera.scale);
                this.camera.y -= diffH / (2 * this.camera.scale);

                this.configManager.setSize(width, height);
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
