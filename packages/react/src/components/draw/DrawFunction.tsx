import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { CanvasTileEngineConfig, Coords, DrawTransform } from "@canvas-tile-engine/core";

export interface DrawFunctionProps {
    /** The draw function to execute; `transform.worldToScreen(x, y)` maps world coordinates to canvas pixels. */
    children: (
        ctx: unknown,
        coords: Coords,
        config: Required<CanvasTileEngineConfig>,
        transform: DrawTransform,
    ) => void;
    layer?: number;
}

/**
 * Custom draw function component.
 * Allows arbitrary canvas drawing within the engine's render cycle.
 * Multiple DrawFunction components can share the same layer (additive drawing).
 *
 * @example
 * ```tsx
 * <DrawFunction layer={3}>
 *   {(ctx, coords, config, transform) => {
 *     const p = transform.worldToScreen(5, 3); // center of cell (5, 3)
 *     ctx.fillStyle = "red";
 *     ctx.fillRect(p.x - 5, p.y - 5, 10, 10);
 *   }}
 * </DrawFunction>
 * ```
 */
export const DrawFunction = memo(function DrawFunction({ children, layer = 1 }: DrawFunctionProps) {
    const { engine, requestRender } = useEngineContext();
    const fnRef = useRef(children);

    // Keep function ref updated. When the draw function changes, repaint so
    // the canvas reflects it — otherwise state captured by the closure would
    // stay stale on screen until the next pan/zoom. Memoize `children` with
    // useCallback to skip repaints when nothing it draws has changed.
    useEffect(() => {
        if (fnRef.current !== children) {
            fnRef.current = children;
            requestRender();
        }
    });

    useEffect(() => {
        const handle = engine.addDrawFunction((ctx, coords, config, transform) => {
            fnRef.current(ctx, coords, config, transform);
        }, layer);
        requestRender();

        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, layer, requestRender]);

    return null;
});
