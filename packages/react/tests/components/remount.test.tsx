import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { DrawHandle, IDrawAPI, IImageLoader, IRenderer, Rect as RectType } from "@canvas-tile-engine/core";
import { CanvasTileEngine, useCanvasTileEngine } from "../../src";

/**
 * Recording renderer: enough of IRenderer for the core engine to mount in
 * jsdom, plus a log of drawRect registrations so tests can assert which
 * engine instance the declarative children registered against.
 */
function createFakeRenderer() {
    const drawRectCalls: Array<RectType | RectType[]> = [];
    const makeHandle = (layer = 1): DrawHandle => ({ id: Symbol("handle"), layer });

    const drawAPI = {
        addDrawFunction: () => makeHandle(),
        drawRect: (items: RectType | RectType[], layer?: number) => {
            drawRectCalls.push(items);
            return makeHandle(layer);
        },
        drawCircle: () => makeHandle(),
        drawLine: () => makeHandle(),
        drawText: () => makeHandle(),
        drawImage: () => makeHandle(),
        drawPath: () => makeHandle(),
        drawGridLines: () => makeHandle(),
        drawStaticRect: () => makeHandle(),
        drawStaticCircle: () => makeHandle(),
        drawStaticImage: () => makeHandle(),
        removeDrawHandle: () => {},
        clearLayer: () => {},
        clearAll: () => {},
        clearStaticCache: () => {},
    } as unknown as IDrawAPI;

    const imageLoader: IImageLoader = {
        load: () => Promise.reject(new Error("not supported")),
        get: () => undefined,
        has: () => false,
        clear: () => {},
        onLoad: () => () => {},
    };

    const renderer: IRenderer = {
        init: () => {},
        render: () => {},
        resize: () => {},
        resizeWithAnimation: (_w, _h, _d, onComplete) => onComplete?.(),
        destroy: () => {},
        getDrawAPI: () => drawAPI,
        getImageLoader: () => imageLoader,
        setupEvents: () => {},
    };

    return { renderer, drawRectCalls };
}

const CONFIG = { scale: 10, size: { width: 100, height: 100 } };
const TILES: RectType[] = [{ x: 0, y: 0, size: 1, style: { fillStyle: "#22c55e" } }];

/**
 * The handle lives here and survives the key change below — that is the bug
 * scenario: only the CanvasTileEngine subtree remounts, not the handle owner.
 */
function Harness({ renderer, engineKey }: { renderer: IRenderer; engineKey: string }) {
    const engine = useCanvasTileEngine();
    return (
        <CanvasTileEngine key={engineKey} engine={engine} config={CONFIG} renderer={renderer}>
            <CanvasTileEngine.Rect items={TILES} layer={1} />
        </CanvasTileEngine>
    );
}

describe("CanvasTileEngine remount with key", () => {
    afterEach(() => {
        cleanup();
        vi.restoreAllMocks();
    });

    it("registers declarative children on first mount", () => {
        const a = createFakeRenderer();
        render(<Harness renderer={a.renderer} engineKey="a" />);

        expect(a.drawRectCalls).toHaveLength(1);
        expect(a.drawRectCalls[0]).toBe(TILES);
    });

    it("re-registers declarative children on the new engine after a key remount", () => {
        const a = createFakeRenderer();
        const b = createFakeRenderer();

        const { rerender } = render(<Harness renderer={a.renderer} engineKey="a" />);
        expect(a.drawRectCalls).toHaveLength(1);

        // Swap the key (documented way to change renderer/config): the old
        // engine is destroyed and a new one is created in the same commit.
        rerender(<Harness renderer={b.renderer} engineKey="b" />);

        // The children must register against the NEW engine, not get dropped
        // into the null-instance window between destroy and create.
        expect(b.drawRectCalls).toHaveLength(1);
        expect(b.drawRectCalls[0]).toBe(TILES);
    });

    it("warns in dev when a draw call happens before the engine mounts", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

        function Imperative() {
            const engine = useCanvasTileEngine();
            // Called during render, before any engine exists.
            engine.drawRect(TILES, 1);
            return null;
        }
        render(<Imperative />);

        expect(warn).toHaveBeenCalledWith(expect.stringContaining("drawRect() was called before the engine mounted"));
    });
});
