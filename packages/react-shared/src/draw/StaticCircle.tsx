import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../EngineContext";
import type { Bounds, Circle as CircleType } from "@canvas-tile-engine/core";

export interface StaticCircleProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: CircleType[];
    cacheKey: string;
    layer?: number;
    /**
     * Set to `false` to keep these items out of hit testing — the
     * `pointer-events: none` of the draw API, for decorative content.
     * Default `true`.
     */
    hitTest?: boolean;
    /**
     * Confine this registration to a world rectangle: nothing it draws paints
     * outside it, and nothing outside it hit-tests. Compared by value, so an
     * inline object literal does not re-register on every render.
     */
    clip?: Bounds;
}

/**
 * Draws circles through the engine's `drawStaticCircle` API: the renderer
 * caches the items once (keyed by `cacheKey`) — e.g. an offscreen pre-render
 * on Canvas2D, a recorded picture on Skia — and replays the cached result
 * each frame. Prefer this over `Circle` for large item sets that don't
 * change.
 */
export const StaticCircle = memo(function StaticCircle({
    items,
    cacheKey,
    layer = 1,
    hitTest,
    clip,
}: StaticCircleProps) {
    const { engine, requestRender } = useEngineContext();

    // Value-compared so an inline clip literal does not re-register the
    // draw call on every render.
    const clipKey = clip ? `${clip.minX},${clip.maxX},${clip.minY},${clip.maxY}` : "";
    const prevCacheKeyRef = useRef<string>(cacheKey);
    const prevItemsRef = useRef(items);

    useEffect(() => {
        if (items.length === 0) {
            return;
        }

        if (prevCacheKeyRef.current !== cacheKey) {
            engine.clearStaticCache(prevCacheKeyRef.current);
            prevCacheKeyRef.current = cacheKey;
        } else if (prevItemsRef.current !== items) {
            // Same key, new items: renderers rebuild only on a cache miss (or
            // bounds/scale change), so the stale cache must be dropped here.
            engine.clearStaticCache(cacheKey);
        }
        prevItemsRef.current = items;

        const handle = engine.drawStaticCircle(items, cacheKey, layer, { hitTest, clip });
        requestRender();

        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, items, cacheKey, layer, hitTest, requestRender, clipKey]);

    useEffect(() => {
        return () => {
            engine.clearStaticCache(cacheKey);
        };
    }, [engine, cacheKey]);

    return null;
});
