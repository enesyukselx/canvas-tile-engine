import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import { ImageItem } from "@canvas-tile-engine/core";

export interface StaticImageProps {
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
