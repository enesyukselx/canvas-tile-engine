import { createContext, useContext } from "react";
import type { EngineHandle } from "../hooks/useCanvasTileEngine";

export interface EngineContextValue {
    engine: EngineHandle;
    /** Request a re-render of the canvas */
    requestRender: () => void;
}

export const EngineContext = createContext<EngineContextValue | null>(null);

/**
 * Hook to access the engine context from child components.
 * Must be used within a CanvasTileEngine component.
 */
export function useEngineContext(): EngineContextValue {
    const context = useContext(EngineContext);

    if (!context) {
        throw new Error("useEngineContext must be used within a CanvasTileEngine component");
    }

    return context;
}
