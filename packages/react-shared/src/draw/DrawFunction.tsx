import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../EngineContext";
import type { Bounds, CanvasTileEngineConfig, Coords, DrawTransform } from "@canvas-tile-engine/core";

export interface DrawFunctionProps<TCtx = unknown> {
    /** The draw function to execute, receiving the platform's draw context; `transform.worldToScreen(x, y)` maps world coordinates to canvas pixels. */
    children: (ctx: TCtx, coords: Coords, config: Required<CanvasTileEngineConfig>, transform: DrawTransform) => void;
    layer?: number;
    /**
     * Confine this registration to a world rectangle: nothing it draws paints
     * outside it, and nothing outside it hit-tests. Compared by value, so an
     * inline object literal does not re-register on every render.
     */
    clip?: Bounds;
}

/**
 * Custom draw function component.
 * Allows arbitrary drawing with the platform's draw context within the
 * engine's render cycle.
 * Multiple DrawFunction components can share the same layer (additive drawing).
 *
 * @example
 * ```tsx
 * <DrawFunction layer={3}>
 *   {(ctx, coords, config, transform) => {
 *     const p = transform.worldToScreen(5, 3); // center of cell (5, 3)
 *     // ... draw at p with the platform context ...
 *   }}
 * </DrawFunction>
 * ```
 */
export const DrawFunction = memo(function DrawFunction({ children, layer = 1, clip }: DrawFunctionProps) {
    const { engine, requestRender } = useEngineContext();

    // Value-compared so an inline clip literal does not re-register the
    // draw call on every render.
    const clipKey = clip ? `${clip.minX},${clip.maxX},${clip.minY},${clip.maxY}` : "";
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
        const handle = engine.addDrawFunction(
            (ctx, coords, config, transform) => {
                fnRef.current(ctx, coords, config, transform);
            },
            layer,
            { clip },
        );
        requestRender();

        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, layer, requestRender, clipKey]);

    return null;
});
