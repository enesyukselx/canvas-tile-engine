/**
 * Look up an optional platform constructor without referencing a DOM-only type.
 * This is evaluated against the consumer's libs: browser projects keep their
 * exact DOM defaults, while Node/native projects need no DOM declarations.
 * It does not declare globals or require those constructors at runtime.
 */
type GlobalInstance<Name extends string, Fallback = unknown> = typeof globalThis extends {
    [Key in Name]: { prototype: infer Instance };
}
    ? Instance
    : Fallback;

export type DefaultMount = GlobalInstance<"HTMLDivElement">;
export type DefaultImage = GlobalInstance<"HTMLImageElement">;
export type BrowserElement = GlobalInstance<"HTMLElement", never>;
export type BrowserCanvas = GlobalInstance<"HTMLCanvasElement", never>;
