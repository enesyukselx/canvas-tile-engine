import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { ImageItem } from "@canvas-tile-engine/core";

export interface StaticImageProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: ImageItem[];
    cacheKey: string;
    layer?: number;
    /**
     * Set to `false` to keep these items out of hit testing — the
     * `pointer-events: none` of the draw API, for decorative content like
     * terrain tiles. Default `true`.
     */
    hitTest?: boolean;
}

/**
 * Draws static images with caching for performance.
 * Ideal for terrain tiles or static decorations.
 */
export const StaticImage = memo(function StaticImage({ items, cacheKey, layer = 1, hitTest }: StaticImageProps) {
    const { engine, requestRender } = useEngineContext();
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

        const handle = engine.drawStaticImage(items, cacheKey, layer, { hitTest });
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

    useEffect(() => {
        return () => {
            engine.clearStaticCache(cacheKey);
        };
    }, [engine, cacheKey]);

    return null;
});
