import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { CanvasTileEngineConfig, Coords } from "@canvas-tile-engine/core";

export interface DrawFunctionProps {
    /** The draw function to execute */
    children: (ctx: CanvasRenderingContext2D, coords: Coords, config: Required<CanvasTileEngineConfig>) => void;
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
 *   {(ctx, coords, config) => {
 *     ctx.fillStyle = "red";
 *     ctx.fillRect(config.size.width / 2 - 5, config.size.height / 2 - 5, 10, 10);
 *   }}
 * </DrawFunction>
 * ```
 */
export const DrawFunction = memo(function DrawFunction({ children, layer = 1 }: DrawFunctionProps) {
    const { engine, requestRender } = useEngineContext();
    const fnRef = useRef(children);

    // Keep function ref updated
    useEffect(() => {
        fnRef.current = children;
    });

    useEffect(() => {
        const handle = engine.addDrawFunction((ctx, coords, config) => {
            fnRef.current(ctx, coords, config);
        }, layer);
        requestRender();

        return () => {
            if (handle) {
                engine.removeLayerHandle(handle);
            }
        };
    }, [engine, layer, requestRender]);

    return null;
});
