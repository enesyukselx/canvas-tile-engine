import { describe, expect, it, vi } from "vitest";
import { EventBinder } from "../../src/modules/EventManager/EventBinder";

type ListenerRecord = {
    type: string;
    fn: EventListenerOrEventListenerObject;
    options?: boolean | AddEventListenerOptions;
};

type RemoveRecord = {
    type: string;
    fn: EventListenerOrEventListenerObject;
};

const createCanvasMock = () => {
    const added: ListenerRecord[] = [];
    const removed: RemoveRecord[] = [];

    const addEventListener = vi.fn(
        (type: string, fn: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions) => {
            added.push({ type, fn, options });
        }
    );
    const removeEventListener = vi.fn((type: string, fn: EventListenerOrEventListenerObject) => {
        removed.push({ type, fn });
    });

    const canvas = { addEventListener, removeEventListener } as unknown as HTMLCanvasElement;
    return { canvas, added, removed, addEventListener, removeEventListener };
};

describe("EventBinder", () => {
    it("attaches handlers with correct passive options", () => {
        const handlers = {
            click: vi.fn<(e: MouseEvent) => void>(),
            mousedown: vi.fn<(e: MouseEvent) => void>(),
            mousemove: vi.fn<(e: MouseEvent) => void>(),
            mouseup: vi.fn<(e: MouseEvent) => void>(),
            mouseleave: vi.fn<(e: MouseEvent) => void>(),
            wheel: vi.fn<(e: WheelEvent) => void>(),
            touchstart: vi.fn<(e: TouchEvent) => void>(),
            touchmove: vi.fn<(e: TouchEvent) => void>(),
            touchend: vi.fn<(e: TouchEvent) => void>(),
        };
        const { canvas, added } = createCanvasMock();
        const binder = new EventBinder(canvas, handlers);

        binder.attach();

        expect(added.map((a) => a.type).sort()).toEqual(
            ["click", "mousedown", "mousemove", "mouseup", "mouseleave", "wheel", "touchstart", "touchmove", "touchend"].sort()
        );
        const get = (type: string) => added.find((a) => a.type === type)?.options;
        expect(get("wheel")).toEqual({ passive: false });
        expect(get("touchstart")).toEqual({ passive: false });
        expect(get("touchmove")).toEqual({ passive: false });
        expect(get("touchend")).toEqual({ passive: false });
        expect(get("click")).toBeUndefined();
        expect(get("mousedown")).toBeUndefined();
        expect(get("mousemove")).toBeUndefined();
        expect(get("mouseup")).toBeUndefined();
        expect(get("mouseleave")).toBeUndefined();
    });

    it("detaches only handlers that were attached", () => {
        const handlers = {
            click: vi.fn<(e: MouseEvent) => void>(),
            mouseup: vi.fn<(e: MouseEvent) => void>(),
            wheel: vi.fn<(e: WheelEvent) => void>(),
        };
        const { canvas, removed } = createCanvasMock();
        const binder = new EventBinder(canvas, handlers);
        binder.attach();
        binder.detach();

        expect(removed.map((r) => r.type).sort()).toEqual(["click", "mouseup", "wheel"].sort());
    });

    it("detaches all handlers when all are provided", () => {
        const handlers = {
            click: vi.fn<(e: MouseEvent) => void>(),
            mousedown: vi.fn<(e: MouseEvent) => void>(),
            mousemove: vi.fn<(e: MouseEvent) => void>(),
            mouseup: vi.fn<(e: MouseEvent) => void>(),
            mouseleave: vi.fn<(e: MouseEvent) => void>(),
            wheel: vi.fn<(e: WheelEvent) => void>(),
            touchstart: vi.fn<(e: TouchEvent) => void>(),
            touchmove: vi.fn<(e: TouchEvent) => void>(),
            touchend: vi.fn<(e: TouchEvent) => void>(),
        };
        const { canvas, removed } = createCanvasMock();
        const binder = new EventBinder(canvas, handlers);
        binder.attach();
        binder.detach();

        expect(removed.map((r) => r.type).sort()).toEqual(
            ["click", "mousedown", "mousemove", "mouseup", "mouseleave", "wheel", "touchstart", "touchmove", "touchend"].sort()
        );
    });

    it("no-ops when no handlers provided", () => {
        const { canvas, added, removed, addEventListener, removeEventListener } = createCanvasMock();
        const binder = new EventBinder(canvas, {});
        binder.attach();
        binder.detach();

        expect(addEventListener).not.toHaveBeenCalled();
        expect(removeEventListener).not.toHaveBeenCalled();
        expect(added).toHaveLength(0);
        expect(removed).toHaveLength(0);
    });
});
