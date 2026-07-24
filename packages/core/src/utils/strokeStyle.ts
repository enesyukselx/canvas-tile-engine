/**
 * Shared stroke-style resolution used by every renderer, so world/px unit
 * semantics cannot drift between platforms.
 *
 * Convention (mirrors Text's `size`/`fontPx` pair): plain values are world
 * units and scale with zoom; `*Px` variants are screen pixels, independent of
 * zoom, and take precedence over their world counterpart.
 */

export interface StrokeWidthStyle {
    lineWidth?: number;
    lineWidthPx?: number;
}

export interface LineDashStyle {
    lineDash?: number[];
    lineDashPx?: number[];
}

export interface CornerRadiusStyle {
    cornerRadius?: number;
    cornerRadiusPx?: number;
}

/**
 * Effective stroke width in screen pixels.
 * `lineWidthPx` wins; `lineWidth` is world units (multiplied by `scale`);
 * neither given falls back to a 1px hairline.
 */
export function resolveLineWidthPx(style: StrokeWidthStyle | undefined, scale: number): number {
    if (style?.lineWidthPx !== undefined) return style.lineWidthPx;
    if (style?.lineWidth !== undefined) return style.lineWidth * scale;
    return 1;
}

/**
 * Effective dash pattern in screen pixels, or `undefined` for a solid line.
 * Follows Canvas2D `setLineDash` semantics: an odd-length pattern is repeated
 * (doubled), and a pattern that is empty, contains a negative or non-finite
 * value, or sums to zero yields a solid line.
 */
export function resolveLineDashPx(style: LineDashStyle | undefined, scale: number): number[] | undefined {
    const source = style?.lineDashPx !== undefined ? style.lineDashPx : style?.lineDash;
    if (source === undefined || source.length === 0) return undefined;
    if (source.some((v) => !Number.isFinite(v) || v < 0)) return undefined;

    const factor = style?.lineDashPx !== undefined ? 1 : scale;
    let pattern = source.map((v) => v * factor);
    if (pattern.length % 2 === 1) pattern = pattern.concat(pattern);
    if (pattern.reduce((sum, v) => sum + v, 0) <= 0) return undefined;
    return pattern;
}

/**
 * Border radius in screen pixels. `radius` is world units; single values and
 * per-corner arrays are both supported.
 */
export function resolveRadiusPx(radius: number | number[] | undefined, scale: number): number | number[] | undefined {
    if (radius === undefined) return undefined;
    return Array.isArray(radius) ? radius.map((v) => v * scale) : radius * scale;
}

/**
 * Effective Path corner-rounding radius in screen pixels; 0 disables
 * rounding. `cornerRadiusPx` wins; `cornerRadius` is world units.
 */
export function resolveCornerRadiusPx(style: CornerRadiusStyle | undefined, scale: number): number {
    if (style?.cornerRadiusPx !== undefined) return Math.max(0, style.cornerRadiusPx);
    if (style?.cornerRadius !== undefined) return Math.max(0, style.cornerRadius * scale);
    return 0;
}

/** The stroke fields {@link overlayLineStyle} understands. */
export interface OverlayableLineStyle extends StrokeWidthStyle, LineDashStyle {
    strokeStyle?: string;
}

/**
 * Overlay one line style on another, unit-pair by unit-pair. A plain
 * field-by-field spread breaks the world/px precedence rule across layers: a
 * base `lineWidthPx` would survive the merge and shadow an overlay that only
 * sets the world `lineWidth`. Instead, a layer that sets either field of a
 * pair (`lineWidth`/`lineWidthPx`, `lineDash`/`lineDashPx`) replaces the
 * whole pair — the `*Px`-wins rule applies within one layer, never across
 * layers. Used for `Line.style` over the call-level style, and for `styleOf`
 * decorations over both.
 */
export function overlayLineStyle<T extends OverlayableLineStyle>(
    base: T | undefined,
    // Partial also admits narrowed decoration types (e.g. LineDecorationStyle,
    // which omits the width pair entirely).
    over: Partial<T> | undefined,
): T {
    if (!over) return base ?? ({} as T);
    if (!base) return over as T;
    const result = { ...base, ...over };
    if (over.lineWidth !== undefined || over.lineWidthPx !== undefined) {
        result.lineWidth = over.lineWidth;
        result.lineWidthPx = over.lineWidthPx;
    }
    if (over.lineDash !== undefined || over.lineDashPx !== undefined) {
        result.lineDash = over.lineDash;
        result.lineDashPx = over.lineDashPx;
    }
    return result;
}
