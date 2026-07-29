import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type {
    CanvasTileEngineConfig,
    Coords,
    DrawHandle,
    DrawTransform,
    ImageItem,
    Rect as RectType,
    RectDrawOptions,
} from "@canvas-tile-engine/core";
import {
    Circle,
    DrawFunction,
    EngineContext,
    GridLines,
    Image,
    Line,
    Path,
    Rect,
    Sprite,
    StaticCircle,
    StaticImage,
    StaticRect,
    Text,
    type AnyEngineHandle,
} from "../src";

type RegisteredDrawFn = (
    ctx: unknown,
    coords: Coords,
    config: Required<CanvasTileEngineConfig>,
    transform: DrawTransform,
) => void;

/**
 * Fake engine handle: records registrations so tests can assert what the
 * components register, re-register, and clean up.
 */
function createFakeHandle() {
    const makeHandle = (layer = 1): DrawHandle => ({ id: Symbol("handle"), layer });
    return {
        drawRect: vi.fn((_items: RectType | RectType[], layer: number = 1, _options?: RectDrawOptions) =>
            makeHandle(layer),
        ),
        drawCircle: vi.fn(() => makeHandle()),
        drawLine: vi.fn(() => makeHandle()),
        drawText: vi.fn(() => makeHandle()),
        drawPath: vi.fn(() => makeHandle()),
        drawImage: vi.fn((_items: ImageItem<unknown> | ImageItem<unknown>[], layer: number = 1, _options?: unknown) =>
            makeHandle(layer),
        ),
        drawGridLines: vi.fn(() => makeHandle()),
        drawStaticRect: vi.fn(() => makeHandle()),
        drawStaticCircle: vi.fn(() => makeHandle()),
        drawStaticImage: vi.fn(() => makeHandle()),
        addDrawFunction: vi.fn((_fn: RegisteredDrawFn, layer: number = 1) => makeHandle(layer)),
        removeDrawHandle: vi.fn(),
        clearStaticCache: vi.fn(),
    };
}
type FakeHandle = ReturnType<typeof createFakeHandle>;

function renderWith(engine: FakeHandle, ui: ReactNode) {
    const requestRender = vi.fn();
    const value = { engine: engine as unknown as AnyEngineHandle, requestRender };
    const utils = render(<EngineContext.Provider value={value}>{ui}</EngineContext.Provider>);
    return {
        requestRender,
        unmount: utils.unmount,
        rerender: (next: ReactNode) =>
            utils.rerender(<EngineContext.Provider value={value}>{next}</EngineContext.Provider>),
    };
}

const TILE: RectType = { x: 0, y: 0, size: 1, style: { fillStyle: "#000" } };

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

