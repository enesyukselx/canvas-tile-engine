import { useEffect } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Coords } from "@canvas-tile-engine/core";

export interface TextProps {
    items: { coords: Coords; text: string } | { coords: Coords; text: string }[];
    style?: {
        fillStyle?: string;
        font?: string;
        textAlign?: CanvasTextAlign;
        textBaseline?: CanvasTextBaseline;
    };
    layer?: number;
}

/**
 * Draws text on the canvas.
 */
export function Text({ items, style, layer = 2 }: TextProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        engine.drawText(items, style, layer);
        requestRender();
    }, [engine, items, style, layer, requestRender]);

    return null;
}
