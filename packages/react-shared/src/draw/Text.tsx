import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../EngineContext";
import type { Text as TextType, TextDecorationStyle, StyleOf, VisibleOf } from "@canvas-tile-engine/core";

export interface TextProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: TextType | TextType[];
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
    styleOf?: StyleOf<TextType<any>, TextDecorationStyle>;
    /**
     * Per-item visibility: return `false` to skip an item for the frame.
     * Read through a ref like `styleOf`: identity changes only repaint,
     * never re-register or rebuild the spatial index. Use it to toggle
     * categories or filter without a new `items` array.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visibleOf?: VisibleOf<TextType<any>>;
}

/**
 * Draws text on the canvas.
 * @example
 * ```tsx
 * <Text
 *     items={{
 *         x: 0,
 *         y: 0,
 *         text: "Hello",
 *         size: 1,
 *         style: { fillStyle: "black", fontFamily: "Arial" }
 *     }}
 * />
 * ```
 */
export const Text = memo(function Text({ items, layer = 2, styleOf, visibleOf }: TextProps) {
    const { engine, requestRender } = useEngineContext();

    // Read through refs so callback identity changes never re-register.
    const styleOfRef = useRef(styleOf);
    const visibleOfRef = useRef(visibleOf);

    useEffect(() => {
        styleOfRef.current = styleOf;
        visibleOfRef.current = visibleOf;
        // A new closure may capture new state (e.g. a changed selection set),
        // so repaint — that is how decoration updates reach the canvas.
        requestRender();
    }, [styleOf, visibleOf, requestRender]);

    useEffect(() => {
        const handle = engine.drawText(items, layer, {
            styleOf: (item) => styleOfRef.current?.(item),
            visibleOf: (item) => visibleOfRef.current?.(item),
        });
        requestRender();
        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, items, layer, requestRender]);

    return null;
});
