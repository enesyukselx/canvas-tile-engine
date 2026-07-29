import { vi, type Mock } from "vitest";
import type { DrawHandle, IDrawAPI, IImageLoader, IRenderer, Rect as RectType } from "@canvas-tile-engine/core";

/**
 * Recording renderer: enough of IRenderer for the core engine to mount in
 * jsdom, plus a log of drawRect registrations and spies on the lifecycle
 * methods so tests can assert which engine instance children registered
 * against and how the component drives the renderer.
 */
export function createFakeRenderer() {
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

    // Explicit Mock annotations: the exported return type must not reference
    // vitest's internal @vitest/spy path (TS2742).
    const render: Mock = vi.fn();
    const resize: Mock = vi.fn();
    const resizeWithAnimation: Mock = vi.fn((_w: number, _h: number, _d: number, onComplete?: () => void) =>
        onComplete?.(),
    );
    const destroy: Mock = vi.fn();

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

    return { renderer, drawRectCalls, render, resize, resizeWithAnimation, destroy };
}
