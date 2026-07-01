import { GlobalFonts } from "@napi-rs/canvas";

export { GlobalFonts };

/**
 * Register a font file so text drawn on the server can use it.
 *
 * System fonts are not guaranteed in headless environments (containers, CI,
 * serverless). Register the fonts your maps rely on before rendering, then
 * reference the family via `style.fontFamily` on text draw items.
 *
 * @param path Path to a `.ttf`/`.otf`/`.woff2` font file.
 * @param family Optional family-name alias to reference in `style.fontFamily`.
 *   When omitted, the font's own family name is used.
 * @returns `true` if the font was registered successfully.
 *
 * @example
 * ```ts
 * registerFont("./fonts/Inter.ttf", "Inter");
 * // then: engine.drawText({ x, y, text, style: { fontFamily: "Inter" } });
 * ```
 */
export function registerFont(path: string, family?: string): boolean {
    // registerFromPath returns a truthy FontKey on success, null on failure.
    return Boolean(family ? GlobalFonts.registerFromPath(path, family) : GlobalFonts.registerFromPath(path));
}
