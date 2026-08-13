import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { CanvasTileEngine } from "../../src/components/CanvasTileEngine";
import { useCanvasTileEngine } from "../../src/hooks/useCanvasTileEngine";
import { createFakeRenderer } from "../helpers/fakeRenderer";
import { emitLayout, resetReactNativeMock } from "../mocks/react-native";
import { resetSkiaMock } from "../mocks/react-native-skia";
import {
    blockerGesture,
    resetGestureMock,
    touchEvent,
    transportGesture,
    type GestureTouchEvent,
} from "../mocks/react-native-gesture-handler";

const INTERACTIVE: CanvasTileEngineConfig = {
    scale: 10,
    size: { width: 0, height: 0 },
    eventHandlers: { drag: true, click: true, zoom: "pointer" },
};

const INERT: CanvasTileEngineConfig = {
    scale: 10,
    size: { width: 0, height: 0 },
    eventHandlers: { drag: false, click: false, hover: false, zoom: false },
};

type Fake = ReturnType<typeof createFakeRenderer>;

/** Mount the component and give it a measured size, like the native layout pass. */
function mountEngine(config: CanvasTileEngineConfig, props: Record<string, unknown> = {}) {
    const fake = createFakeRenderer();

    function Harness() {
        const engine = useCanvasTileEngine();
        return <CanvasTileEngine engine={engine} config={config} renderer={fake.renderer} {...props} />;
    }

    const utils = render(<Harness />);
    act(() => emitLayout(300, 200));
    return { fake, ...utils };
}

const down = (e: GestureTouchEvent) => act(() => transportGesture().onTouchesDownHandler!(e));
const move = (e: GestureTouchEvent) => act(() => transportGesture().onTouchesMoveHandler!(e));
const up = (e: GestureTouchEvent) => act(() => transportGesture().onTouchesUpHandler!(e));
const cancel = (e: GestureTouchEvent) => act(() => transportGesture().onTouchesCancelledHandler!(e));

const pointers = (fake: Fake, spy: keyof Fake) => (fake[spy] as unknown as { mock: { calls: unknown[][] } }).mock.calls;

afterEach(() => {
    cleanup();
    resetReactNativeMock();
    resetSkiaMock();
    resetGestureMock();
    vi.restoreAllMocks();
});

