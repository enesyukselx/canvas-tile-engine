import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ItemCollection, SelectionController, createItemCollectionSelectionAdapter } from "@canvas-tile-engine/core";
import { CanvasTileEngine } from "../../src/components/CanvasTileEngine";
import { useCanvasTileEngine } from "../../src/hooks/useCanvasTileEngine";
import { createFakeRenderer } from "../helpers/fakeRenderer";
import { emitLayout, resetReactNativeMock } from "../mocks/react-native";
import { resetSkiaMock } from "../mocks/react-native-skia";
import { blockerGesture, resetGestureMock, touchEvent, transportGesture } from "../mocks/react-native-gesture-handler";

afterEach(() => {
    cleanup();
    resetReactNativeMock();
    resetSkiaMock();
    resetGestureMock();
    vi.restoreAllMocks();
});

describe("native selection tool ownership", () => {
    it("claims touches with camera handlers off, forwards contact identity, and cancels the preview", () => {
        const fake = createFakeRenderer();
        let engine!: ReturnType<typeof useCanvasTileEngine>;
        function Harness() {
            engine = useCanvasTileEngine();
            return (
                <CanvasTileEngine
                    engine={engine}
                    renderer={fake.renderer}
                    config={{
                        scale: 10,
                        gridAligned: false,
                        size: { width: 0, height: 0 },
                        eventHandlers: { click: false, drag: false, hover: false, zoom: false },
                    }}
                />
            );
        }
        const mounted = render(<Harness />);
        act(() => emitLayout(300, 200));
        expect(blockerGesture().isEnabled).toBe(false);
        const items = new ItemCollection([{ id: "a", x: 0, y: 0 }], { keyOf: (item) => item.id });
        let selection!: SelectionController<{ id: string; x: number; y: number }>;
        const end = vi.fn(),
            observer = vi.fn();
        act(() => {
            const handle = engine.drawRect(items);
            selection = new SelectionController(engine, {
                adapter: createItemCollectionSelectionAdapter(items, { handle }),
                onTransformEnd: end,
            });
            engine.subscribeInput(observer);
            engine.setTool(selection);
        });
        expect(blockerGesture().isEnabled).toBe(true);
        act(() => transportGesture().onTouchesDownHandler!(touchEvent([{ id: 7, x: 155, y: 105 }])));
        expect(observer).toHaveBeenCalledWith(
            expect.objectContaining({
                type: "pointerdown",
                pointer: expect.objectContaining({ pointerId: 7, pointerType: "touch", x: 155, clientX: 155 }),
            }),
            true,
        );
        expect(selection.selectedIds).toEqual(["a"]);
        act(() => transportGesture().onTouchesMoveHandler!(touchEvent([{ id: 7, x: 175, y: 105 }])));
        expect(items.get("a")?.x).toBe(2);
        act(() => transportGesture().onTouchesCancelledHandler!(touchEvent([{ id: 7, x: 175, y: 105 }])));
        expect(fake.dispatchCancel).toHaveBeenCalledTimes(1);
        expect(items.get("a")?.x).toBe(0);
        expect(end).toHaveBeenCalledExactlyOnceWith({ kind: "translate", ids: ["a"], cancelled: true });
        act(() => engine.setTool(null));
        expect(blockerGesture().isEnabled).toBe(false);
        act(() => engine.setTool(selection));
        mounted.unmount();
        items.update("a", { x: 10 });
        expect(selection.getSnapshot().phase).toBe("idle");
        expect(end).toHaveBeenCalledTimes(1);
    });
});
