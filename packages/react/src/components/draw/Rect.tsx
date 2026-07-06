import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Rect as RectType } from "@canvas-tile-engine/core";

export interface RectProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
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
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, items, layer, requestRender]);

    return null;
});
