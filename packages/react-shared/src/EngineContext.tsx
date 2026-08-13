import { createContext, useContext } from "react";
import type { EngineHandleBase } from "./useEngineHandle";

/**
 * The widest handle type the shared draw components can work against. The
 * platform packages narrow it back to their concrete handle type via
 * `useEngineContext<THandle>()`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEngineHandle = EngineHandleBase<any, any, any>;

export interface EngineContextValue<THandle extends AnyEngineHandle = AnyEngineHandle> {
    engine: THandle;
    /** Request a re-render of the canvas */
    requestRender: () => void;
}

export const EngineContext = createContext<EngineContextValue | null>(null);

/**
 * Hook to access the engine context from child components.
 * Must be used within a CanvasTileEngine component.
 */
export function useEngineContext<THandle extends AnyEngineHandle = AnyEngineHandle>(): EngineContextValue<THandle> {
    const context = useContext(EngineContext);

    if (!context) {
        throw new Error("useEngineContext must be used within a CanvasTileEngine component");
    }

    return context as EngineContextValue<THandle>;
}
