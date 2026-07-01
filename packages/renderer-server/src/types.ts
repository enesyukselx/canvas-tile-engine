/**
 * Marker mount type for the headless server renderer. The engine never touches
 * the DOM in this mode, so the mount is an opaque empty object the renderer
 * ignores (it creates its own backing canvas in `init`).
 */
export type ServerMount = Record<never, never>;

/** Shared mount instance passed to the engine constructor in headless mode. */
export const SERVER_MOUNT: ServerMount = {};

/** Output image formats supported by {@link RendererServer} encoding helpers. */
export type ImageFormat = "png" | "jpeg" | "webp";
