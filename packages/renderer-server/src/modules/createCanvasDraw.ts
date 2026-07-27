import { CoordinateTransformer, ICamera } from "@canvas-tile-engine/core";
import { CanvasDraw, DrawContext, Layer, OffscreenCanvasFactory } from "@canvas-tile-engine/renderer-shared/canvas2d";
import { createCanvas, type Canvas, type Image, type SKRSContext2D } from "@napi-rs/canvas";

/** The shared Canvas2D pipeline instantiated for the @napi-rs/canvas platform. */
export type ServerCanvasDraw = CanvasDraw<SKRSContext2D, Image, Canvas>;

const createOffscreen: OffscreenCanvasFactory<SKRSContext2D, Canvas> = (width, height) => {
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");
    return ctx ? { canvas, ctx } : null;
};

/**
 * Wire the shared Canvas2D pipeline for the headless server: static caches
 * render to an in-memory @napi-rs/canvas surface.
 * @internal
 */
export function createServerCanvasDraw(
    layers: Layer<DrawContext<SKRSContext2D>>,
    transformer: CoordinateTransformer,
    camera: ICamera,
): ServerCanvasDraw {
    return new CanvasDraw(layers, transformer, camera, createOffscreen);
}
