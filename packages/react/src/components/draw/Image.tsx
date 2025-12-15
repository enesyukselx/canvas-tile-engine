import { useEffect } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { DrawObject } from "@canvas-tile-engine/core";

export type ImageItem = Omit<DrawObject, "style"> & { img: HTMLImageElement };

export interface ImageProps {
    items: ImageItem | ImageItem[];
    layer?: number;
}

/**
 * Draws images on the canvas.
 */
export function Image({ items, layer = 1 }: ImageProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        engine.drawImage(items, layer);
        requestRender();
    }, [engine, items, layer, requestRender]);

    return null;
}
