import { useEffect, useRef } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { ImageItem } from "./Image";

export interface StaticImageProps {
    items: ImageItem[];
    cacheKey: string;
    layer?: number;
}

/**
 * Draws static images with caching for performance.
 * Ideal for terrain tiles or static decorations.
 */
export function StaticImage({ items, cacheKey, layer = 1 }: StaticImageProps) {
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

        engine.drawStaticImage(items, cacheKey, layer);
        requestRender();
    }, [engine, items, cacheKey, layer, requestRender]);

    useEffect(() => {
        return () => {
            engine.clearStaticCache(cacheKey);
        };
    }, [engine, cacheKey]);

    return null;
}
