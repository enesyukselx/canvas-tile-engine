import { CanvasTileEngine, type CanvasTileEngineConfig, type Coords } from "@canvas-tile-engine/core";
import type { Image } from "@napi-rs/canvas";
import { RendererServer } from "./RendererServer";
import { SERVER_MOUNT, type ImageFormat, type ServerMount } from "./types";

/** Options for the one-shot {@link renderToBuffer} helper. */
export interface RenderToBufferOptions {
    /** Engine configuration (size, scale, background, coordinates, etc.). */
    config: CanvasTileEngineConfig;
    /** Initial center in world coordinates. Default `{ x: 0, y: 0 }`. */
    center?: Coords;
    /** Backing pixel ratio for the exported image (e.g. `2` for retina). Default `1`. */
    pixelRatio?: number;
    /** Output image format. Default `"png"`. */
    format?: ImageFormat;
    /** Quality 0–100 for `jpeg`/`webp` output (ignored for `png`). */
    quality?: number;
    /**
     * Register draw calls on the engine. May be async — e.g. to `await`
     * `engine.images.load(...)` before drawing images.
     */
    draw?: (engine: CanvasTileEngine<ServerMount, Image>) => void | Promise<void>;
}

/**
 * Render a map to an image `Buffer` in one call — wires up the engine and the
 * headless renderer, runs your `draw` callback, renders a single frame, and
 * encodes the result.
 *
 * @example
 * ```ts
 * const png = await renderToBuffer({
 *   config: { scale: 32, size: { width: 800, height: 600 }, backgroundColor: "#0b1021" },
 *   center: { x: 0, y: 0 },
 *   pixelRatio: 2,
 *   draw: (engine) => {
 *     engine.drawGridLines(1, 1, "#243", 0);
 *     engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#4ade80" } }, 1);
 *   },
 * });
 * await fs.writeFile("map.png", png);
 * ```
 */
export async function renderToBuffer(options: RenderToBufferOptions): Promise<Buffer> {
    const { config, center, pixelRatio, format = "png", quality, draw } = options;

    const renderer = new RendererServer({ pixelRatio });
    const engine = new CanvasTileEngine<ServerMount, Image>(SERVER_MOUNT, config, renderer, center);

    try {
        if (draw) await draw(engine);
        engine.render();
        return await renderer.encode(format, quality);
    } finally {
        engine.destroy();
    }
}
