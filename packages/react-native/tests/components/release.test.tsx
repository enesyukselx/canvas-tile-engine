import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { CanvasTileEngine } from "../../src/components/CanvasTileEngine";
import { useCanvasTileEngine } from "../../src/hooks/useCanvasTileEngine";
import { createFakeRenderer } from "../helpers/fakeRenderer";
import { emitLayout, resetReactNativeMock } from "../mocks/react-native";
import { resetSkiaMock } from "../mocks/react-native-skia";
import { resetGestureMock, touchEvent, transportGesture } from "../mocks/react-native-gesture-handler";

const FIRST = { id: 0, x: 40, y: 60 };
const SECOND = { id: 1, x: 100, y: 60 };
const BOTH = [FIRST, SECOND];
const CONFIG: CanvasTileEngineConfig = {
    scale: 10,
    size: { width: 0, height: 0 },
    eventHandlers: { drag: true, click: true, zoom: "pointer" },
};

function mountEngine(config = CONFIG, onRelease?: () => void) {
    const fake = createFakeRenderer();
    const events: string[] = [];
    const onMouseDown = vi.fn(() => events.push("down"));
    const onMouseUp = vi.fn(() => {
        events.push("up");
        onRelease?.();
    });
    const onMouseLeave = vi.fn(() => events.push("leave"));
    const onClick = vi.fn(() => events.push("click"));

    function Harness({ generation = 0 }: { generation?: number }) {
        const engine = useCanvasTileEngine();
        return (
            <CanvasTileEngine
                key={generation}
                engine={engine}
                config={config}
                renderer={fake.renderer}
                onMouseDown={onMouseDown}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                onClick={onClick}
            />
        );
    }

    const utils = render(<Harness />);
    act(() => emitLayout(300, 200));
    return {
        ...utils,
        fake,
        events,
        onMouseUp,
        onMouseLeave,
        remount: () => {
            utils.rerender(<Harness generation={1} />);
            act(() => emitLayout(300, 200));
        },
    };
}

const down = (all = [FIRST], changed = all) =>
    act(() => transportGesture().onTouchesDownHandler!(touchEvent(all, changed)));
const move = (all = [FIRST]) => act(() => transportGesture().onTouchesMoveHandler!(touchEvent(all)));
const up = (all = [FIRST], changed = all) =>
    act(() => transportGesture().onTouchesUpHandler!(touchEvent(all, changed)));
const cancel = (all = [FIRST], changed = all) =>
    act(() => transportGesture().onTouchesCancelledHandler!(touchEvent(all, changed)));

afterEach(() => {
    cleanup();
    resetReactNativeMock();
    resetSkiaMock();
    resetGestureMock();
    vi.restoreAllMocks();
});

