import { useEffect } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { DrawObject } from "@canvas-tile-engine/core";

export interface RectProps {
    items: DrawObject | DrawObject[];
    layer?: number;
}

/**
 * Draws rectangles on the canvas.
 */
export function Rect({ items, layer = 1 }: RectProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        engine.drawRect(items, layer);
        requestRender();
    }, [engine, items, layer, requestRender]);

    return null;
}
