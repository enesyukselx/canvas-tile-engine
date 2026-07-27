import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Rect as RectType, ShapeDecorationStyle, StyleOf } from "@canvas-tile-engine/core";

export interface RectProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: RectType | RectType[];
    layer?: number;
    /**
     * Paint-time decoration: the returned fields overlay the item's own
     * `style` each frame (`undefined` leaves the item as-is). Unlike `items`,
     * this prop is read through a ref — its identity may change on every
     * render at no cost (an inline arrow is fine), and a change only repaints,
     * never re-registers or rebuilds the spatial index. Use it for selection,
     * hover, and other state-driven styling.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    styleOf?: StyleOf<RectType<any>, ShapeDecorationStyle>;
    /**
     * Set to `false` to keep these items out of hit testing — the
     * `pointer-events: none` of the draw API, for decorative content like
     * floor tiles. Default `true`.
     */
    hitTest?: boolean;
}

/**
 * Draws rectangles on the canvas.
 */
export const Rect = memo(function Rect({ items, layer = 1, styleOf, hitTest }: RectProps) {
    const { engine, requestRender } = useEngineContext();

    // Read through a ref so styleOf identity changes never re-register.
    const styleOfRef = useRef(styleOf);

    useEffect(() => {
        styleOfRef.current = styleOf;
        // A new closure may capture new state (e.g. a changed selection set),
        // so repaint — that is how decoration updates reach the canvas.
        requestRender();
    }, [styleOf, requestRender]);

    useEffect(() => {
        const handle = engine.drawRect(items, layer, { styleOf: (item) => styleOfRef.current?.(item), hitTest });
        requestRender();
        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, items, layer, hitTest, requestRender]);

    return null;
});
