import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { ImageItem } from "@canvas-tile-engine/core";
import type { SkImage } from "@shopify/react-native-skia";

export interface StaticImageProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: ImageItem<SkImage>[];
    cacheKey: string;
    layer?: number;
}

/**
 * Draws images via the engine's `drawStaticImage` API.
 *
 * On the Skia backend the items are recorded once into an SkPicture (keyed by
 * `cacheKey`) and replayed per frame under the camera transform, so prefer
 * this over `Image` for large item sets that don't change — per-frame cost is
 * independent of item count.
 */
export const StaticImage = memo(function StaticImage({ items, cacheKey, layer = 1 }: StaticImageProps) {
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
            // Same key, new items: the Skia backend re-records only on a cache
            // miss, so the stale picture must be dropped here.
            engine.clearStaticCache(cacheKey);
        }
        prevItemsRef.current = items;

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
