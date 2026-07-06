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
}

/**
 * Draws static images with caching for performance.
 * Ideal for terrain tiles or static decorations.
 */
export const StaticImage = memo(function StaticImage({ items, cacheKey, layer = 1 }: StaticImageProps) {
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

        const handle = engine.drawStaticImage(items, cacheKey, layer);
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
