import { CanvasGridMapConfig, Coords } from "./types";
import drawCoordsOnMap from "./utils/drawCoordsOnMap";
import getInitialXCoord from "./utils/getInitialXCoord";
import getInitialYCoord from "./utils/getInitialYCoord";
import { worldToScreen } from "./utils/worldToScreen";

export class CanvasGridMap {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    config: Required<CanvasGridMapConfig>;
    coords: Coords;
    isDragging: boolean = false;
    lastPos: Coords = { x: 0, y: 0 };

    private drawFunctions: Array<
        (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasGridMapConfig>) => void
    > = [];

    constructor(canvas: HTMLCanvasElement, config: CanvasGridMapConfig, coords: Coords = { x: 0, y: 0 }) {
        this.canvas = canvas;
        canvas.width = config.size.width;
        canvas.height = config.size.height;
        const canvasContext = this.canvas.getContext("2d");

        if (!canvasContext) {
            throw new Error("Failed to get 2D context from canvas");
        }

        this.canvasContext = canvasContext;

        // Set default configuration
        this.config = {
            scale: config.scale,
            maxScale: config.maxScale,
            minScale: config.minScale,
            size: {
                width: config.size.width,
                height: config.size.height,
            },
            backgroundColor: config.backgroundColor || "#ffffff",
            events: {
                click: config.events.click ?? false,
                hover: config.events.hover ?? false,
                drag: config.events.drag ?? false,
                zoom: config.events.zoom ?? false,
                resize: config.events.resize ?? false,
            },
            showCoordinates: config.showCoordinates ?? false,
            minScaleShowCoordinates: config.minScaleShowCoordinates ?? 0,
        };

        // Initialize coordinates centered on provided coords or default
        this.coords = {
            x: getInitialXCoord(this.config.size.width, this.config.scale, coords.x),
            y: getInitialYCoord(this.config.size.height, this.config.scale, coords.y),
        };
    }

    private wrapper?: HTMLDivElement;
    private resizeObserver?: ResizeObserver;

