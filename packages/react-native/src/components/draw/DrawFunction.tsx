import { useEffect, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { CanvasTileEngineConfig, Coords } from "@canvas-tile-engine/core";
import type { SkCanvas } from "@canvas-tile-engine/renderer-skia";

export interface DrawFunctionProps {
    /** The draw function to execute, receiving the frame's Skia `SkCanvas`. */
    children: (canvas: SkCanvas, coords: Coords, config: Required<CanvasTileEngineConfig>) => void;
    layer?: number;
}

/**
 * Custom draw function component.
 * Allows arbitrary Skia drawing within the engine's render cycle.
 * Multiple DrawFunction components can share the same layer (additive drawing).
 *
 * @example
 * ```tsx
 * import { Skia } from "@canvas-tile-engine/react-native";
 *
 * <DrawFunction layer={3}>
 *   {(canvas, coords, config) => {
 *     const paint = Skia.Paint();
 *     paint.setColor(Skia.Color("red"));
 *     canvas.drawRect(Skia.XYWHRect(config.size.width / 2 - 5, config.size.height / 2 - 5, 10, 10), paint);
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
                engine.removeDrawHandle(handle);
            }
        };
    }, [engine, layer, requestRender]);

    return null;
});
