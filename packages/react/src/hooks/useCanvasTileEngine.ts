import { useRef } from "react";
import { useEngineHandle, type EngineHandleBase } from "@canvas-tile-engine/react-shared";

/**
 * Engine handle returned by useCanvasTileEngine hook.
 * Provides access to engine methods with proper typing.
 *
 * All methods return default/dummy values when engine is not ready,
 * allowing safe usage without null checks.
 */
export interface EngineHandle extends EngineHandleBase<HTMLDivElement, HTMLImageElement, unknown> {
    /** @internal - Used by CanvasTileEngine component */
    readonly _containerRef: React.RefObject<HTMLDivElement>;

    /** Resize the canvas */
    resize(width: number, height: number, durationMs?: number, onComplete?: () => void): void;
}

/**
 * React hook that creates an engine handle for use with CanvasTileEngine component.
 *
 * @returns Engine handle to pass to CanvasTileEngine component
 *
 * @example
 * ```tsx
 * function App() {
 *   const mainMap = useCanvasTileEngine();
 *   const miniMap = useCanvasTileEngine();
 *
 *   useEffect(() => {
 *     if (mainMap.isReady && miniMap.isReady) {
 *       // Both engines are ready, draw items
 *       mainMap.drawGridLines(50);
 *       mainMap.render();
 *     }
 *   }, [mainMap.isReady, miniMap.isReady]);
 *
 *   return (
 *     <>
 *       <CanvasTileEngine engine={mainMap} config={...} />
 *       <CanvasTileEngine engine={miniMap} config={...} />
 *     </>
 *   );
 * }
 * ```
 */
export function useCanvasTileEngine(): EngineHandle {
    const containerRef = useRef<HTMLDivElement>(null!);
    // The shared hook owns the handle lifecycle; the DOM-only members are
    // layered on top: the container ref the component mounts into, and
    // resize() (on React Native size comes from layout instead).
    return useEngineHandle<HTMLDivElement, HTMLImageElement, unknown, Pick<EngineHandle, "_containerRef" | "resize">>(
        (instanceRef) => ({
            _containerRef: containerRef,
            resize(width: number, height: number, durationMs?: number, onComplete?: () => void) {
                instanceRef.current?.resize(width, height, durationMs, onComplete);
            },
        }),
    );
}
