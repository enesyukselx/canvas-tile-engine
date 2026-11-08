import { useEffect, memo } from "react";
import { useEngineContext } from "../EngineContext";
import type { Bounds } from "@canvas-tile-engine/core";

export interface GridLinesProps {
    cellSize: number;
    /**
     * Line width in screen pixels (default 1). Unlike the world-unit
     * `lineWidth` of rects, lines and paths, it does not scale with zoom.
     * Widths below 1 draw a fainter hairline rather than a thinner one.
     */
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
