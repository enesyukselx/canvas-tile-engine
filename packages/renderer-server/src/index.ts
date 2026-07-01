// Main renderer export
export { RendererServer } from "./RendererServer";
export type { RendererServerOptions } from "./RendererServer";

// High-level one-shot helper
export { renderToBuffer } from "./renderToBuffer";
export type { RenderToBufferOptions } from "./renderToBuffer";

// Font registration for headless environments
export { registerFont, GlobalFonts } from "./fonts";

// Headless mount marker + public types
export { SERVER_MOUNT } from "./types";
export type { ServerMount, ImageFormat } from "./types";

// Types only — internal classes are not exported
export type { DrawHandle } from "./modules/Layer";

// Re-export native canvas types for convenience
export type { Image, Canvas, SKRSContext2D } from "@napi-rs/canvas";
