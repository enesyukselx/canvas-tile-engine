import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Rect as RectType } from "@canvas-tile-engine/core";

export interface StaticRectProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: RectType[];
    cacheKey: string;
    layer?: number;
    /**
     * Set to `false` to keep these items out of hit testing — the
     * `pointer-events: none` of the draw API, for decorative content like
     * minimap tiles. Default `true`.
     */
    hitTest?: boolean;
}

/**
 * Draws static rectangles with caching for performance.
 * Ideal for large datasets that don't change frequently.
 */
export const StaticRect = memo(function StaticRect({ items, cacheKey, layer = 1, hitTest }: StaticRectProps) {
    const { engine, requestRender } = useEngineContext();
    const prevCacheKeyRef = useRef<string>(cacheKey);
    const prevItemsRef = useRef(items);

    useEffect(() => {
        if (items.length === 0) {
            return;
        }

        // Clear previous cache if cacheKey changed
        if (prevCacheKeyRef.current !== cacheKey) {
            engine.clearStaticCache(prevCacheKeyRef.current);
            prevCacheKeyRef.current = cacheKey;
        } else if (prevItemsRef.current !== items) {
            // Same key, new items: renderers rebuild only on a cache miss (or
            // bounds/scale change), so the stale cache must be dropped here.
            engine.clearStaticCache(cacheKey);
        }
        prevItemsRef.current = items;

        const handle = engine.drawStaticRect(items, cacheKey, layer, { hitTest });
        requestRender();

        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, items, cacheKey, layer, hitTest, requestRender]);

    // Cleanup cache on unmount
    useEffect(() => {
        return () => {
            engine.clearStaticCache(cacheKey);
        };
    }, [engine, cacheKey]);

    return null;
});
