import type { SkCanvas } from "@shopify/react-native-skia";

export interface SkiaSize {
    width: number;
    height: number;
}

/**
 * The mount target for {@link RendererSkia}, implemented by the host (e.g. the
 * `@canvas-tile-engine/react-native` binding).
 *
 * Unlike DOM renderers there is no element to query: the host owns the Skia
 * `<Canvas>` and React's render loop. The renderer asks the host to repaint by
 * handing it a frame painter via {@link present}; the host records it into an
 * `SkPicture` and triggers a re-render.
 */
export interface SkiaMount {
    /** Current logical (dp) size of the canvas. */
    getSize(): SkiaSize;

    /** Device pixel ratio. Skia draws in logical units, so this is informational. */
    getDpr(): number;

    /**
     * Hand the host a frame painter. The host is expected to record it into a
     * picture and repaint (e.g. `setPicture(createPicture(paint))`).
     */
    present(paint: (canvas: SkCanvas) => void): void;
}
