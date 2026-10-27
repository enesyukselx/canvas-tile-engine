import { StrictMode, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import type { CanvasTileEngineConfig, Rect as RectType } from "@canvas-tile-engine/core";
import type { RendererSkia } from "@canvas-tile-engine/renderer-skia";
import { CanvasTileEngine } from "../../src/components/CanvasTileEngine";
import { useCanvasTileEngine, type EngineHandle } from "../../src/hooks/useCanvasTileEngine";
import { createFakeRenderer } from "../helpers/fakeRenderer";
import { emitLayout, resetReactNativeMock } from "../mocks/react-native";
import { resetSkiaMock } from "../mocks/react-native-skia";
import { resetGestureMock } from "../mocks/react-native-gesture-handler";

const CONFIG: CanvasTileEngineConfig = { scale: 10, size: { width: 0, height: 0 } };
const TILES: RectType[] = [{ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }];
// World point inside the single tile: hit testing reads the engine's own
// registry, one result per live registration of that tile.
const ON_TILE = { x: 0, y: 0 };

/**
 * The documented imperative pattern (see the CanvasTileEngine JSDoc): key the
 * effect on engine.instance and draw with an id, so however often the effect
 * runs for one engine, it leaves a single registration behind.
 */
function DocumentedHarness({
    renderer,
    engineKey = "a",
    onHandle,
}: {
    renderer: RendererSkia;
    engineKey?: string;
    onHandle?: (engine: EngineHandle) => void;
}) {
    const engine = useCanvasTileEngine();
    onHandle?.(engine);
    useEffect(() => {
        if (!engine.instance) {
            return;
        }
        engine.drawRect(TILES, 1, { id: "tiles" });
        engine.render();
    }, [engine, engine.instance]);
    return <CanvasTileEngine key={engineKey} engine={engine} config={CONFIG} renderer={renderer} />;
}

afterEach(() => {
    cleanup();
    resetReactNativeMock();
    resetSkiaMock();
    resetGestureMock();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

describe("documented imperative effect (React Native)", () => {
    it("leaves exactly one live registration after the first layout", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;
        render(<DocumentedHarness renderer={fake.renderer} onHandle={(e) => (captured = e)} />);

        act(() => emitLayout(300, 200));

        expect(captured!.hitTest(ON_TILE)).toHaveLength(1);
    });

    it("leaves exactly one live registration under StrictMode", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;
        render(
            <StrictMode>
                <DocumentedHarness renderer={fake.renderer} onHandle={(e) => (captured = e)} />
            </StrictMode>,
        );

        act(() => emitLayout(300, 200));

        expect(captured!.hitTest(ON_TILE)).toHaveLength(1);
    });

    it("leaves exactly one live registration on the new engine after a key remount", () => {
        const a = createFakeRenderer();
        const b = createFakeRenderer();
        let captured: EngineHandle | null = null;
        const onHandle = (e: EngineHandle) => (captured = e);

        const { rerender } = render(<DocumentedHarness renderer={a.renderer} engineKey="a" onHandle={onHandle} />);
        act(() => emitLayout(300, 200));
        const first = captured!.instance;
        expect(captured!.hitTest(ON_TILE)).toHaveLength(1);

        rerender(<DocumentedHarness renderer={b.renderer} engineKey="b" onHandle={onHandle} />);
        // The new component creates its engine on its own first layout.
        act(() => emitLayout(300, 200));

        expect(captured!.instance).not.toBe(first);
        expect(captured!.hitTest(ON_TILE)).toHaveLength(1);
        expect(b.drawRectCalls.length).toBeGreaterThanOrEqual(1);
    });
});
