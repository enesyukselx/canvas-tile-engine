import {
    EngineContext,
    useEngineContext as useEngineContextBase,
    type EngineContextValue as EngineContextValueBase,
} from "@canvas-tile-engine/react-shared";
import type { EngineHandle } from "../hooks/useCanvasTileEngine";

export { EngineContext };

/** Engine context value, typed to the Skia engine handle. */
export type EngineContextValue = EngineContextValueBase<EngineHandle>;

/**
 * Hook to access the engine context from child components.
 * Must be used within a CanvasTileEngine component.
 */
export function useEngineContext(): EngineContextValue {
    return useEngineContextBase<EngineHandle>();
}
