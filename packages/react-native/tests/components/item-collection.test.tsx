import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import {
    CanvasTileEngine,
    ItemCollection,
    useCanvasTileEngine,
    useEngineContext,
    type CanvasTileEngineConfig,
    type EngineHandle,
    type Rect,
} from "../../src";
import { createFakeRenderer } from "../helpers/fakeRenderer";
import { emitLayout, resetReactNativeMock } from "../mocks/react-native";
import { resetSkiaMock } from "../mocks/react-native-skia";
import { resetGestureMock } from "../mocks/react-native-gesture-handler";

type Seat = { id: string };
const CONFIG: CanvasTileEngineConfig = { scale: 10, size: { width: 0, height: 0 } };

function createSeats() {
    return new ItemCollection<Rect<Seat>>([{ x: 0, y: 0, size: 1, data: { id: "a" } }], {
        keyOf: (item) => item.data!.id,
    });
}

function stubFrames() {
    const pending = new Map<number, (time: number) => void>();
    let nextId = 1;
    vi.stubGlobal("requestAnimationFrame", (callback: (time: number) => void) => {
        const id = nextId++;
        pending.set(id, callback);
        return id;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => pending.delete(id));
    return () =>
        act(() => {
            const callbacks = [...pending.values()];
            pending.clear();
            callbacks.forEach((callback) => callback(0));
        });
}

afterEach(() => {
    cleanup();
    resetReactNativeMock();
    resetSkiaMock();
    resetGestureMock();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("live item collections (React Native)", () => {
    it("updates and presents a frame without rerendering the item owner or re-registering the draw", () => {
        const fireFrame = stubFrames();
        const fake = createFakeRenderer();
        const seats = createSeats();
        let captured: EngineHandle | null = null;
        let componentRenders = 0;
        let requestChildRender: () => void = () => {};

        function RenderProbe() {
            requestChildRender = useEngineContext().requestRender;
            return null;
        }

        function Harness() {
            componentRenders++;
            const engine = useCanvasTileEngine();
            captured = engine;
            return (
                <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer}>
                    <CanvasTileEngine.Rect items={seats} />
                    <RenderProbe />
                </CanvasTileEngine>
            );
        }

        render(<Harness />);
        act(() => emitLayout(300, 200));
        fireFrame();
        const rendersBefore = componentRenders;
        const registrationsBefore = fake.drawRectCalls.length;
        const framesBefore = fake.render.mock.calls.length;
        const paintsBefore = fake.paintFrame.mock.calls.length;
        expect(captured!.hitTestFirst<Seat>({ x: 0.5, y: 0.5 })?.item.data?.id).toBe("a");

        act(() =>
            seats.batch(() => {
                seats.update("a", { x: 6 });
                seats.insert({ x: 3, y: 0, size: 1, data: { id: "b" } });
            }),
        );
        requestChildRender();

        expect(captured!.hitTestFirst({ x: 0.5, y: 0.5 })).toBeUndefined();
        expect(captured!.hitTestFirst<Seat>({ x: 6.5, y: 0.5 })?.item.data?.id).toBe("a");
        expect(captured!.hitTestFirst<Seat>({ x: 3.5, y: 0.5 })?.item.data?.id).toBe("b");
        expect(fake.applyDrawChanges).toHaveBeenCalledTimes(1);
        expect(fake.drawRectCalls).toHaveLength(registrationsBefore);

        fireFrame();
        expect(fake.render).toHaveBeenCalledTimes(framesBefore + 1);
        expect(fake.paintFrame.mock.calls.length).toBeGreaterThan(paintsBefore);
        expect(componentRenders).toBe(rendersBefore);
    });

    it("removes its collection subscription when the draw component unmounts", () => {
        const fireFrame = stubFrames();
        const fake = createFakeRenderer();
        const seats = createSeats();
        let captured: EngineHandle | null = null;

        function Harness({ shown }: { shown: boolean }) {
            const engine = useCanvasTileEngine();
            captured = engine;
            return (
                <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer}>
                    {shown && <CanvasTileEngine.Rect items={seats} />}
                </CanvasTileEngine>
            );
        }

        const { rerender } = render(<Harness shown />);
        act(() => emitLayout(300, 200));
        fireFrame();
        rerender(<Harness shown={false} />);
        fireFrame();
        const framesAfterUnmount = fake.render.mock.calls.length;
        fake.applyDrawChanges.mockClear();

        act(() => {
            seats.update("a", { x: 6 });
        });
        fireFrame();

        expect(fake.applyDrawChanges).not.toHaveBeenCalled();
        expect(fake.render).toHaveBeenCalledTimes(framesAfterUnmount);
        expect(captured!.hitTest({ x: 6.5, y: 0.5 })).toEqual([]);

        rerender(<Harness shown />);
        expect(captured!.hitTestFirst<Seat>({ x: 6.5, y: 0.5 })?.item.data?.id).toBe("a");
    });
});
