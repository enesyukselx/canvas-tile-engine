// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventBinder } from "../src/dom/EventBinder";

function mouse(target: EventTarget, type: string, init: MouseEventInit = {}): MouseEvent {
    const event = new MouseEvent(type, { bubbles: true, composed: true, button: 0, buttons: 1, ...init });
    target.dispatchEvent(event);
    return event;
}

function contact(identifier: number): Touch {
    return { identifier, clientX: identifier * 10, clientY: 10 } as Touch;
}

function touch(target: EventTarget, type: string, remaining: Touch[], changed: Touch[]): TouchEvent {
    const event = new TouchEvent(type, {
        bubbles: true,
        cancelable: true,
        touches: remaining,
        targetTouches: remaining,
        changedTouches: changed,
    });
    target.dispatchEvent(event);
    return event;
}

function createHandlers() {
    return {
        click: vi.fn<(e: MouseEvent) => void>(),
        contextmenu: vi.fn<(e: MouseEvent) => void>(),
        mousedown: vi.fn<(e: MouseEvent) => void>(),
        mousemove: vi.fn<(e: MouseEvent) => void>(),
        mouseup: vi.fn<(e: MouseEvent) => void>(),
        mouseleave: vi.fn<(e: MouseEvent) => void>(),
        wheel: vi.fn<(e: WheelEvent) => void>(),
        touchstart: vi.fn<(e: TouchEvent) => boolean | void>(),
        touchmove: vi.fn<(e: TouchEvent) => void>(),
        touchend: vi.fn<(e: TouchEvent) => void>(),
        cancel: vi.fn<(pointer?: MouseEvent | Touch) => void>(),
    };
}

