type HandlerMap = {
    click?: (e: MouseEvent) => void;
    contextmenu?: (e: MouseEvent) => void;
    mousedown?: (e: MouseEvent) => void;
    mousemove?: (e: MouseEvent) => boolean | void;
    mouseup?: (e: MouseEvent) => void;
    mouseleave?: (e: MouseEvent) => void;
    wheel?: (e: WheelEvent) => void;
    /** Return false when the renderer leaves this touch sequence to the browser. */
    touchstart?: (e: TouchEvent) => boolean | void;
    touchmove?: (e: TouchEvent) => void;
    touchend?: (e: TouchEvent) => void;
    cancel?: (pointer?: MouseEvent | Touch) => void;
};

/**
 * DOM input lifetime shared by the browser renderers. Mouse drags are tracked
 * on the owning document until release; touch events already target the element
 * where the contact started. Cancellation never goes through the tap path.
 * @internal
 */
export class EventBinder {
    private attached = false;
    private attachment = 0;
    private mouseActive = false;
    private mouseCancelled = false;
    private documentEvents = new WeakSet<MouseEvent>();
    private touchActive = false;
    private touchCancelled = false;
    private lastPointer?: MouseEvent | Touch;

    constructor(
        private canvas: HTMLCanvasElement,
        private handlers: HandlerMap,
    ) {}

    attach() {
        if (this.attached) {
            return;
        }
        this.attached = true;
        this.attachment++;
        if (this.handlers.click) {
            this.canvas.addEventListener("click", this.handlers.click);
        }

        if (this.handlers.contextmenu) {
            this.canvas.addEventListener("contextmenu", this.handlers.contextmenu);
        }

        if (this.handlers.mousedown) {
            this.canvas.addEventListener("mousedown", this.handleMouseDown);
        }

        if (this.handlers.mousemove) {
            this.canvas.addEventListener("mousemove", this.handleMouseMove);
        }

        if (this.handlers.mouseup) {
            this.canvas.addEventListener("mouseup", this.handleMouseUp);
        }

        if (this.handlers.mouseleave) {
            this.canvas.addEventListener("mouseleave", this.handlers.mouseleave);
        }

        if (this.handlers.wheel) {
            this.canvas.addEventListener("wheel", this.handlers.wheel, { passive: false });
        }

        if (this.handlers.touchstart) {
            this.canvas.addEventListener("touchstart", this.handleTouchStart, { passive: false });
        }

        if (this.handlers.touchmove) {
            this.canvas.addEventListener("touchmove", this.handleTouchMove, { passive: false });
        }

        if (this.handlers.touchend) {
            this.canvas.addEventListener("touchend", this.handleTouchEnd, { passive: false });
        }
        this.canvas.addEventListener("touchcancel", this.handleTouchCancel);
        this.canvas.ownerDocument.defaultView?.addEventListener("blur", this.handleBlur);
    }

    detach() {
        if (!this.attached) {
            return;
        }
        this.attached = false;
        this.attachment++;
        if (this.handlers.click) {
            this.canvas.removeEventListener("click", this.handlers.click);
        }

        if (this.handlers.contextmenu) {
            this.canvas.removeEventListener("contextmenu", this.handlers.contextmenu);
        }

        if (this.handlers.mousedown) {
            this.canvas.removeEventListener("mousedown", this.handleMouseDown);
        }

        if (this.handlers.mousemove) {
            this.canvas.removeEventListener("mousemove", this.handleMouseMove);
        }

        if (this.handlers.mouseup) {
            this.canvas.removeEventListener("mouseup", this.handleMouseUp);
        }

        if (this.handlers.mouseleave) {
            this.canvas.removeEventListener("mouseleave", this.handlers.mouseleave);
        }

        if (this.handlers.wheel) {
            this.canvas.removeEventListener("wheel", this.handlers.wheel);
        }

        if (this.handlers.touchstart) {
            this.canvas.removeEventListener("touchstart", this.handleTouchStart);
        }

        if (this.handlers.touchmove) {
            this.canvas.removeEventListener("touchmove", this.handleTouchMove);
        }

        if (this.handlers.touchend) {
            this.canvas.removeEventListener("touchend", this.handleTouchEnd);
        }
        this.canvas.removeEventListener("touchcancel", this.handleTouchCancel);
        this.canvas.ownerDocument.defaultView?.removeEventListener("blur", this.handleBlur);
        this.cancel();
        this.touchCancelled = false;
        this.mouseCancelled = false;
    }

