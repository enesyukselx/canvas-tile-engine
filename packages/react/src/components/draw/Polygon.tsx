import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Polygon as PolygonType } from "@canvas-tile-engine/core";

export interface PolygonProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: PolygonType | PolygonType[];
    layer?: number;
}

/**
 * Draws filled/stroked closed shapes on the canvas. Polygons carry per-item
 * style and `data`, and participate in hit testing.
 */
export const Polygon = memo(function Polygon({ items, layer = 1 }: PolygonProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        const handle = engine.drawPolygon(items, layer);
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
