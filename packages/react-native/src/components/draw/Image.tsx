import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { ImageItem } from "@canvas-tile-engine/core";
import type { SkImage } from "@shopify/react-native-skia";

export interface ImageProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: ImageItem<SkImage> | ImageItem<SkImage>[];
    layer?: number;
}

/**
 * Draws images on the canvas.
 */
export const Image = memo(function Image({ items, layer = 1 }: ImageProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        const handle = engine.drawImage(items, layer);
        requestRender();
        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, items, layer, requestRender]);

    return null;
});