    private stopMouseTracking(): void {
        this.mouseActive = false;
        this.canvas.ownerDocument.removeEventListener("mousemove", this.handleDocumentMouseMove, true);
        this.canvas.ownerDocument.removeEventListener("mouseup", this.handleDocumentMouseUp, true);
    }

    private cancel(): void {
        const active = this.mouseActive || this.touchActive;
        const pointer = this.lastPointer;
        this.mouseCancelled ||= this.mouseActive;
        this.stopMouseTracking();
        this.touchActive = false;
        this.lastPointer = undefined;
        if (active) {
            this.handlers.cancel?.(pointer);
        }
    }

    private handleMouseDown = (e: MouseEvent): void => {
        if (e.button !== 0 || this.touchActive) {
            return;
        }
        const attachment = this.attachment;
        this.cancel();
        if (!this.attached || this.attachment !== attachment) {
            return;
        }
        this.mouseCancelled = false;
        this.mouseActive = true;
        this.lastPointer = e;
        this.canvas.ownerDocument.addEventListener("mousemove", this.handleDocumentMouseMove, true);
        this.canvas.ownerDocument.addEventListener("mouseup", this.handleDocumentMouseUp, true);
        this.handlers.mousedown?.(e);
    };

    private handleMouseMove = (e: MouseEvent): boolean => {
        if (this.documentEvents.has(e)) {
            return true;
        }
        if (this.mouseActive) {
            this.lastPointer = e;
            // A release outside the browser may not deliver mouseup at all.
            if ((e.buttons & 1) === 0) {
                this.cancel();
                return true;
            }
        }
        return this.handlers.mousemove?.(e) !== false;
    };

    private handleMouseUp = (e: MouseEvent): void => {
        if (e.button !== 0 || this.mouseCancelled || this.documentEvents.has(e)) {
            return;
        }
        this.stopMouseTracking();
        this.lastPointer = undefined;
        this.handlers.mouseup?.(e);
    };

    private handleDocumentMouseMove = (e: MouseEvent): void => {
        // The element listener delivers events on the canvas. Use composedPath
        // so shadow-DOM retargeting cannot deliver them a second time.
        if (!e.composedPath().includes(this.canvas) && this.handleMouseMove(e)) {
            // Closed shadow roots hide the canvas from composedPath. Remember
            // delivery so their element listener cannot deliver the event again.
            this.documentEvents.add(e);
        }
    };

    private handleDocumentMouseUp = (e: MouseEvent): void => {
        if (!e.composedPath().includes(this.canvas)) {
            this.handleMouseUp(e);
            this.documentEvents.add(e);
        }
    };

    private handleTouchStart = (e: TouchEvent): void => {
        if (this.touchCancelled) {
            // A blur may lose all old end events. A wholly new contact set
            // can start again; adding a finger to an interrupted set cannot.
            if (e.targetTouches.length !== e.changedTouches.length) {
                return;
            }
            this.touchCancelled = false;
        }
        if (this.mouseActive) {
            const attachment = this.attachment;
            this.cancel();
            if (!this.attached || this.attachment !== attachment) {
                return;
            }
        }
        const wasActive = this.touchActive;
        this.touchActive = true;
        this.lastPointer = e.targetTouches[0];
        if (this.handlers.touchstart?.(e) === false) {
            if (wasActive) {
                this.touchCancelled = true;
                this.cancel();
            } else {
                this.touchActive = false;
                this.lastPointer = undefined;
            }
        }
    };

    private handleTouchMove = (e: TouchEvent): void => {
        if (this.touchActive) {
            this.lastPointer = e.targetTouches[0] ?? this.lastPointer;
            this.handlers.touchmove?.(e);
        }
    };

    private handleTouchEnd = (e: TouchEvent): void => {
        const active = this.touchActive;
        if (e.targetTouches.length === 0) {
            this.touchActive = false;
            this.touchCancelled = false;
            this.lastPointer = undefined;
        } else {
            this.lastPointer = e.targetTouches[0];
        }
        if (active) {
            this.handlers.touchend?.(e);
        }
    };

    private handleTouchCancel = (e: TouchEvent): void => {
        this.touchCancelled = e.targetTouches.length > 0;
        if (this.touchActive) {
            this.lastPointer = e.changedTouches[0] ?? this.lastPointer;
            this.cancel();
        }
    };

    private handleBlur = (): void => {
        this.touchCancelled = this.touchActive || this.touchCancelled;
        this.cancel();
    };
}
