import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { ImageItem, VisibleOf, InteractiveOf } from "@canvas-tile-engine/core";
import type { SkImage } from "@shopify/react-native-skia";

export interface ImageProps {
    /**
     * Items to draw. Compared by reference: a new array identity re-registers
     * the draw callback (and rebuilds the spatial index for 500+ items), so
     * keep it stable with useMemo/useState instead of an inline literal.
     */
    items: ImageItem<SkImage> | ImageItem<SkImage>[];
    layer?: number;
    /**
     * Per-item visibility: return `false` to skip an item for the frame — it
     * is neither painted nor hit-testable. Read through a ref: identity
     * changes only repaint, never re-register or rebuild the spatial index.
     * Use it to toggle marker categories without a new `items` array.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    visibleOf?: VisibleOf<ImageItem<any, any>>;
    /**
     * Per-item hit-test opt-out: return `false` to keep an item out of hit
     * queries while it stays painted (queries fall through to items below) —
     * the item-level `hitTest={false}`. Items hidden by `visibleOf` never
     * hit-test regardless. Read through a ref: identity changes never
     * re-register.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    interactiveOf?: InteractiveOf<ImageItem<any, any>>;
    /**
     * Set to `false` to keep these items out of hit testing — the
     * `pointer-events: none` of the draw API, for decorative content like
     * terrain art. Default `true`.
     */
    hitTest?: boolean;
}

/**
 * Draws images on the canvas.
 */
export const Image = memo(function Image({ items, layer = 1, visibleOf, interactiveOf, hitTest }: ImageProps) {
    const { engine, requestRender } = useEngineContext();

    // Read through refs so callback identity changes never re-register.
    const visibleOfRef = useRef(visibleOf);
    const interactiveOfRef = useRef(interactiveOf);

    useEffect(() => {
        visibleOfRef.current = visibleOf;
        // A new closure may capture new state (e.g. a changed filter set),
        // so repaint — that is how visibility updates reach the canvas.
        requestRender();
    }, [visibleOf, requestRender]);

    // Hit queries read the ref live at query time — no repaint needed.
    useEffect(() => {
        interactiveOfRef.current = interactiveOf;
    }, [interactiveOf]);

    useEffect(() => {
        const handle = engine.drawImage(items, layer, {
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
