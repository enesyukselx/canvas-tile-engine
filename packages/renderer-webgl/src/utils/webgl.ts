/**
 * Create the transparent 2D overlay canvas that sits on top of the WebGL canvas.
 *
 * Text, the coordinate overlay, the debug HUD and user-supplied draw callbacks
 * are painted here because they rely on the Canvas2D API. The overlay never
 * receives pointer events so all interaction flows to the WebGL canvas beneath.
 */
export function createOverlayCanvas(wrapper: HTMLDivElement): HTMLCanvasElement {
    const overlay = document.createElement("canvas");
    Object.assign(overlay.style, {
        position: "absolute",
        top: "0",
        left: "0",
        pointerEvents: "none",
    });
    wrapper.appendChild(overlay);
    return overlay;
}

/**
 * Acquire a WebGL rendering context, preferring WebGL 2 and falling back to
 * WebGL 1. Throws when neither is available.
 */
export function getWebGLContext(canvas: HTMLCanvasElement): WebGLRenderingContext {
    const attributes: WebGLContextAttributes = {
        alpha: true,
        antialias: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
        // Path fills use two-pass stencil-then-cover winding (exact
        // nonzero/evenodd fill rules, matching Canvas2D).
        stencil: true,
    };

    const gl =
        (canvas.getContext("webgl2", attributes) as WebGLRenderingContext | null) ??
        canvas.getContext("webgl", attributes) ??
        (canvas.getContext("experimental-webgl", attributes) as WebGLRenderingContext | null);

    if (!gl) {
        throw new Error("Failed to acquire WebGL context: WebGL is not supported in this environment");
    }

    return gl;
}
