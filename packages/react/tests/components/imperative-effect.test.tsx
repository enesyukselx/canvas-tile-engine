import { StrictMode, useEffect } from "react";
import { describe, expect, it, afterEach, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { IRenderer, Rect as RectType } from "@canvas-tile-engine/core";
import { CanvasTileEngine, useCanvasTileEngine, type EngineHandle } from "../../src";
import { createFakeRenderer } from "../helpers/fakeRenderer";

const CONFIG = { scale: 10, size: { width: 100, height: 100 } };
const TILES: RectType[] = [{ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }];
// World point inside the single tile: hit testing reads the engine's own
// registry, one result per live registration of that tile.
const ON_TILE = { x: 0, y: 0 };

type Form = "id" | "cleanup";

/**
 * The documented imperative pattern (see the CanvasTileEngine JSDoc): key the
 * effect on engine.instance and keep its body idempotent, either with ids or
 * with a cleanup that removes what it registered.
 */
function DocumentedHarness({
    renderer,
    form,
    engineKey = "a",
    onHandle,
}: {
    renderer: IRenderer;
    form: Form;
    engineKey?: string;
    onHandle?: (engine: EngineHandle) => void;
}) {
    const engine = useCanvasTileEngine();
    onHandle?.(engine);
    useEffect(() => {
        if (!engine.instance) {
            return;
        }
        if (form === "id") {
            engine.drawGridLines(50, 1, "#ccc", 0, { id: "grid" });
            engine.drawRect(TILES, 1, { id: "tiles" });
            engine.render();
            return;
        }
        const grid = engine.drawGridLines(50, 1, "#ccc", 0);
        const tiles = engine.drawRect(TILES, 1);
        engine.render();
        return () => {
            engine.removeDrawHandle(grid);
            engine.removeDrawHandle(tiles);
        };
    }, [engine, engine.instance, form]);
    return <CanvasTileEngine key={engineKey} engine={engine} config={CONFIG} renderer={renderer} />;
}

function expectOneLiveRegistration(fake: ReturnType<typeof createFakeRenderer>, engine: EngineHandle) {
    expect(fake.liveCount("gridLines")).toBe(1);
    expect(fake.liveCount("rect")).toBe(1);
    expect(engine.hitTest(ON_TILE)).toHaveLength(1);
}

describe.each<Form>(["id", "cleanup"])("documented imperative effect (%s form)", (form) => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("leaves exactly one live registration after the first mount", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;
        render(<DocumentedHarness renderer={fake.renderer} form={form} onHandle={(e) => (captured = e)} />);

        expectOneLiveRegistration(fake, captured!);
    });

    it("leaves exactly one live registration on the surviving engine under StrictMode", () => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;
        render(
            <StrictMode>
                <DocumentedHarness renderer={fake.renderer} form={form} onHandle={(e) => (captured = e)} />
            </StrictMode>,
        );

        // The dev double-mount destroyed the first engine (and the renderer's
        // registrations with it); the handle and the hit test follow the
        // second one.
        expect(fake.destroy).toHaveBeenCalledTimes(1);
        expectOneLiveRegistration(fake, captured!);
    });

    it("leaves exactly one live registration on the new engine after a key remount", () => {
        const a = createFakeRenderer();
        const b = createFakeRenderer();
        let captured: EngineHandle | null = null;
        const onHandle = (e: EngineHandle) => (captured = e);

        const { rerender } = render(
            <DocumentedHarness renderer={a.renderer} form={form} engineKey="a" onHandle={onHandle} />,
        );
        expectOneLiveRegistration(a, captured!);

        rerender(<DocumentedHarness renderer={b.renderer} form={form} engineKey="b" onHandle={onHandle} />);

        expect(a.destroy).toHaveBeenCalledTimes(1);
        expectOneLiveRegistration(b, captured!);
    });
});

describe("imperative effect without an id or cleanup", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    /**
     * Pins the current runtime behavior behind the idempotent examples (#263):
     * the engine attaches in a passive effect of <CanvasTileEngine>, which runs
     * before the handle owner's effects, so the owner's mount effect already
     * sees the engine and draws, and the re-render the attach triggers changes
     * its deps and draws again. A runtime change that runs such an effect once
     * per engine must update this test on purpose.
     */
    it.each([
        ["engine.isReady", (engine: EngineHandle) => engine.isReady],
        ["engine.instance", (engine: EngineHandle) => engine.instance],
    ])("keyed on %s registers twice on first mount", (_name, keyOf) => {
        const fake = createFakeRenderer();
        let captured: EngineHandle | null = null;

        function RawHarness() {
            const engine = useCanvasTileEngine();
            captured = engine;
            const dep = keyOf(engine);
            useEffect(() => {
                if (!engine.isReady) {
                    return;
                }
                engine.drawRect(TILES, 1);
            }, [engine, dep]);
            return <CanvasTileEngine engine={engine} config={CONFIG} renderer={fake.renderer} />;
        }

        render(<RawHarness />);

        expect(fake.liveCount("rect")).toBe(2);
        expect(captured!.hitTest(ON_TILE)).toHaveLength(2);
    });
});
