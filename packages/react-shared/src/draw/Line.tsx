import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../EngineContext";
import type {
    Line as LineType,
    LineStyle,
    LineDecorationStyle,
    StyleOf,
    VisibleOf,
    InteractiveOf,
} from "@canvas-tile-engine/core";

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
    /**
     * Per-item visibility: return `false` to skip an item for the frame — it
     * is neither painted nor hit-testable. Read through a ref like `styleOf`:
     * identity changes only repaint, never re-register. Use it to toggle
     * categories or filter without a new `items` array.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visibleOf?: VisibleOf<LineType<any>>;
    /**
     * Per-item hit-test opt-out: return `false` to keep an item out of hit
     * queries while it stays painted (queries fall through to items below) —
     * the item-level `hitTest={false}`. Items hidden by `visibleOf` never
     * hit-test regardless. Read through a ref: identity changes never
     * re-register.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interactiveOf?: InteractiveOf<LineType<any>>;
    /**
     * Set to `false` to keep these items out of hit testing — the
     * `pointer-events: none` of the draw API, for decorative content.
     * Default `true`.
     */
    hitTest?: boolean;
}

/**
 * Draws lines on the canvas.
 */
export const Line = memo(function Line({
    items,
    style,
    layer = 1,
    styleOf,
    visibleOf,
    interactiveOf,
    hitTest,
}: LineProps) {
    const { engine, requestRender } = useEngineContext();

    // Read through refs so callback identity changes never re-register.
    const styleOfRef = useRef(styleOf);
    const visibleOfRef = useRef(visibleOf);
    const interactiveOfRef = useRef(interactiveOf);

    useEffect(() => {
        styleOfRef.current = styleOf;
        visibleOfRef.current = visibleOf;
        // A new closure may capture new state (e.g. a changed selection set),
        // so repaint — that is how decoration updates reach the canvas.
        requestRender();
    }, [styleOf, visibleOf, requestRender]);

    // Hit queries read the ref live at query time — no repaint needed.
    useEffect(() => {
        interactiveOfRef.current = interactiveOf;
    }, [interactiveOf]);

    useEffect(() => {
        const handle = engine.drawLine(items, style, layer, {
            styleOf: (item) => styleOfRef.current?.(item),
            visibleOf: (item) => visibleOfRef.current?.(item),
            interactiveOf: (item) => interactiveOfRef.current?.(item),
            hitTest,
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
    }, [engine, items, style, layer, hitTest, requestRender]);

    return null;
});
