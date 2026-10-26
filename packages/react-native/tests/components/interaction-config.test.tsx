import { useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { CanvasTileEngine as Core, type CanvasTileEngineConfig, type EventHandlers } from "@canvas-tile-engine/core";
import { CanvasTileEngine } from "../../src/components/CanvasTileEngine";
import { useCanvasTileEngine, type EngineHandle } from "../../src/hooks/useCanvasTileEngine";
import type { CanvasTileEngineProps } from "../../src/types";
import { createFakeRenderer } from "../helpers/fakeRenderer";
import { emitLayout, resetReactNativeMock } from "../mocks/react-native";
import { resetSkiaMock } from "../mocks/react-native-skia";
import {
    blockerGesture,
    detectedGestures,
    resetGestureMock,
    touchEvent,
    transportGesture,
} from "../mocks/react-native-gesture-handler";

const OFF: EventHandlers = { click: false, drag: false, hover: false, zoom: false };
const CONFIG: CanvasTileEngineConfig = { scale: 10, size: { width: 0, height: 0 }, eventHandlers: OFF };
type CallbackProps = Pick<CanvasTileEngineProps, "onMouseDown" | "onMouseUp">;

function mountEngine(handlers: EventHandlers = OFF, props: CallbackProps = {}) {
    const fake = createFakeRenderer();
    let captured: EngineHandle;
    const parentRendered = vi.fn();

    function Harness({ canvasKey = 0, ...callbacks }: CallbackProps & { canvasKey?: number }) {
        const engine = useCanvasTileEngine();
        captured = engine;
        parentRendered();
        return (
            <CanvasTileEngine
                key={canvasKey}
                engine={engine}
                renderer={fake.renderer}
                config={{ ...CONFIG, eventHandlers: handlers }}
                {...callbacks}
            />
        );
    }

    const utils = render(<Harness {...props} />);
    act(() => emitLayout(300, 200));
    return {
        ...utils,
        fake,
        parentRendered,
        get engine() {
            return captured;
        },
        rerender: (callbacks: CallbackProps, canvasKey = 0) =>
            utils.rerender(<Harness {...callbacks} canvasKey={canvasKey} />),
    };
}

afterEach(() => {
    cleanup();
    resetReactNativeMock();
    resetSkiaMock();
    resetGestureMock();
    vi.restoreAllMocks();
});

describe("runtime native gesture gates (real core config, mocked native gestures)", () => {
    it("disables and re-enables the blocker without a frame or parent render", () => {
        const mounted = mountEngine({ drag: true, click: true, zoom: "pointer" });
        const handle = mounted.engine;
        const instance = handle.instance;
        const renderCount = mounted.parentRendered.mock.calls.length;
        mounted.fake.render.mockClear();
        expect(blockerGesture().isEnabled).toBe(true);

        act(() => handle.setEventHandlers(OFF));
        expect(handle.getConfig().eventHandlers).toMatchObject(OFF);
        expect(blockerGesture().isEnabled).toBe(false);
        act(() => transportGesture().onTouchesDownHandler!(touchEvent([{ id: 0, x: 40, y: 60 }])));
        expect(mounted.fake.dispatchTouchStart).not.toHaveBeenCalled();

        // Direct instance calls must work too, not just the React handle.
        act(() => instance!.setEventHandlers({ drag: true }));
        expect(blockerGesture().isEnabled).toBe(true);
        act(() => transportGesture().onTouchesDownHandler!(touchEvent([{ id: 0, x: 40, y: 60 }])));
        expect(mounted.fake.dispatchTouchStart).toHaveBeenCalledTimes(1);
        expect(mounted.engine).toBe(handle);
        expect(mounted.engine.instance).toBe(instance);
        expect(mounted.parentRendered).toHaveBeenCalledTimes(renderCount);
        expect(mounted.fake.render).not.toHaveBeenCalled();
    });

    it.each<EventHandlers>([{ click: true }, { drag: true }, { hover: true }, { zoom: true }, { zoom: "center" }])(
        "claims and releases the blocker for %j",
        (handlers) => {
            const { engine } = mountEngine();
            expect(blockerGesture().isEnabled).toBe(false);
            act(() => engine.setEventHandlers(handlers));
            expect(blockerGesture().isEnabled).toBe(true);
            act(() => engine.setEventHandlers(OFF));
            expect(blockerGesture().isEnabled).toBe(false);
        },
    );

    it("does not rebuild gestures or paint for updates that leave the claim gate unchanged", () => {
        const { engine, fake } = mountEngine({ drag: true });
        const blocker = blockerGesture();
        const transport = transportGesture();
        const renderCount = detectedGestures.length;
        fake.render.mockClear();

        for (const handlers of [{}, { drag: true }, { zoom: true }, { zoom: "center" as const }, { resize: true }]) {
            act(() => engine.setEventHandlers(handlers));
        }

        expect(blockerGesture()).toBe(blocker);
        expect(transportGesture()).toBe(transport);
        expect(detectedGestures).toHaveLength(renderCount);
        expect(fake.render).not.toHaveBeenCalled();
    });

    it("does not claim touches for right-click or resize alone", () => {
        const { engine } = mountEngine();
        act(() => engine.setEventHandlers({ rightClick: true, resize: true }));
        expect(blockerGesture().isEnabled).toBe(false);
    });

    it.each(["onMouseDown", "onMouseUp"] as const)("tracks adding, replacing and removing %s", (name) => {
        const mounted = mountEngine();
        const instance = mounted.engine.instance;
        const first = vi.fn();
        const second = vi.fn();
        expect(blockerGesture().isEnabled).toBe(false);

        mounted.rerender({ [name]: first });
        expect(blockerGesture().isEnabled).toBe(true);
        const blocker = blockerGesture();
        mounted.rerender({ [name]: second });
        expect(blockerGesture()).toBe(blocker);
        const point = { raw: { x: 1, y: 2 }, snapped: { x: 1, y: 2 } };
        instance![name]!(point, point, point);
        expect(first).not.toHaveBeenCalled();
        expect(second).toHaveBeenCalledExactlyOnceWith(point, point, point);

        // Config off must retain a callback-only claim; removing the prop
        // must release it on that render, without an extra frame/layout.
        act(() => mounted.engine.setEventHandlers(OFF));
        expect(blockerGesture().isEnabled).toBe(true);
        mounted.rerender({});
        expect(blockerGesture().isEnabled).toBe(false);
        expect(mounted.engine.instance).toBe(instance);
    });

    it("keeps the transport available to finish a stream after the blocker is disabled", () => {
        const { engine, fake } = mountEngine({ drag: true });
        const event = touchEvent([{ id: 0, x: 40, y: 60 }]);
        act(() => transportGesture().onTouchesDownHandler!(event));
        act(() => engine.setEventHandlers(OFF));
        expect(blockerGesture().isEnabled).toBe(false);
        act(() => transportGesture().onTouchesUpHandler!(event));
        expect(fake.dispatchTouchEnd).toHaveBeenCalledExactlyOnceWith([]);
    });

    it("subscribes before ready consumer effects can change config", () => {
        const fake = createFakeRenderer();
        function Harness() {
            const engine = useCanvasTileEngine();
            useEffect(() => {
                if (engine.isReady) {
                    engine.setEventHandlers(OFF);
                }
            }, [engine, engine.isReady]);
            return (
                <CanvasTileEngine
                    engine={engine}
                    renderer={fake.renderer}
                    config={{ ...CONFIG, eventHandlers: { drag: true } }}
                />
            );
        }
        render(<Harness />);
        act(() => emitLayout(300, 200));
        expect(blockerGesture().isEnabled).toBe(false);
        expect(fake.render).toHaveBeenCalledTimes(1);
    });

    it("detaches subscriptions on remount/unmount and ignores the old instance", () => {
        const subscribe = Core.prototype._subscribeEventHandlers;
        const unsubscribes: Array<ReturnType<typeof vi.fn>> = [];
        const notifications: Array<ReturnType<typeof vi.fn>> = [];
        vi.spyOn(Core.prototype, "_subscribeEventHandlers").mockImplementation(function (this: Core, listener) {
            const notify = vi.fn(listener);
            const unsubscribe = vi.fn(subscribe.call(this, notify));
            notifications.push(notify);
            unsubscribes.push(unsubscribe);
            return unsubscribe;
        });
        const mounted = mountEngine({ drag: true });
        const handle = mounted.engine;
        const old = handle.instance!;
        act(() => handle.setEventHandlers(OFF));
        expect(notifications[0]).toHaveBeenCalledTimes(1);

        mounted.rerender({}, 1);
        expect(unsubscribes[0]).toHaveBeenCalledTimes(1);
        expect(blockerGesture().isEnabled).toBe(false);
        act(() => emitLayout(300, 200));
        expect(mounted.engine).toBe(handle);
        expect(handle.instance).not.toBe(old);
        expect(blockerGesture().isEnabled).toBe(true);
        act(() => old.setEventHandlers(OFF));
        expect(notifications[0]).toHaveBeenCalledTimes(1);
        expect(blockerGesture().isEnabled).toBe(true);

        act(() => handle.setEventHandlers(OFF));
        expect(blockerGesture().isEnabled).toBe(false);
        expect(notifications[1]).toHaveBeenCalledTimes(1);
        mounted.unmount();
        expect(unsubscribes[1]).toHaveBeenCalledTimes(1);
    });
});
