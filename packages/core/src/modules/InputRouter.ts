import type { NormalizedKey, NormalizedPointer, ProcessedCoords } from "./GestureProcessor";
import { runAll } from "../utils/runAll";

/** A renderer-independent pointer event, before the camera's default gesture. */
export type EnginePointerEvent = ProcessedCoords & {
    type: "pointerdown" | "pointermove" | "pointerup" | "pointerleave";
    pointer: Readonly<NormalizedPointer>;
};

export type EngineInputEvent =
    | EnginePointerEvent
    | { type: "pointercancel"; reason: "cancel" | "multitouch"; pointer?: Readonly<NormalizedPointer> }
    | { type: "keydown"; key: Readonly<NormalizedKey> };

/**
 * One active tool runs before camera gestures. Returning true from pointerdown
 * captures that entire press, including moves outside the canvas and release.
 * Camera pan cannot resume halfway through a captured press, even if the tool
 * is removed. Observers and the legacy callback properties remain independent.
 */
export interface EngineTool {
    handleInput(event: EngineInputEvent): boolean | void;
    /** Called when replaced, detached, or the engine is destroyed. Must be idempotent. */
    cancel?(): void;
    /** Optional final cleanup when the engine is destroyed while this tool is active. */
    dispose?(): void;
}

/** Input port supplied to interactive renderers through RendererDependencies. */
export interface EngineInput {
    readonly hasTool: boolean;
    readonly captured: boolean;
    readonly suppressClick: boolean;
    dispatch(event: EngineInputEvent): boolean;
}

/** @internal Engine-owned routing; renderers receive only its input port. */
export class InputRouter implements EngineInput {
    private tool: EngineTool | null = null;
    private owner: EngineTool | null = null;
    private pressed = false;
    private claimed = false;
    private clickCancelled = false;
    private destroyed = false;
    private listeners = new Set<(event: EngineInputEvent, handled: boolean) => void>();
    private toolListeners = new Set<(tool: EngineTool | null) => void>();

    get hasTool(): boolean {
        return this.tool !== null;
    }
    get captured(): boolean {
        return this.claimed;
    }
    get suppressClick(): boolean {
        return this.clickCancelled;
    }
    getTool(): EngineTool | null {
        return this.tool;
    }

    setTool(tool: EngineTool | null): void {
        if (this.destroyed || this.tool === tool) {
            return;
        }
        const previous = this.tool;
        if (this.pressed && this.claimed) {
            this.clickCancelled = true;
        }
        this.tool = tool;
        this.owner = null;
        runAll([() => previous?.cancel?.(), ...[...this.toolListeners].map((listener) => () => listener(this.tool))]);
    }

    subscribe(listener: (event: EngineInputEvent, handled: boolean) => void): () => void {
        if (!this.destroyed) {
            this.listeners.add(listener);
        }
        return () => {
            this.listeners.delete(listener);
        };
    }

    subscribeToolChange(listener: (tool: EngineTool | null) => void): () => void {
        if (!this.destroyed) {
            this.toolListeners.add(listener);
        }
        return () => {
            this.toolListeners.delete(listener);
        };
    }

    dispatch(event: EngineInputEvent): boolean {
        if (this.destroyed) {
            return false;
        }
        let target = this.pressed && this.claimed ? this.owner : this.tool;
        let handled = this.pressed && this.claimed && event.type !== "keydown";
        if (event.type === "pointerdown") {
            this.owner?.cancel?.();
            this.pressed = true;
            this.claimed = false;
            this.clickCancelled = false;
            this.owner = null;
            target = this.tool;
            handled = false;
        } else if (event.type === "keydown") {
            target = this.tool;
        } else if (event.type === "pointerup" || event.type === "pointercancel") {
            if (event.type === "pointercancel") {
                this.clickCancelled = true;
            }
            this.pressed = false;
            this.claimed = false;
            this.owner = null;
        }
        const toolHandled = target?.handleInput(event) === true;
        // An owner that no longer recognizes its release was cancelled in the
        // meantime (for example by a toolbar's cancel() or Escape).
        if (event.type === "pointerup" && handled && !toolHandled) {
            this.clickCancelled = true;
        }
        handled = toolHandled || handled;
        if (event.type === "pointerdown" && this.pressed && handled) {
            this.claimed = true;
            this.owner = target === this.tool ? target : null;
        }
        runAll([...this.listeners].map((listener) => () => listener(event, handled)));
        return handled;
    }

    destroy(): void {
        if (this.destroyed) {
            return;
        }
        const active = this.tool;
        this.destroyed = true;
        this.tool = this.owner = null;
        this.pressed = this.claimed = false;
        this.clickCancelled = true;
        try {
            runAll([
                () => active?.cancel?.(),
                () => active?.dispose?.(),
                ...[...this.toolListeners].map((listener) => () => listener(null)),
            ]);
        } finally {
            this.listeners.clear();
            this.toolListeners.clear();
        }
    }
}