describe("balanced native press callbacks (real wrapper, core and GestureProcessor)", () => {
    it("delivers exactly one down/up/click for a normal tap, despite repeated terminal events", () => {
        const { events } = mountEngine();
        down();
        up();
        up();
        cancel();
        expect(events).toEqual(["down", "up", "click"]);
    });

    it.each([true, false])("releases after both fingers lift together with zoom=%s", (zoom) => {
        const { events } = mountEngine({ ...CONFIG, eventHandlers: { ...CONFIG.eventHandlers, zoom } });
        down();
        down(BOTH, [SECOND]);
        up(BOTH);
        expect(events).toEqual(["down", "up"]);
    });

    it.each([FIRST, SECOND])("releases once after sequential lifts, first lifted id=$id", (lifted) => {
        const { events, fake } = mountEngine();
        const remaining = lifted.id === FIRST.id ? SECOND : FIRST;
        down();
        down(BOTH, [SECOND]);
        up(BOTH, [lifted]);
        expect(events).toEqual(["down"]);
        up([remaining]);
        expect(events).toEqual(["down", "up"]);
        expect(fake.dispatchPointerUp).toHaveBeenCalledWith({
            x: FIRST.x,
            y: FIRST.y,
            clientX: FIRST.x,
            clientY: FIRST.y,
        });
    });

    it("does not invent a release for a gesture that started with two fingers and emitted no down", () => {
        const { events } = mountEngine();
        down(BOTH);
        up(BOTH, [SECOND]);
        move([{ ...FIRST, x: 50 }]);
        up();
        expect(events).toEqual([]);
    });

    it.each(["move", "partial lift", "final lift"])(
        "balances release when the second start is missing, seen on %s",
        (signal) => {
            const { events } = mountEngine();
            down();
            if (signal === "move") {
                move(BOTH);
                up(BOTH);
            } else if (signal === "partial lift") {
                up(BOTH, [SECOND]);
                up();
            } else {
                up([], BOTH);
            }
            expect(events).toEqual(["down", "up"]);
        },
    );

    it("suppresses the cooldown tap without suppressing the restarted gesture's release", () => {
        vi.spyOn(Date, "now").mockReturnValue(10_000);
        const { events } = mountEngine();
        down();
        down(BOTH, [SECOND]);
        up(BOTH);
        down();
        up();
        expect(events).toEqual(["down", "up", "down", "up"]);
        vi.spyOn(Date, "now").mockReturnValue(10_401);
        down();
        up();
        expect(events).toEqual(["down", "up", "down", "up", "down", "up", "click"]);
    });

    it.each(["empty", "residual", "multitouch"])("cancels the whole press once with %s cancellation data", (data) => {
        const { events } = mountEngine();
        down();
        if (data === "multitouch") {
            down(BOTH, [SECOND]);
            cancel(BOTH, [SECOND]);
        } else if (data === "residual") {
            cancel([FIRST], []);
        } else {
            cancel([]);
        }
        move();
        up();
        cancel();
        expect(events).toEqual(["down", "leave"]);
        down();
        up();
        expect(events).toEqual(
            data === "multitouch" ? ["down", "leave", "down", "up"] : ["down", "leave", "down", "up", "click"],
        );
    });

    it("uses the last known view-relative position when a release has no changed touches", () => {
        const { events, fake } = mountEngine();
        down();
        move([{ ...FIRST, x: 70, y: 80 }]);
        up([]);
        expect(events).toEqual(["down", "up"]);
        expect(fake.dispatchPointerUp).toHaveBeenCalledWith({ x: 70, y: 80, clientX: 70, clientY: 80 });
    });

    it("cancels if a move reveals all touches disappeared, ignoring later stale terminal events", () => {
        const { events } = mountEngine();
        down();
        move([]);
        up();
        cancel();
        expect(events).toEqual(["down", "leave"]);
        down();
        up();
        expect(events).toEqual(["down", "leave", "down", "up", "click"]);
    });

    it("cancels before renderer destruction and does not replay the old press after remount", () => {
        const { events, fake, remount, unmount } = mountEngine();
        down();
        const oldTransport = transportGesture();
        remount();
        expect(events).toEqual(["down", "leave"]);
        expect(fake.dispatchPointerLeave.mock.invocationCallOrder[0]).toBeLessThan(
            fake.destroy.mock.invocationCallOrder[0],
        );
        act(() => oldTransport.onTouchesUpHandler!(touchEvent([FIRST])));
        down();
        up();
        unmount();
        expect(events).toEqual(["down", "leave", "down", "up", "click"]);
    });

    it("cancels an outstanding multitouch press on unmount without clicking or releasing twice", () => {
        const { events, fake, unmount } = mountEngine();
        down();
        down(BOTH, [SECOND]);
        const oldTransport = transportGesture();
        unmount();
        act(() => {
            oldTransport.onTouchesCancelledHandler!(touchEvent(BOTH));
            oldTransport.onTouchesUpHandler!(touchEvent(BOTH));
            oldTransport.onTouchesDownHandler!(touchEvent([FIRST]));
        });
        expect(events).toEqual(["down", "leave"]);
        expect(fake.dispatchTouchEnd).toHaveBeenCalledTimes(1);
        expect(fake.dispatchTouchStart).toHaveBeenCalledTimes(2);
        expect(fake.dispatchPointerUp).not.toHaveBeenCalled();
        expect(fake.dispatchTap).not.toHaveBeenCalled();
    });

    it("does not dispatch a stale tap if onMouseUp synchronously unmounts the component", () => {
        const mounted = mountEngine(CONFIG, () => mounted.unmount());
        down();
        up();
        expect(mounted.events).toEqual(["down", "up"]);
        expect(mounted.fake.destroy).toHaveBeenCalledTimes(1);
        expect(mounted.fake.dispatchTap).not.toHaveBeenCalled();
    });
});
