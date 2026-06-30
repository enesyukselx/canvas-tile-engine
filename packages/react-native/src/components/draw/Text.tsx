import { useEffect, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import type { Text as TextType } from "@canvas-tile-engine/core";

export interface TextProps {
    items: TextType | TextType[];
    layer?: number;
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
export const Text = memo(function Text({ items, layer = 2 }: TextProps) {
    const { engine, requestRender } = useEngineContext();

    useEffect(() => {
        const handle = engine.drawText(items, layer);
        requestRender();
        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
            }
        };
    }, [engine, items, layer, requestRender]);

    return null;
});
