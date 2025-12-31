import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Circle as CircleType } from "@canvas-tile-engine/core";

export interface StaticCircleProps {
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
                engine.removeLayerHandle(handle);
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
