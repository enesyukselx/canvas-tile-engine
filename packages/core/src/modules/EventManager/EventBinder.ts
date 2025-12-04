type HandlerMap = {
    click?: (e: MouseEvent) => void;
    mousedown?: (e: MouseEvent) => void;
    mousemove?: (e: MouseEvent) => void;
    mouseup?: (e: MouseEvent) => void;
    mouseleave?: (e: MouseEvent) => void;
    wheel?: (e: WheelEvent) => void;
    touchstart?: (e: TouchEvent) => void;
    touchmove?: (e: TouchEvent) => void;
    touchend?: (e: TouchEvent) => void;
};

/**
 * Thin wrapper to attach/detach DOM event listeners on the canvas.
 * @internal
 */
export class EventBinder {
    constructor(private canvas: HTMLCanvasElement, private handlers: HandlerMap) {}

    attach() {
        if (this.handlers.click) {
            this.canvas.addEventListener("click", this.handlers.click);
        }

        if (this.handlers.mousedown) {
            this.canvas.addEventListener("mousedown", this.handlers.mousedown);
        }

        if (this.handlers.mousemove) {
            this.canvas.addEventListener("mousemove", this.handlers.mousemove);
        }

        if (this.handlers.mouseup) {
            this.canvas.addEventListener("mouseup", this.handlers.mouseup);
        }

        if (this.handlers.mouseleave) {
            this.canvas.addEventListener("mouseleave", this.handlers.mouseleave);
        }

        if (this.handlers.wheel) {
            this.canvas.addEventListener("wheel", this.handlers.wheel, { passive: false });
        }

        if (this.handlers.touchstart) {
            this.canvas.addEventListener("touchstart", this.handlers.touchstart, { passive: false });
        }

        if (this.handlers.touchmove) {
            this.canvas.addEventListener("touchmove", this.handlers.touchmove, { passive: false });
        }

        if (this.handlers.touchend) {
            this.canvas.addEventListener("touchend", this.handlers.touchend, { passive: false });
        }
    }

    detach() {
        if (this.handlers.click) {
            this.canvas.removeEventListener("click", this.handlers.click);
        }

        if (this.handlers.mousedown) {
            this.canvas.removeEventListener("mousedown", this.handlers.mousedown);
        }

        if (this.handlers.mousemove) {
            this.canvas.removeEventListener("mousemove", this.handlers.mousemove);
        }

        if (this.handlers.mouseup) {
            this.canvas.removeEventListener("mouseup", this.handlers.mouseup);
        }

        if (this.handlers.mouseleave) {
            this.canvas.removeEventListener("mouseleave", this.handlers.mouseleave);
        }

        if (this.handlers.wheel) {
            this.canvas.removeEventListener("wheel", this.handlers.wheel);
        }

        if (this.handlers.touchstart) {
            this.canvas.removeEventListener("touchstart", this.handlers.touchstart);
        }

        if (this.handlers.touchmove) {
            this.canvas.removeEventListener("touchmove", this.handlers.touchmove);
        }

        if (this.handlers.touchend) {
            this.canvas.removeEventListener("touchend", this.handlers.touchend);
        }
    }
}
