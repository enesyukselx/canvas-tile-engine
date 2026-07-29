import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { PathItem, PathDecorationStyle, StyleOf, VisibleOf, InteractiveOf } from "@canvas-tile-engine/core";

export interface PathProps {
    /**
     * Items to draw: `PathItem` objects (`{ points, closed, fillRule, style,
     * data }`). Compared by reference: a new array identity re-registers the
     * draw callback, so keep it stable with useMemo/useState instead of an
     * inline literal.
     */
    items: PathItem | PathItem[];
    layer?: number;
    /**
     * Paint-time decoration: the returned fields overlay the item's own
     * `style` each frame (`undefined` leaves the item as-is). Unlike `items`,
     * this prop is read through a ref — its identity may change on every
     * render at no cost (an inline arrow is fine), and a change only repaints,
     * never re-registers. Stroke width and corner radius are excluded: they
     * feed hit-test geometry resolved at registration time.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    styleOf?: StyleOf<PathItem<any>, PathDecorationStyle>;
    /**
     * Per-item visibility: return `false` to skip an item for the frame — it
     * is neither painted nor hit-testable. Read through a ref like `styleOf`:
     * identity changes only repaint, never re-register. Use it to toggle
     * categories or filter without a new `items` array.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visibleOf?: VisibleOf<PathItem<any>>;
    /**
     * Per-item hit-test opt-out: return `false` to keep an item out of hit
     * queries while it stays painted (queries fall through to items below) —
     * the item-level `hitTest={false}`. Items hidden by `visibleOf` never
     * hit-test regardless. Read through a ref: identity changes never
     * re-register.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interactiveOf?: InteractiveOf<PathItem<any>>;
    /**
     * Set to `false` to keep these items out of hit testing — the
     * `pointer-events: none` of the draw API, for decorative content like
     * zone overlays. Default `true`.
     */
    hitTest?: boolean;
}

/**
 * Draws free-form paths: open or closed polylines, filled shapes with a fill
 * rule, per-item stroke/dash/corner styling, and hit-testable geometry.
 */
export const Path = memo(function Path({ items, layer = 1, styleOf, visibleOf, interactiveOf, hitTest }: PathProps) {
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
        const handle = engine.drawPath(items, layer, {
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
    }, [engine, items, layer, hitTest, requestRender]);

    return null;
});
