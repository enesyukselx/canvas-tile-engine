import { vi, type Mock } from "vitest";
import type { DrawHandle, IDrawAPI, IImageLoader, IRenderer, Rect as RectType } from "@canvas-tile-engine/core";

/**
 * Recording renderer: enough of IRenderer for the core engine to mount in
 * jsdom, plus a log of drawRect registrations and spies on the lifecycle
 * methods so tests can assert which engine instance children registered
 * against and how the component drives the renderer.
 *
 * It also keeps the set of registrations still live, so tests can count what
 * is actually drawn rather than how often a draw method was called: core
 * calls `removeDrawHandle` here when a same-id draw replaces an older one, as
 * well as for an explicit removal.
 */
export function createFakeRenderer() {
    const drawRectCalls: Array<RectType | RectType[]> = [];
    // Live registrations by handle id. Destroying the renderer drops them all,
    // so with one renderer shared by two engines (StrictMode's dev
    // double-mount) only the surviving engine's registrations remain.
    const live = new Map<symbol, { kind: string; layer: number }>();
    const register = (kind: string, layer = 1): DrawHandle => {
        const handle: DrawHandle = { id: Symbol("handle"), layer };
        live.set(handle.id, { kind, layer });
        return handle;
    };

    const drawAPI = {
        addDrawFunction: (_fn: unknown, layer?: number) => register("drawFunction", layer),
        drawRect: (items: RectType | RectType[], layer?: number) => {
            drawRectCalls.push(items);
            return register("rect", layer);
        },
        drawCircle: (_items: unknown, layer?: number) => register("circle", layer),
        drawLine: (_items: unknown, _style: unknown, layer?: number) => register("line", layer),
        drawText: (_items: unknown, layer?: number) => register("text", layer),
        drawImage: (_items: unknown, layer?: number) => register("image", layer),
        drawPath: (_items: unknown, layer?: number) => register("path", layer),
        drawGridLines: (_cellSize: unknown, _style: unknown, layer?: number) => register("gridLines", layer),
        drawStaticRect: (_items: unknown, _key: unknown, layer?: number) => register("staticRect", layer),
        drawStaticCircle: (_items: unknown, _key: unknown, layer?: number) => register("staticCircle", layer),
        drawStaticImage: (_items: unknown, _key: unknown, layer?: number) => register("staticImage", layer),
        removeDrawHandle: (handle: DrawHandle) => {
            live.delete(handle.id);
        },
        clearLayer: (layer: number) => {
            for (const [id, registration] of live) {
                if (registration.layer === layer) {
                    live.delete(id);
                }
            }
        },
        clearAll: () => live.clear(),
        clearStaticCache: () => {},
    } as unknown as IDrawAPI;

    /** How many registrations of a kind (`"rect"`, `"gridLines"`, ...) are still live. */
    const liveCount = (kind: string): number => [...live.values()].filter((r) => r.kind === kind).length;

    const imageLoader: IImageLoader = {
        load: () => Promise.reject(new Error("not supported")),
        get: () => undefined,
        has: () => false,
        clear: () => {},
        onLoad: () => () => {},
    };

    // Explicit Mock annotations: the exported return type must not reference
    // vitest's internal @vitest/spy path (TS2742).
    const render: Mock = vi.fn();
    const resize: Mock = vi.fn();
    const resizeWithAnimation: Mock = vi.fn((_w: number, _h: number, _d: number, onComplete?: () => void) =>
        onComplete?.(),
    );
    const destroy: Mock = vi.fn(() => live.clear());

    const renderer: IRenderer = {
        init: () => {},
        render,
        resize,
        resizeWithAnimation,
        destroy,
        getDrawAPI: () => drawAPI,
        getImageLoader: () => imageLoader,
        setupEvents: () => {},
    };

    return { renderer, drawRectCalls, liveCount, render, resize, resizeWithAnimation, destroy };
}