describe("EventBinder", () => {
    let canvas: HTMLCanvasElement;
    let binder: EventBinder;
    let handlers: ReturnType<typeof createHandlers>;

    beforeEach(() => {
        canvas = document.createElement("canvas");
        document.body.append(canvas);
        handlers = createHandlers();
        binder = new EventBinder(canvas, handlers);
        binder.attach();
    });

    afterEach(() => {
        binder.detach();
        canvas.remove();
        vi.restoreAllMocks();
    });

    it("keeps normal hover, click, context menu and leave callbacks", () => {
        for (const type of ["mousemove", "click", "contextmenu", "mouseleave"] as const) {
            const event = mouse(canvas, type, { buttons: 0 });
            expect(handlers[type]).toHaveBeenCalledExactlyOnceWith(event);
        }
        mouse(document, "mousemove");
        mouse(document, "mouseup");
        expect(handlers.mousemove).toHaveBeenCalledTimes(1);
        expect(handlers.mouseup).not.toHaveBeenCalled();
    });

    it("tracks outside movement and release while delivering leave immediately", () => {
        mouse(canvas, "mousedown");
        const leave = mouse(canvas, "mouseleave");
        const move = mouse(document.body, "mousemove", { clientX: 120 });
        const up = mouse(document.body, "mouseup", { buttons: 0 });

        expect(handlers.mouseleave).toHaveBeenCalledExactlyOnceWith(leave);
        expect(handlers.mousemove).toHaveBeenCalledExactlyOnceWith(move);
        expect(handlers.mouseup).toHaveBeenCalledExactlyOnceWith(up);
        expect(handlers.cancel).not.toHaveBeenCalled();
        mouse(document.body, "mousemove");
        mouse(document.body, "mouseup");
        expect(handlers.mousemove).toHaveBeenCalledTimes(1);
        expect(handlers.mouseup).toHaveBeenCalledTimes(1);
    });

    it("delivers canvas movement, re-entry and release only once", () => {
        mouse(canvas, "mousedown");
        mouse(canvas, "mousemove");
        mouse(canvas, "mouseleave");
        mouse(document, "mousemove");
        mouse(canvas, "mousemove");
        mouse(canvas, "mouseup");
        expect(handlers.mousemove).toHaveBeenCalledTimes(3);
        expect(handlers.mouseup).toHaveBeenCalledTimes(1);
    });

    it.each(["open", "closed"] as const)("avoids duplicate delivery in a %s shadow root", (mode) => {
        const host = document.createElement("div");
        document.body.append(host);
        host.attachShadow({ mode }).append(canvas);
        mouse(canvas, "mousedown");
        mouse(canvas, "mousemove");
        mouse(canvas, "mouseup");
        expect(handlers.mousemove).toHaveBeenCalledTimes(1);
        expect(handlers.mouseup).toHaveBeenCalledTimes(1);
        host.remove();
    });

    it("ignores secondary starts and releases without interrupting a primary drag", () => {
        mouse(canvas, "mousedown", { button: 2 });
        mouse(document, "mousemove");
        expect(handlers.mousedown).not.toHaveBeenCalled();
        expect(handlers.mousemove).not.toHaveBeenCalled();
        mouse(canvas, "mousedown");
        mouse(document, "mouseup", { button: 2 });
        mouse(document, "mousemove");
        mouse(document, "mouseup");
        expect(handlers.mousemove).toHaveBeenCalledTimes(1);
        expect(handlers.mouseup).toHaveBeenCalledTimes(1);
    });

    it("cancels a missed release on movement without the primary button", () => {
        mouse(canvas, "mousedown");
        const move = mouse(document, "mousemove", { buttons: 0 });
        expect(handlers.cancel).toHaveBeenCalledExactlyOnceWith(move);
        expect(handlers.mousemove).not.toHaveBeenCalled();
        mouse(canvas, "mouseup", { buttons: 0 });
        expect(handlers.mouseup).not.toHaveBeenCalled();
        mouse(canvas, "mousedown");
        mouse(canvas, "mouseup");
        expect(handlers.mouseup).toHaveBeenCalledTimes(1);
    });

    it("cancels on window blur once and removes global drag listeners", () => {
        const down = mouse(canvas, "mousedown");
        window.dispatchEvent(new Event("blur"));
        window.dispatchEvent(new Event("blur"));
        mouse(document, "mousemove");
        mouse(document, "mouseup");
        mouse(canvas, "mouseup");
        expect(handlers.cancel).toHaveBeenCalledExactlyOnceWith(down);
        expect(handlers.mousemove).not.toHaveBeenCalled();
        expect(handlers.mouseup).not.toHaveBeenCalled();
    });

    it("attaches idempotently and detaches all listeners during an active drag", () => {
        binder.attach();
        mouse(canvas, "mousedown");
        const remove = vi.spyOn(document, "removeEventListener");
        binder.detach();
        binder.detach();
        expect(remove).toHaveBeenCalledWith("mousemove", expect.any(Function), true);
        expect(remove).toHaveBeenCalledWith("mouseup", expect.any(Function), true);
        mouse(document, "mousemove");
        mouse(canvas, "mouseup");
        mouse(canvas, "click");
        expect(handlers.mousedown).toHaveBeenCalledTimes(1);
        expect(handlers.cancel).toHaveBeenCalledTimes(1);
        expect(handlers.mousemove).not.toHaveBeenCalled();
        expect(handlers.mouseup).not.toHaveBeenCalled();
        expect(handlers.click).not.toHaveBeenCalled();

        binder.attach();
        mouse(canvas, "mousedown");
        mouse(document, "mouseup");
        expect(handlers.mouseup).toHaveBeenCalledTimes(1);
    });

    it("uses the canvas owning document and window", () => {
        binder.detach();
        const frame = document.createElement("iframe");
        document.body.append(frame);
        const owner = frame.contentDocument!;
        owner.body.append(canvas);
        binder.attach();
        const down = mouse(canvas, "mousedown");
        mouse(document, "mousemove");
        window.dispatchEvent(new Event("blur"));
        expect(handlers.mousemove).not.toHaveBeenCalled();
        expect(handlers.cancel).not.toHaveBeenCalled();
        owner.defaultView!.dispatchEvent(new Event("blur"));
        expect(handlers.cancel).toHaveBeenCalledExactlyOnceWith(down);
        binder.detach();
        frame.remove();
    });

    it.each(["mouse", "touch"])("does not restart %s input after cancellation tears down the binder", (input) => {
        mouse(canvas, "mousedown");
        handlers.cancel.mockImplementation(() => binder.detach());
        if (input === "mouse") {
            mouse(canvas, "mousedown");
        } else {
            touch(canvas, "touchstart", [contact(1)], [contact(1)]);
        }
        mouse(document, "mousemove");
        mouse(document, "mouseup");
        expect(handlers.mousedown).toHaveBeenCalledTimes(1);
        expect(handlers.touchstart).not.toHaveBeenCalled();
        expect(handlers.mousemove).not.toHaveBeenCalled();
        expect(handlers.mouseup).not.toHaveBeenCalled();
    });

    it("does not resume an old start after cancellation detaches and reattaches", () => {
        mouse(canvas, "mousedown");
        handlers.cancel.mockImplementation(() => {
            binder.detach();
            binder.attach();
        });
        mouse(canvas, "mousedown");
        expect(handlers.mousedown).toHaveBeenCalledTimes(1);
        mouse(document, "mousemove");
        expect(handlers.mousemove).not.toHaveBeenCalled();
        mouse(canvas, "mousedown");
        expect(handlers.mousedown).toHaveBeenCalledTimes(2);
    });

    it("leaves wheel and touch handlers non-passive", () => {
        handlers.wheel.mockImplementation((e: Event) => e.preventDefault());
        handlers.touchstart.mockImplementation((e: Event) => e.preventDefault());
        handlers.touchmove.mockImplementation((e: Event) => e.preventDefault());
        handlers.touchend.mockImplementation((e: Event) => e.preventDefault());
        const wheel = new WheelEvent("wheel", { cancelable: true });
        canvas.dispatchEvent(wheel);
        expect(wheel.defaultPrevented).toBe(true);
        const finger = contact(1);
        expect(touch(canvas, "touchstart", [finger], [finger]).defaultPrevented).toBe(true);
        expect(touch(canvas, "touchmove", [finger], [finger]).defaultPrevented).toBe(true);
        expect(touch(canvas, "touchend", [], [finger]).defaultPrevented).toBe(true);
    });

    it("cancels touch without forwarding touchend or a stray final release", () => {
        const finger = contact(1);
        touch(canvas, "touchstart", [finger], [finger]);
        touch(canvas, "touchcancel", [], [finger]);
        touch(canvas, "touchcancel", [], [finger]);
        touch(canvas, "touchend", [], [finger]);
        expect(handlers.cancel).toHaveBeenCalledExactlyOnceWith(finger);
        expect(handlers.touchend).not.toHaveBeenCalled();
        touch(canvas, "touchstart", [finger], [finger]);
        touch(canvas, "touchend", [], [finger]);
        expect(handlers.touchend).toHaveBeenCalledTimes(1);
    });

    it("discards remaining contacts and added fingers after a partial pinch cancellation", () => {
        const [first, second, third] = [contact(1), contact(2), contact(3)];
        touch(canvas, "touchstart", [first], [first]);
        touch(canvas, "touchstart", [first, second], [second]);
        touch(canvas, "touchcancel", [second], [first]);
        touch(canvas, "touchmove", [second], [second]);
        touch(canvas, "touchstart", [second, third], [third]);
        touch(canvas, "touchend", [third], [second]);
        touch(canvas, "touchend", [], [third]);
        expect(handlers.cancel).toHaveBeenCalledTimes(1);
        expect(handlers.touchstart).toHaveBeenCalledTimes(2);
        expect(handlers.touchmove).not.toHaveBeenCalled();
        expect(handlers.touchend).not.toHaveBeenCalled();
        touch(canvas, "touchstart", [third], [third]);
        touch(canvas, "touchmove", [third], [third]);
        touch(canvas, "touchend", [], [third]);
        expect(handlers.touchstart).toHaveBeenCalledTimes(3);
        expect(handlers.touchmove).toHaveBeenCalledTimes(1);
        expect(handlers.touchend).toHaveBeenCalledTimes(1);
    });

    it("recovers after blur even when the old touches end outside the browser", () => {
        const [first, second] = [contact(1), contact(2)];
        touch(canvas, "touchstart", [first], [first]);
        window.dispatchEvent(new Event("blur"));
        touch(canvas, "touchmove", [first], [first]);
        touch(canvas, "touchstart", [second], [second]);
        touch(canvas, "touchend", [], [second]);
        expect(handlers.cancel).toHaveBeenCalledTimes(1);
        expect(handlers.touchmove).not.toHaveBeenCalled();
        expect(handlers.touchend).toHaveBeenCalledTimes(1);
    });

    it("does not cancel or claim a touch sequence declined by the renderer", () => {
        handlers.touchstart.mockReturnValue(false);
        const finger = contact(1);
        expect(touch(canvas, "touchstart", [finger], [finger]).defaultPrevented).toBe(false);
        touch(canvas, "touchmove", [finger], [finger]);
        touch(canvas, "touchcancel", [], [finger]);
        expect(handlers.touchmove).not.toHaveBeenCalled();
        expect(handlers.cancel).not.toHaveBeenCalled();
    });

    it("cancels an existing gesture when a later touchstart is declined", () => {
        const [first, second] = [contact(1), contact(2)];
        touch(canvas, "touchstart", [first], [first]);
        handlers.touchstart.mockReturnValue(false);
        touch(canvas, "touchstart", [first, second], [second]);
        touch(canvas, "touchmove", [first, second], [second]);
        touch(canvas, "touchend", [], [first, second]);
        expect(handlers.cancel).toHaveBeenCalledTimes(1);
        expect(handlers.touchmove).not.toHaveBeenCalled();
        expect(handlers.touchend).not.toHaveBeenCalled();
    });

    it("cancels active touch on detach and ignores later native events", () => {
        const finger = contact(1);
        touch(canvas, "touchstart", [finger], [finger]);
        binder.detach();
        touch(canvas, "touchmove", [finger], [finger]);
        touch(canvas, "touchend", [], [finger]);
        expect(handlers.cancel).toHaveBeenCalledExactlyOnceWith(finger);
        expect(handlers.touchmove).not.toHaveBeenCalled();
        expect(handlers.touchend).not.toHaveBeenCalled();
    });
});
