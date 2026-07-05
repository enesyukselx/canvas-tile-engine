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
}

/**
 * Draws rectangles via the engine's `drawStaticRect` API.
 *
 * Note: on the Skia backend, static draws currently reuse the dynamic path
 * (no offscreen cache), so `cacheKey` is kept for API compatibility with the
 * web renderer rather than for performance.
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
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
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
