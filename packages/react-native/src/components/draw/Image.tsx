import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { ImageItem } from "@canvas-tile-engine/core";
import type { SkImage } from "@shopify/react-native-skia";

export interface ImageProps {
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
            }
        };
    }, [engine, items, layer, requestRender]);

    return null;
});
