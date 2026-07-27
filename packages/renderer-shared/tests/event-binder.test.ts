import { describe, expect, it, vi } from "vitest";
import { EventBinder } from "../src/dom/EventBinder";

function createFakeCanvas() {
    return {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    } as unknown as HTMLCanvasElement & {
        addEventListener: ReturnType<typeof vi.fn>;
        removeEventListener: ReturnType<typeof vi.fn>;
    };
}

describe("EventBinder", () => {
    it("attaches every provided handler under its event name", () => {
        const canvas = createFakeCanvas();
        const handlers = {
            click: vi.fn(),
            contextmenu: vi.fn(),
            mousedown: vi.fn(),
            mousemove: vi.fn(),
            mouseup: vi.fn(),
            mouseleave: vi.fn(),
        };

        new EventBinder(canvas, handlers).attach();

        expect(canvas.addEventListener).toHaveBeenCalledTimes(6);
        for (const [event, handler] of Object.entries(handlers)) {
            expect(canvas.addEventListener).toHaveBeenCalledWith(event, handler);
        }
    });

    it("attaches wheel and touch handlers as non-passive so they can preventDefault", () => {
        const canvas = createFakeCanvas();
        const handlers = {
            wheel: vi.fn(),
            touchstart: vi.fn(),
            touchmove: vi.fn(),
            touchend: vi.fn(),
        };

        new EventBinder(canvas, handlers).attach();

        for (const [event, handler] of Object.entries(handlers)) {
            expect(canvas.addEventListener).toHaveBeenCalledWith(event, handler, { passive: false });
        }
    });

    it("skips handlers that were not provided", () => {
        const canvas = createFakeCanvas();

        new EventBinder(canvas, { click: vi.fn() }).attach();

        expect(canvas.addEventListener).toHaveBeenCalledTimes(1);
    });

    it("detaches exactly the handler references it attached", () => {
        const canvas = createFakeCanvas();
        const handlers = { click: vi.fn(), wheel: vi.fn(), touchstart: vi.fn() };
        const binder = new EventBinder(canvas, handlers);

        binder.attach();
        binder.detach();

        expect(canvas.removeEventListener).toHaveBeenCalledTimes(3);
        expect(canvas.removeEventListener).toHaveBeenCalledWith("click", handlers.click);
        expect(canvas.removeEventListener).toHaveBeenCalledWith("wheel", handlers.wheel);
        expect(canvas.removeEventListener).toHaveBeenCalledWith("touchstart", handlers.touchstart);
    });
});
