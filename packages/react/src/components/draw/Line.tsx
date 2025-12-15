import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Coords } from "@canvas-tile-engine/core";

export interface LineProps {
    items: { from: Coords; to: Coords } | { from: Coords; to: Coords }[];
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
                engine.removeLayerHandle(handle);
            }
        };
    }, [engine, items, style, layer, requestRender]);

    return null;
});
