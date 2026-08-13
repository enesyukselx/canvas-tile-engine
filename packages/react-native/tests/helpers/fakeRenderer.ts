import { vi, type Mock } from "vitest";
import type {
    DrawHandle,
    IDrawAPI,
    IImageLoader,
    Rect as RectType,
    RendererDependencies,
} from "@canvas-tile-engine/core";
import type { RendererSkia, SkiaMount, SkImage } from "@canvas-tile-engine/renderer-skia";

/**
 * Recording stand-in for `RendererSkia`: enough of the renderer contract for
 * the real core engine to mount, plus spies on the lifecycle and on the
 * `dispatch*` touch API the React Native component forwards gestures through.
 *
 * `render()` goes through `mount.present()` exactly like the real renderer, so
 * the component's picture pipeline (createPicture → <Picture>) is exercised
 * without any Skia code.
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
        destroy: () => {},
    } as unknown as IDrawAPI<SkImage>;

    const imageLoader: IImageLoader<SkImage> = {
        load: () => Promise.reject(new Error("not supported")),
        get: () => undefined,
        has: () => false,
        clear: () => {},
        onLoad: () => () => {},
    };

    let mount: SkiaMount | undefined;
    let viewport: RendererDependencies<SkiaMount>["viewport"] | undefined;

    /** The frame painter handed to the host; identity is asserted in tests. */
    const paintFrame: Mock = vi.fn();

    // Explicit Mock annotations: the exported return type must not reference
    // vitest's internal @vitest/spy path (TS2742).
    const render: Mock = vi.fn(() => {
        mount?.present(paintFrame as unknown as Parameters<SkiaMount["present"]>[0]);
    });
    const resize: Mock = vi.fn((width: number, height: number) => {
        viewport?.setSize(width, height);
        render();
    });
    const resizeWithAnimation: Mock = vi.fn(
        (width: number, height: number, _durationMs: number, onComplete?: () => void) => {
            viewport?.setSize(width, height);
            render();
            onComplete?.();
        },
    );
    const destroy: Mock = vi.fn();

    const dispatchTap: Mock = vi.fn();
    const dispatchPointerDown: Mock = vi.fn();
    const dispatchPointerMove: Mock = vi.fn();
    const dispatchPointerUp: Mock = vi.fn();
    const dispatchPointerLeave: Mock = vi.fn();
    const dispatchTouchStart: Mock = vi.fn();
    const dispatchTouchMove: Mock = vi.fn();
    const dispatchTouchEnd: Mock = vi.fn();

    const renderer = {
        init: (deps: RendererDependencies<SkiaMount>) => {
            mount = deps.wrapper;
            viewport = deps.viewport;
        },
        render,
        resize,
        resizeWithAnimation,
        destroy,
        getDrawAPI: () => drawAPI,
        getImageLoader: () => imageLoader,
        setupEvents: () => {},
        dispatchTap,
        dispatchPointerDown,
        dispatchPointerMove,
        dispatchPointerUp,
        dispatchPointerLeave,
        dispatchTouchStart,
        dispatchTouchMove,
        dispatchTouchEnd,
    } as unknown as RendererSkia;

    return {
        renderer,
        drawRectCalls,
        paintFrame,
        render,
        resize,
        resizeWithAnimation,
        destroy,
        dispatchTap,
        dispatchPointerDown,
        dispatchPointerMove,
        dispatchPointerUp,
        dispatchPointerLeave,
        dispatchTouchStart,
        dispatchTouchMove,
        dispatchTouchEnd,
        /** Size the host reports through the mount contract. */
        getMountSize: () => mount?.getSize(),
        /** DPR the host reports through the mount contract. */
        getMountDpr: () => mount?.getDpr(),
    };
}
