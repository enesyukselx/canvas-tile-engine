import { useEffect, memo } from "react";
import { useEngineContext } from "../EngineContext";
import type { Bounds } from "@canvas-tile-engine/core";

export interface GridLinesProps {
    cellSize: number;
    lineWidth?: number;
    strokeStyle?: string;
    layer?: number;
    /**
     * Confine this registration to a world rectangle: nothing it draws paints
     * outside it, and nothing outside it hit-tests. Compared by value, so an
     * inline object literal does not re-register on every render.
     */
    clip?: Bounds;
}

/**
 * Draws grid lines on the canvas.
 * Multiple GridLines can share the same layer (additive drawing).
 */
export const GridLines = memo(function GridLines({
    cellSize,
    lineWidth = 1,
    strokeStyle = "black",
    layer = 0,
    clip,
}: GridLinesProps) {
    const { engine, requestRender } = useEngineContext();

    // Value-compared so an inline clip literal does not re-register the
    // draw call on every render.
    const clipKey = clip ? `${clip.minX},${clip.maxX},${clip.minY},${clip.maxY}` : "";

    useEffect(() => {
        const handle = engine.drawGridLines(cellSize, lineWidth, strokeStyle, layer, { clip });
        requestRender();
        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, cellSize, lineWidth, strokeStyle, layer, requestRender, clipKey]);

    return null;
});
