import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { ImageItem } from "@canvas-tile-engine/core";
import type { SkImage } from "@shopify/react-native-skia";

export interface StaticImageProps {
    items: ImageItem<SkImage>[];
    cacheKey: string;
    layer?: number;
}

/**
 * Draws images via the engine's `drawStaticImage` API.
 *
 * Note: on the Skia backend, static draws currently reuse the dynamic path
 * (no offscreen cache), so `cacheKey` is kept for API compatibility with the
 * web renderer rather than for performance.
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
