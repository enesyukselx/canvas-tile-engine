import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Circle as CircleType } from "@canvas-tile-engine/core";

export interface StaticCircleProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: CircleType[];
    cacheKey: string;
    layer?: number;
}

/**
 * Draws static circles with caching for performance.
 */
export const StaticCircle = memo(function StaticCircle({ items, cacheKey, layer = 1 }: StaticCircleProps) {
    const { engine, requestRender } = useEngineContext();
    const prevCacheKeyRef = useRef<string>(cacheKey);

    useEffect(() => {
        if (items.length === 0) {
            return;
        }

        if (prevCacheKeyRef.current !== cacheKey) {
            engine.clearStaticCache(prevCacheKeyRef.current);
            prevCacheKeyRef.current = cacheKey;
        }

        const handle = engine.drawStaticCircle(items, cacheKey, layer);
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

    useEffect(() => {
        return () => {
            engine.clearStaticCache(cacheKey);
        };
    }, [engine, cacheKey]);

    return null;
});
