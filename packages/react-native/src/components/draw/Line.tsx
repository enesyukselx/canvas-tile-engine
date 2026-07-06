import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Line as LineType } from "@canvas-tile-engine/core";

export interface LineProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: LineType | LineType[];
    style?: { strokeStyle?: string; lineWidth?: number };
    layer?: number;
}

/**
 * Draws lines on the canvas.
 */
export const Line = memo(function Line({ items, style, layer = 1 }: LineProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        const handle = engine.drawLine(items, style, layer);
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
