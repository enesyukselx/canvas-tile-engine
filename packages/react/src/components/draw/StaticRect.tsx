import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Rect as RectType } from "@canvas-tile-engine/core";

export interface StaticRectProps {
    items: RectType[];
    cacheKey: string;
    layer?: number;
}

/**
 * Draws static rectangles with caching for performance.
 * Ideal for large datasets that don't change frequently.
 */
export const StaticRect = memo(function StaticRect({ items, cacheKey, layer = 1 }: StaticRectProps) {
    const { engine, requestRender } = useEngineContext();
    const prevCacheKeyRef = useRef<string>(cacheKey);

    useEffect(() => {
        if (items.length === 0) {
            return;
        }

        // Clear previous cache if cacheKey changed
        if (prevCacheKeyRef.current !== cacheKey) {
            engine.clearStaticCache(prevCacheKeyRef.current);
            prevCacheKeyRef.current = cacheKey;
        }

        const handle = engine.drawStaticRect(items, cacheKey, layer);
        requestRender();

        return () => {
            if (handle) {
                engine.removeLayerHandle(handle);
            }
        };
    }, [engine, items, cacheKey, layer, requestRender]);

    // Cleanup cache on unmount
    useEffect(() => {
        return () => {
            engine.clearStaticCache(cacheKey);
        };
    }, [engine, cacheKey]);

    return null;
});