    /** Add a custom draw function to be called in draw() */
    addDrawFunction(
        fn: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasGridMapConfig>) => void
    ) {
        this.drawFunctions.push(fn);
    }

    /** Add a rectangle to be drawn */
    drawRect(x: number, y: number, style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number }) {
        this.addDrawFunction((ctx) => {
            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;
            ctx.beginPath();
            ctx.rect(
                worldToScreen(x, y, this.coords, this.config.scale).x,
                worldToScreen(x, y, this.coords, this.config.scale).y,
                this.config.scale,
                this.config.scale
            );
            if (style?.fillStyle) ctx.fill();
            if (style?.strokeStyle) ctx.stroke();
        });
    }

    /** Add a line to be drawn */
    drawLine(x1: number, y1: number, x2: number, y2: number, style?: { strokeStyle?: string; lineWidth?: number }) {
        this.addDrawFunction((ctx) => {
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;
            ctx.beginPath();
            const start = worldToScreen(x1, y1, this.coords, this.config.scale);
            const end = worldToScreen(x2, y2, this.coords, this.config.scale);
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        });
    }

    /** Add a circle to be drawn */
    drawCircle(
        x: number,
        y: number,
        radius: number,
        style?: { fillStyle?: string; strokeStyle?: string; lineWidth?: number }
    ) {
        this.addDrawFunction((ctx) => {
            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;
            ctx.beginPath();
            const center = worldToScreen(x + 0.5, y + 0.5, this.coords, this.config.scale);
            const maxRadius = Math.min(this.config.size.width, this.config.size.height) / 2 / this.config.scale;
            const safeRadius = Math.min(radius, maxRadius);
            ctx.arc(center.x, center.y, safeRadius * this.config.scale, 0, 2 * Math.PI);
            if (style?.fillStyle) ctx.fill();
            if (style?.strokeStyle) ctx.stroke();
        });
    }

    drawText(
        text: string,
        x: number,
        y: number,
        style?: { font?: string; fillStyle?: string; textAlign?: CanvasTextAlign; textBaseline?: CanvasTextBaseline }
    ) {
        this.addDrawFunction((ctx) => {
            if (style?.font) ctx.font = style.font;
            if (style?.fillStyle) ctx.fillStyle = style.fillStyle;
            ctx.textAlign = style?.textAlign ?? "center";
            ctx.textBaseline = style?.textBaseline ?? "middle";
            const pos = worldToScreen(x + 0.5, y + 0.5, this.coords, this.config.scale);
            ctx.fillText(text, pos.x, pos.y);
        });
    }

    /** Add a path to be drawn (array of grid coords) */
    drawPath(points: Array<{ x: number; y: number }>, style?: { strokeStyle?: string; lineWidth?: number }) {
        this.addDrawFunction((ctx) => {
            if (style?.strokeStyle) ctx.strokeStyle = style.strokeStyle;
            if (style?.lineWidth) ctx.lineWidth = style.lineWidth;
            if (!points.length) {
                return;
            }
            ctx.beginPath();
            // First point
            const first = worldToScreen(points[0].x + 0.5, points[0].y + 0.5, this.coords, this.config.scale);
            ctx.moveTo(first.x, first.y);
            // Draw the other points
            for (let i = 1; i < points.length; i++) {
                const p = worldToScreen(points[i].x + 0.5, points[i].y + 0.5, this.coords, this.config.scale);
                ctx.lineTo(p.x, p.y);
            }
            ctx.stroke();
        });
    }

    drawImage() {
        // To be implemented
    }

    setupEvents() {
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
        if (this.config.events.resize) {
            // Create a wrapper div and apply styles
            const wrapper = document.createElement("div");
            Object.assign(wrapper.style, {
                resize: "both",
                overflow: "hidden",
                width: `${this.config.size.width}px`,
                height: `${this.config.size.height}px`,
                touchAction: "none",
                position: "relative",
            });

            // Insert wrapper before canvas and move canvas inside wrapper
            if (this.canvas.parentNode) {
                this.canvas.parentNode.insertBefore(wrapper, this.canvas);
                wrapper.appendChild(this.canvas);
            }

            this.wrapper = wrapper;

            // Observe resize events
            this.resizeObserver = new ResizeObserver((entries) => {
                for (let entry of entries) {
                    const { width, height } = entry.contentRect;
                    this.config.size.width = width;
                    this.config.size.height = height;
                    this.canvas.width = width;
                    this.canvas.height = height;
                    this.render();
                }
            });
            this.resizeObserver.observe(wrapper);

            return () => {
                if (this.resizeObserver && this.wrapper) {
                    this.resizeObserver.unobserve(this.wrapper);
                }
            };
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

        // Optionally remove wrapper from DOM
        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.insertBefore(this.canvas, this.wrapper);
            this.wrapper.parentNode.removeChild(this.wrapper);
        }

        this.wrapper = undefined;
        this.resizeObserver = undefined;
    }

    onMouseDown = (e: MouseEvent) => {
        if (!this.config.events.drag) {
            return;
        }

        this.isDragging = true;
        this.lastPos = { x: e.clientX, y: e.clientY };
        this.canvas.style.cursor = "grabbing";
    };

    onMouseMove = (e: MouseEvent) => {
        if (!this.isDragging) {
            return;
        }

        const dx = e.clientX - this.lastPos.x;
        const dy = e.clientY - this.lastPos.y;
        this.coords.x -= dx / this.config.scale;
        this.coords.y -= dy / this.config.scale;
        this.lastPos = { x: e.clientX, y: e.clientY };

        this.render();
    };

    onMouseUp = () => {
        this.isDragging = false;
        this.canvas.style.cursor = "grab";
    };

    // Touch Events
    onTouchStart = (e: TouchEvent) => {
        if (!this.config.events.drag) {
            return;
        }
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastPos = {
                x: e.touches[0].clientX,
                y: e.touches[0].clientY,
            };
            this.canvas.style.cursor = "grabbing";
        }
    };

    onTouchMove = (e: TouchEvent) => {
        if (!this.isDragging || e.touches.length !== 1) {
            return;
        }

        e.preventDefault();

        const touch = e.touches[0];
        const dx = touch.clientX - this.lastPos.x;
        const dy = touch.clientY - this.lastPos.y;
        this.coords.x -= dx / this.config.scale;
        this.coords.y -= dy / this.config.scale;
        this.lastPos = { x: touch.clientX, y: touch.clientY };

        this.render();
    };

    onTouchEnd = (e: TouchEvent) => {
        this.isDragging = false;
        this.canvas.style.cursor = "grab";
    };

    onWheel = (e: WheelEvent) => {
        if (!this.config.events.zoom) {
            return;
        }

        e.preventDefault();

        const zoomSensitivity = 0.001;
        const scaleFactor = Math.exp(-Math.min(Math.max(e.deltaY, -100), 100) * zoomSensitivity);
        const currentScale = this.config.scale;
        const newScale = Math.min(Math.max(this.config.minScale, currentScale * scaleFactor), this.config.maxScale);

        // Mouse position relative to canvas
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // World coords adjustment
        this.coords.x += mouseX * (1 / currentScale - 1 / newScale);
        this.coords.y += mouseY * (1 / currentScale - 1 / newScale);

        this.config.scale = newScale;

        this.render();
    };

    render() {
        // Clear canvas
        this.canvasContext.clearRect(0, 0, this.config.size.width, this.config.size.height);
        // Draw background
        this.canvasContext.fillStyle = this.config.backgroundColor;
        this.canvasContext.fillRect(0, 0, this.config.size.width, this.config.size.height);
        // Call all draw functions

        for (const fn of this.drawFunctions) {
            fn(this.canvasContext, this.coords, this.config);
        }

        // Coordinates
        if (this.config.showCoordinates && this.config.scale >= this.config.minScaleShowCoordinates) {
            drawCoordsOnMap({
                ctx: this.canvasContext,
                coords: this.coords,
                mapConfig: this.config,
            });
        }
    }
}
