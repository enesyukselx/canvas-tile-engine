import type { ClipAdapter, DrawContext } from "../scene/Layer";
import { clipRectPx } from "../scene/clip";
import type { Canvas2DContextLike } from "./types";

/**
 * Clip adapter for Canvas2D-style contexts, shared by the browser and server
 * renderers.
 *
 * Returns nothing: a path clip is context state, and {@link Layer} already
 * runs the callback inside a `save()`/`restore()` pair, so it unwinds itself.
 * @internal
 */
export function canvas2dClipAdapter<TContext extends Canvas2DContextLike<never>>(): ClipAdapter<DrawContext<TContext>> {
    return ({ ctx, transformer }, clip) => {
        const rect = clipRectPx(clip, (x, y) => transformer.worldToScreen(x, y));
        ctx.beginPath();
        ctx.rect(rect.x, rect.y, rect.width, rect.height);
        ctx.clip();
    };
}
