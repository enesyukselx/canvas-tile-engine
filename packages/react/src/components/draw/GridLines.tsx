import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";

export interface GridLinesProps {
    cellSize: number;
    lineWidth?: number;
    strokeStyle?: string;
    layer?: number;
}

/**
 * Draws grid lines on the canvas.
 * Multiple GridLines can share the same layer (additive drawing).
 */
export const GridLines = memo(function GridLines({ cellSize, lineWidth = 1, strokeStyle = "black", layer = 0 }: GridLinesProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        engine.drawGridLines(cellSize, lineWidth, strokeStyle, layer);
        requestRender();
    }, [engine, cellSize, lineWidth, strokeStyle, layer, requestRender]);

    return null;
});
