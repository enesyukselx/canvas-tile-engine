import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Rect as RectType } from "@canvas-tile-engine/core";

export interface RectProps {
    items: RectType | RectType[];
    layer?: number;
}

/**
 * Draws rectangles on the canvas.
 */
export const Rect = memo(function Rect({ items, layer = 1 }: RectProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        const handle = engine.drawRect(items, layer);
        requestRender();
        return () => {
            if (handle) {
                engine.removeLayerHandle(handle);
            }
        };
    }, [engine, items, layer, requestRender]);

    return null;
});
