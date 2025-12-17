import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { DrawObject } from "@canvas-tile-engine/core";

export interface CircleProps {
    items: DrawObject | DrawObject[];
    layer?: number;
}

/**
 * Draws circles on the canvas.
 */
export const Circle = memo(function Circle({ items, layer = 1 }: CircleProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        const handle = engine.drawCircle(items, layer);
        requestRender();
        return () => {
            if (handle) {
                engine.removeLayerHandle(handle);
            }
        };
    }, [engine, items, layer, requestRender]);

    return null;
});
