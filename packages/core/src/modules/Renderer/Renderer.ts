/**
 * Renderer contract for grid engine outputs.
 * @internal
 */
export interface IRenderer {
    /** Initialize renderer resources (context, shaders, buffers). */
    init(): void;

    /** Draw one frame. */
    render(): void;

    /**
     * Resize the underlying rendering surface.
     * @param width New width in pixels.
     * @param height New height in pixels.
     */
    resize(width: number, height: number): void;

    /** Free resources and shutdown renderer. */
    destroy(): void;
}