describe("touch transport (react-native-gesture-handler)", () => {
    it("composes a JS-thread Manual transport with a callback-less Pan blocker", () => {
        mountEngine(INTERACTIVE);

        const transport = transportGesture();
        expect(transport.jsThread).toBe(true);
        expect(transport.onTouchesDownHandler).toBeTypeOf("function");
        expect(transport.onTouchesMoveHandler).toBeTypeOf("function");
        expect(transport.onTouchesUpHandler).toBeTypeOf("function");
        expect(transport.onTouchesCancelledHandler).toBeTypeOf("function");

        const blocker = blockerGesture();
        expect(blocker.isEnabled).toBe(true);
        expect(blocker.minDistanceValue).toBe(2);
        expect(blocker.maxPointersValue).toBe(10);
        expect(blocker.cancelWhenOutside).toBe(false);
    });

    it("forwards view-relative coordinates, never the screen-relative pair", () => {
        const { fake } = mountEngine(INTERACTIVE);

        down(touchEvent([{ id: 0, x: 40, y: 60 }]));

        expect(fake.dispatchTouchStart).toHaveBeenCalledWith([{ x: 40, y: 60, clientX: 40, clientY: 60 }]);
    });

    it("reports a tap as touchStart, touchEnd([]) and dispatchTap for the lifted pointer", () => {
        const { fake } = mountEngine(INTERACTIVE);

        down(touchEvent([{ id: 0, x: 40, y: 60 }]));
        up(touchEvent([{ id: 0, x: 42, y: 61 }]));

        expect(fake.dispatchTouchStart).toHaveBeenCalledTimes(1);
        // touchEnd carries no changed pointer: the engine's own touch-end click
        // path would double-fire alongside dispatchTap below.
        expect(fake.dispatchTouchEnd).toHaveBeenCalledWith([]);
        expect(fake.dispatchPointerUp).toHaveBeenCalledWith({ x: 42, y: 61, clientX: 42, clientY: 61 });
        expect(fake.dispatchTap).toHaveBeenCalledWith({ x: 42, y: 61, clientX: 42, clientY: 61 });
    });

    it("does not tap when the finger travelled past the move threshold", () => {
        const { fake } = mountEngine(INTERACTIVE);

        down(touchEvent([{ id: 0, x: 40, y: 60 }]));
        move(touchEvent([{ id: 0, x: 80, y: 60 }]));
        up(touchEvent([{ id: 0, x: 80, y: 60 }]));

        expect(fake.dispatchTouchMove).toHaveBeenCalledWith([{ x: 80, y: 60, clientX: 80, clientY: 60 }]);
        expect(fake.dispatchTap).not.toHaveBeenCalled();
        // The lift is still reported so onMouseUp fires.
        expect(fake.dispatchPointerUp).toHaveBeenCalledTimes(1);
    });

    it("re-dispatches touchStart when a second finger lands, and suppresses the tap afterwards", () => {
        const { fake } = mountEngine(INTERACTIVE);

        down(touchEvent([{ id: 0, x: 40, y: 60 }]));
        down(
            touchEvent(
                [
                    { id: 0, x: 40, y: 60 },
                    { id: 1, x: 100, y: 60 },
                ],
                [{ id: 1, x: 100, y: 60 }],
            ),
        );

        // Second start rebases the engine's pinch state with both pointers.
        expect(pointers(fake, "dispatchTouchStart")).toHaveLength(2);
        expect(pointers(fake, "dispatchTouchStart")[1][0]).toHaveLength(2);

        // First finger lifts, one remains.
        up(
            touchEvent(
                [
                    { id: 0, x: 40, y: 60 },
                    { id: 1, x: 100, y: 60 },
                ],
                [{ id: 0, x: 40, y: 60 }],
            ),
        );
        expect(fake.dispatchTouchEnd).toHaveBeenCalledWith([{ x: 100, y: 60, clientX: 100, clientY: 60 }]);

        // Final lift: multi-touch disqualifies both the tap and the pointer-up.
        up(touchEvent([{ id: 1, x: 100, y: 60 }]));
        expect(fake.dispatchTouchEnd).toHaveBeenLastCalledWith([]);
        expect(fake.dispatchTap).not.toHaveBeenCalled();
        expect(fake.dispatchPointerUp).not.toHaveBeenCalled();
    });

    it("resyncs the engine when a finger count change arrives only on move", () => {
        const { fake } = mountEngine(INTERACTIVE);

        down(touchEvent([{ id: 0, x: 40, y: 60 }]));
        // iOS can drop the second finger's start event; the move handler must
        // rebase instead of forwarding a 2-pointer move as a 1-pointer one.
        move(
            touchEvent([
                { id: 0, x: 40, y: 60 },
                { id: 1, x: 90, y: 60 },
            ]),
        );

        expect(pointers(fake, "dispatchTouchStart")).toHaveLength(2);
        expect(fake.dispatchTouchMove).not.toHaveBeenCalled();
    });

    it("never taps on a cancelled gesture", () => {
        const { fake } = mountEngine(INTERACTIVE);

        down(touchEvent([{ id: 0, x: 40, y: 60 }]));
        cancel(touchEvent([{ id: 0, x: 40, y: 60 }]));

        expect(fake.dispatchTouchEnd).toHaveBeenCalledWith([]);
        expect(fake.dispatchTap).not.toHaveBeenCalled();
    });

    it("leaves the touch stream alone when no interaction would consume it", () => {
        const { fake } = mountEngine(INERT);

        expect(blockerGesture().isEnabled).toBe(false);

        down(touchEvent([{ id: 0, x: 40, y: 60 }]));
        move(touchEvent([{ id: 0, x: 80, y: 60 }]));
        up(touchEvent([{ id: 0, x: 80, y: 60 }]));

        expect(fake.dispatchTouchStart).not.toHaveBeenCalled();
        expect(fake.dispatchTouchMove).not.toHaveBeenCalled();
        expect(fake.dispatchTouchEnd).not.toHaveBeenCalled();
        expect(fake.dispatchTap).not.toHaveBeenCalled();
    });

    it("claims the stream for onMouseDown/onMouseUp even when every config handler is off", () => {
        const onMouseDown = vi.fn();
        const { fake } = mountEngine(INERT, { onMouseDown });

        expect(blockerGesture().isEnabled).toBe(true);

        down(touchEvent([{ id: 0, x: 40, y: 60 }]));
        expect(fake.dispatchTouchStart).toHaveBeenCalledTimes(1);
    });
});
