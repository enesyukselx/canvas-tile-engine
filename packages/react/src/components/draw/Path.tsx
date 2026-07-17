import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Path as PathType, PathItem, LineStyle } from "@canvas-tile-engine/core";

export interface PathProps {
    /**
     * Items to draw: `PathItem` objects (`{ points, closed, fillRule, style,
     * data }`), or the deprecated bare `Coords[]` / `Coords[][]` polyline
     * form. Compared by reference: a new array identity re-registers the
     * draw callback, so keep it stable with useMemo/useState instead of an
     * inline literal.
     */
    items: PathItem | PathItem[] | PathType | PathType[];
    /**
     * @deprecated Only applies to the legacy `Coords[]` items form.
     * `PathItem` carries its own per-item `style`.
     */
    style?: LineStyle;
    layer?: number;
}

/**
 * Draws free-form paths: open or closed polylines, filled shapes with a fill
 * rule, per-item stroke/dash/corner styling, and hit-testable geometry.
 */
export const Path = memo(function Path({ items, style, layer = 1 }: PathProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        const handle =
            style !== undefined
                ? engine.drawPath(items as PathType | PathType[], style, layer)
                : engine.drawPath(items as PathItem | PathItem[], layer);
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
