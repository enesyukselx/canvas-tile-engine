import type { CanvasTileEngine as CanvasTileEngineCore } from "@canvas-tile-engine/core";
import type { SkiaMount, SkCanvas, SkImage } from "@canvas-tile-engine/renderer-skia";
import { useEngineHandle, type EngineHandleBase } from "@canvas-tile-engine/react-shared";

/** The concrete engine instance type for the Skia / React Native backend. */
export type SkiaEngine = CanvasTileEngineCore<SkiaMount, SkImage>;

/**
 * Engine handle returned by {@link useCanvasTileEngine}. Mirrors the web hook but
 * is typed for the Skia backend (`SkImage` instead of `HTMLImageElement`, and
 * custom draw functions receive an `SkCanvas`). All methods are safe to call
 * before the engine mounts (they no-op / return defaults).
 *
 * Unlike the web handle there is no `resize()` — the canvas is sized by the
 * native layout system — and no `_containerRef`.
 */
export type EngineHandle = EngineHandleBase<SkiaMount, SkImage, SkCanvas>;

/**
 * React hook that creates an engine handle for the `<CanvasTileEngine>` React
 * Native component.
 *
 * @example
 * ```tsx
 * const engine = useCanvasTileEngine();
 * return <CanvasTileEngine engine={engine} config={config} renderer={new RendererSkia()} />;
 * ```
 */
export function useCanvasTileEngine(): EngineHandle {
    return useEngineHandle<SkiaMount, SkImage, SkCanvas>();
}
