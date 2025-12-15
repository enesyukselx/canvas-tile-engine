import { useEffect } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Coords } from "@canvas-tile-engine/core";

export interface PathProps {
    items: Coords[] | Coords[][];
    style?: { strokeStyle?: string; lineWidth?: number };
    layer?: number;
}

/**
 * Draws paths/polylines on the canvas.
 */
export function Path({ items, style, layer = 1 }: PathProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        engine.drawPath(items, style, layer);
        requestRender();
    }, [engine, items, style, layer, requestRender]);

    return null;
}
