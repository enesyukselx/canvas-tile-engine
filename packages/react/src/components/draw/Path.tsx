import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Path as PathType } from "@canvas-tile-engine/core";

export interface PathProps {
    items: PathType | PathType[];
    style?: { strokeStyle?: string; lineWidth?: number };
    layer?: number;
}

/**
 * Draws paths/polylines on the canvas.
 */
export const Path = memo(function Path({ items, style, layer = 1 }: PathProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        const handle = engine.drawPath(items, style, layer);
        requestRender();
        return () => {
            if (handle) {
                engine.removeLayerHandle(handle);
            }
        };
    }, [engine, items, style, layer, requestRender]);

    return null;
});
