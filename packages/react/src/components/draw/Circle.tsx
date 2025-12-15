import { useEffect } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { DrawObject } from "@canvas-tile-engine/core";

export interface CircleProps {
    items: DrawObject | DrawObject[];
    layer?: number;
}

/**
 * Draws circles on the canvas.
 */
export function Circle({ items, layer = 1 }: CircleProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        engine.drawCircle(items, layer);
        requestRender();
    }, [engine, items, layer, requestRender]);

    return null;
}
