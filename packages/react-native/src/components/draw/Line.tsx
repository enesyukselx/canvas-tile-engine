import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Line as LineType, LineStyle, LineDecorationStyle, StyleOf } from "@canvas-tile-engine/core";

export interface LineProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: LineType | LineType[];
    style?: LineStyle;
    layer?: number;
    /**
     * Paint-time decoration overlaid on `style` per item (`undefined` leaves
     * the item as-is) — also the way to give individual lines their own
     * color. Unlike `items`, this prop is read through a ref: its identity
     * may change on every render at no cost (an inline arrow is fine), and a
     * change only repaints, never re-registers. Line width is excluded: the
     * hit-test area derives from the registration-time stroke width.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    styleOf?: StyleOf<LineType<any>, LineDecorationStyle>;
}

/**
 * Draws lines on the canvas.
 */
export const Line = memo(function Line({ items, style, layer = 1, styleOf }: LineProps) {
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
        const handle = engine.drawLine(items, style, layer, { styleOf: (item) => styleOfRef.current?.(item) });
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