describe("draw components", () => {
    it.each([
        ["Rect", "drawRect", () => <Rect items={TILE} />],
        ["Circle", "drawCircle", () => <Circle items={{ x: 1, y: 1 }} />],
        ["Line", "drawLine", () => <Line items={{ from: { x: 0, y: 0 }, to: { x: 1, y: 1 } }} />],
        ["Text", "drawText", () => <Text items={{ x: 0, y: 0, text: "hi" }} />],
        [
            "Path",
            "drawPath",
            () => (
                <Path
                    items={{
                        points: [
                            { x: 0, y: 0 },
                            { x: 1, y: 1 },
                        ],
                    }}
                />
            ),
        ],
        ["GridLines", "drawGridLines", () => <GridLines cellSize={1} />],
        ["Image", "drawImage", () => <Image items={{ x: 0, y: 0, img: "img" }} />],
        ["StaticRect", "drawStaticRect", () => <StaticRect items={[TILE]} cacheKey="sr" />],
        ["StaticCircle", "drawStaticCircle", () => <StaticCircle items={[{ x: 1, y: 1 }]} cacheKey="sc" />],
        ["StaticImage", "drawStaticImage", () => <StaticImage items={[{ x: 0, y: 0, img: "img" }]} cacheKey="si" />],
    ] as const)("%s registers on mount, removes its handle and repaints on unmount", (_name, method, makeUi) => {
        const engine = createFakeHandle();
        const { unmount, requestRender } = renderWith(engine, makeUi());

        expect(engine[method]).toHaveBeenCalledTimes(1);
        expect(requestRender).toHaveBeenCalled();
        const handle = engine[method].mock.results[0].value;
        const repaintsBeforeUnmount = requestRender.mock.calls.length;

        unmount();
        expect(engine.removeDrawHandle).toHaveBeenCalledWith(handle);
        expect(requestRender.mock.calls.length).toBeGreaterThan(repaintsBeforeUnmount);
    });

    it("re-registers when the items identity changes", () => {
        const engine = createFakeHandle();
        const first = [TILE];
        const { rerender } = renderWith(engine, <Rect items={first} layer={2} />);

        expect(engine.drawRect).toHaveBeenCalledTimes(1);
        expect(engine.drawRect.mock.calls[0][0]).toBe(first);
        expect(engine.drawRect.mock.calls[0][1]).toBe(2);
        const firstHandle = engine.drawRect.mock.results[0].value;

        // Same content, new identity: the draw callback must be re-registered.
        rerender(<Rect items={[TILE]} layer={2} />);
        expect(engine.drawRect).toHaveBeenCalledTimes(2);
        expect(engine.removeDrawHandle).toHaveBeenCalledWith(firstHandle);
    });

    it("reads styleOf through a ref: identity changes repaint but never re-register", () => {
        const engine = createFakeHandle();
        const items = [TILE];
        const styleA = vi.fn(() => ({ fillStyle: "a" }));
        const styleB = vi.fn(() => ({ fillStyle: "b" }));

        const { rerender, requestRender } = renderWith(engine, <Rect items={items} styleOf={styleA} />);
        expect(engine.drawRect).toHaveBeenCalledTimes(1);
        const options = engine.drawRect.mock.calls[0][2];
        const repaintsBefore = requestRender.mock.calls.length;

        rerender(<Rect items={items} styleOf={styleB} />);

        // No re-registration, but a repaint so the new closure reaches the canvas.
        expect(engine.drawRect).toHaveBeenCalledTimes(1);
        expect(requestRender.mock.calls.length).toBeGreaterThan(repaintsBefore);

        // The registered wrapper resolves to the latest prop at paint time.
        expect(options?.styleOf?.(TILE)).toEqual({ fillStyle: "b" });
        expect(styleB).toHaveBeenCalledWith(TILE);
        expect(styleA).not.toHaveBeenCalled();
    });

    it("reads interactiveOf through a ref: identity changes neither re-register nor repaint", () => {
        const engine = createFakeHandle();
        const items = [TILE];
        const interactiveA = vi.fn(() => true);
        const interactiveB = vi.fn(() => false);

        const { rerender, requestRender } = renderWith(engine, <Rect items={items} interactiveOf={interactiveA} />);
        expect(engine.drawRect).toHaveBeenCalledTimes(1);
        const options = engine.drawRect.mock.calls[0][2];
        const repaintsBefore = requestRender.mock.calls.length;

        rerender(<Rect items={items} interactiveOf={interactiveB} />);

        // Unlike styleOf/visibleOf there is no repaint either: hit queries
        // read the ref at query time, so nothing on the canvas changes.
        expect(engine.drawRect).toHaveBeenCalledTimes(1);
        expect(requestRender.mock.calls.length).toBe(repaintsBefore);

        // The registered wrapper resolves to the latest prop at query time.
        expect(options?.interactiveOf?.(TILE)).toBe(false);
        expect(interactiveB).toHaveBeenCalledWith(TILE);
        expect(interactiveA).not.toHaveBeenCalled();
    });

    // All three Static* components carry the same cache lifecycle in separate
    // files; parametrizing keeps them from drifting apart.
    const staticCases = [
        ["StaticRect", "drawStaticRect", (key: string) => <StaticRect items={[TILE]} cacheKey={key} />],
        ["StaticCircle", "drawStaticCircle", (key: string) => <StaticCircle items={[{ x: 1, y: 1 }]} cacheKey={key} />],
        [
            "StaticImage",
            "drawStaticImage",
            (key: string) => <StaticImage items={[{ x: 0, y: 0, img: "img" }]} cacheKey={key} />,
        ],
    ] as const;

    it.each(staticCases)(
        "%s drops the stale cache on items change and clears it on key change and unmount",
        (_name, method, makeUi) => {
            const engine = createFakeHandle();
            const { rerender, unmount } = renderWith(engine, makeUi("k1"));

            expect(engine[method]).toHaveBeenCalledTimes(1);
            expect(engine.clearStaticCache).not.toHaveBeenCalled();

            // Same key, new items identity: the renderer only rebuilds on a
            // cache miss, so the stale cache must be dropped explicitly.
            rerender(makeUi("k1"));
            expect(engine.clearStaticCache).toHaveBeenCalledWith("k1");
            expect(engine[method]).toHaveBeenCalledTimes(2);

            // Key change: the previous key's cache is cleared.
            engine.clearStaticCache.mockClear();
            rerender(makeUi("k2"));
            expect(engine.clearStaticCache).toHaveBeenCalledWith("k1");

            unmount();
            expect(engine.clearStaticCache).toHaveBeenLastCalledWith("k2");
        },
    );

    const emptyStaticCases = [
        ["StaticRect", "drawStaticRect", () => <StaticRect items={[]} cacheKey="k" />],
        ["StaticCircle", "drawStaticCircle", () => <StaticCircle items={[]} cacheKey="k" />],
        ["StaticImage", "drawStaticImage", () => <StaticImage items={[]} cacheKey="k" />],
    ] as const;

    it.each(emptyStaticCases)("%s registers nothing for empty items", (_name, method, makeUi) => {
        const engine = createFakeHandle();
        const { unmount } = renderWith(engine, makeUi());

        expect(engine[method]).not.toHaveBeenCalled();

        unmount();
        expect(engine.removeDrawHandle).not.toHaveBeenCalled();
    });

    it("Sprite clones caller items so the animation never mutates them", () => {
        const engine = createFakeHandle();
        const item = { x: 2, y: 3, img: "sheet" };

        renderWith(engine, <Sprite items={item} frames={[]} fps={4} />);

        expect(engine.drawImage).toHaveBeenCalledTimes(1);
        const drawn = engine.drawImage.mock.calls[0][0] as ImageItem<unknown>[];
        expect(drawn).toHaveLength(1);
        expect(drawn[0]).not.toBe(item);
        expect(drawn[0]).toMatchObject({ x: 2, y: 3, img: "sheet" });
        expect(item).not.toHaveProperty("sprite");
    });

    it("DrawFunction invokes the latest children closure without re-registering", () => {
        const engine = createFakeHandle();
        const fnA = vi.fn();
        const fnB = vi.fn();

        const { rerender } = renderWith(engine, <DrawFunction layer={3}>{fnA}</DrawFunction>);
        expect(engine.addDrawFunction).toHaveBeenCalledTimes(1);
        expect(engine.addDrawFunction.mock.calls[0][1]).toBe(3);
        const registered = engine.addDrawFunction.mock.calls[0][0];

        rerender(<DrawFunction layer={3}>{fnB}</DrawFunction>);
        expect(engine.addDrawFunction).toHaveBeenCalledTimes(1);

        const coords = { x: 1, y: 2 };
        const config = { scale: 1 } as unknown as Required<CanvasTileEngineConfig>;
        const transform = {} as DrawTransform;
        registered("ctx", coords, config, transform);

        expect(fnB).toHaveBeenCalledWith("ctx", coords, config, transform);
        expect(fnA).not.toHaveBeenCalled();
    });
});
