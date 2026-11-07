import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import {
    CanvasTileEngine,
    ItemCollection,
    useCanvasTileEngine,
    useEngineContext,
    type EngineHandle,
    type Rect,
} from "../../src";
import { createFakeRenderer } from "../helpers/fakeRenderer";

type Seat = { id: string };
const CONFIG = { scale: 10, size: { width: 100, height: 100 } };

function createSeats() {
    return new ItemCollection<Rect<Seat>>([{ x: 0, y: 0, size: 1, data: { id: "a" } }], {
        keyOf: (item) => item.data!.id,
    });
}

function stubFrames() {
    const pending = new Map<number, FrameRequestCallback>();
    let nextId = 1;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("live item collections", () => {
    it("updates hit geometry and repaints without rerendering React or re-registering the draw", () => {
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
        fireFrame();
        const rendersBefore = componentRenders;
        const registrationsBefore = fake.drawRectCalls.length;
        const framesBefore = fake.render.mock.calls.length;
        expect(captured!.hitTestFirst<Seat>({ x: 0.5, y: 0.5 })?.item.data?.id).toBe("a");

        act(() =>
            seats.batch(() => {
                seats.update("a", { x: 6 });
                seats.insert({ x: 3, y: 0, size: 1, data: { id: "b" } });
            }),
        );
        // Ordinary draw-component repaints and live updates share one scheduler.
        requestChildRender();

        // Queries observe the changes synchronously, before the requested frame.
        expect(captured!.hitTestFirst({ x: 0.5, y: 0.5 })).toBeUndefined();
        expect(captured!.hitTestFirst<Seat>({ x: 6.5, y: 0.5 })?.item.data?.id).toBe("a");
        expect(captured!.hitTestFirst<Seat>({ x: 3.5, y: 0.5 })?.item.data?.id).toBe("b");
        expect(fake.applyDrawChanges).toHaveBeenCalledTimes(1);
        expect(componentRenders).toBe(rendersBefore);
        expect(fake.drawRectCalls).toHaveLength(registrationsBefore);

        fireFrame();
        expect(fake.render).toHaveBeenCalledTimes(framesBefore + 1);
        expect(fake.liveCount("rect")).toBe(1);
    });

    it("detaches the collection when its draw component unmounts", () => {
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
        expect(fake.liveCount("rect")).toBe(0);
        expect(captured!.hitTest({ x: 6.5, y: 0.5 })).toEqual([]);

        // The collection is app-owned and can be attached again with its latest data.
        rerender(<Harness shown />);
        expect(captured!.hitTestFirst<Seat>({ x: 6.5, y: 0.5 })?.item.data?.id).toBe("a");
        expect(fake.liveCount("rect")).toBe(1);
    });
});
