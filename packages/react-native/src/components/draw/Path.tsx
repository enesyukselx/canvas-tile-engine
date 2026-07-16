import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Path as PathType, LineStyle } from "@canvas-tile-engine/core";

export interface PathProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: PathType | PathType[];
    style?: LineStyle;
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
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, items, style, layer, requestRender]);

    return null;
});
