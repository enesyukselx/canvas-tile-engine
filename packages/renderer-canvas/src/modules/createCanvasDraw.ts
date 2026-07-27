import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { CanvasDraw, DrawContext, Layer, OffscreenCanvasFactory } from "@canvas-tile-engine/renderer-shared/canvas2d";

/** Browser 2D contexts the shared pipeline runs on: the visible canvas plus offscreen static caches. */
export type BrowserContext2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
/** Offscreen surface used for static caching (OffscreenCanvas with a DOM-canvas fallback). */
export type BrowserOffscreenCanvas = OffscreenCanvas | HTMLCanvasElement;
/** The shared Canvas2D pipeline instantiated for the browser platform. */
export type BrowserCanvasDraw = CanvasDraw<BrowserContext2D, HTMLImageElement, BrowserOffscreenCanvas>;

const createOffscreen: OffscreenCanvasFactory<BrowserContext2D, BrowserOffscreenCanvas> = (width, height) => {
    const canvas =
        typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(width, height) : document.createElement("canvas");

    // Guard instanceof with typeof to avoid ReferenceError when OffscreenCanvas is undefined (e.g., jsdom)
    const isOffscreenCanvas = typeof OffscreenCanvas !== "undefined" && canvas instanceof OffscreenCanvas;
    if (!isOffscreenCanvas) {
        (canvas as HTMLCanvasElement).width = width;
        (canvas as HTMLCanvasElement).height = height;
    }

    const ctx = canvas.getContext("2d") as BrowserContext2D | null;
    return ctx ? { canvas, ctx } : null;
};

/**
 * Wire the shared Canvas2D pipeline for the browser: static caches render to
 * an OffscreenCanvas when available, falling back to a detached DOM canvas,
 * and are disabled entirely when neither exists.
 * @internal
 */
export function createBrowserCanvasDraw(
    layers: Layer<DrawContext<BrowserContext2D>>,
    transformer: CoordinateTransformer,
    camera: ICamera,
): BrowserCanvasDraw {
    const staticCacheSupported = typeof OffscreenCanvas !== "undefined" || typeof document !== "undefined";
    return new CanvasDraw(layers, transformer, camera, staticCacheSupported ? createOffscreen : null);
}
