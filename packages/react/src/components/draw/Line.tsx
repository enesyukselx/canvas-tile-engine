import { useEffect } from "react";
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
export function Line({ items, style, layer = 1 }: LineProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        engine.drawLine(items, style, layer);
        requestRender();
    }, [engine, items, style, layer, requestRender]);

    return null;
}
