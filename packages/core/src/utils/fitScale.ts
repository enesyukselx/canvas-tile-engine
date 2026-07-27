import type { Bounds } from "../types";
import { configError, validateFitBounds } from "./validateConfig";

/** Options for {@link fitScale}. The same pair `fitBounds` accepts. */
export interface FitScaleOptions {
    /**
     * Extra world-unit margin added on every side of the rectangle; scales
     * with the content. Ignored when {@link paddingPx} is set. Default 0.
     */
    padding?: number;
    /**
     * Screen-pixel margin kept free on every side of the viewport,
     * independent of the content's world size. Takes precedence over
     * {@link padding}. A value too large for the viewport is clamped so the
     * result stays valid.
     */
    paddingPx?: number;
}

/**
 * The scale (pixels per world unit) at which `bounds` exactly fits a
 * `size`-pixel viewport — the math `fitBounds` uses to pick its target
 * scale, exposed as a pure function for config-time use (the `gridToSize`
 * of free-form content).
 *
 * Use it to derive scale limits from content instead of hand-tuning
 * constants: the fit scale tracks the content automatically, and only
 * `maxScale` — a content-resolution quality cap that no bounds can imply —
 * stays a deliberate choice.
 * @param bounds Rectangle to fit. Every edge must be finite.
 * @param size Viewport size in logical pixels.
 * @param options `padding` in world units or `paddingPx` in screen pixels
 * (wins over `padding`).
 * @returns The fitting scale; unclamped — apply your own min/max policy.
 * @throws {ConfigValidationError} If an edge is not finite, min >= max on
 * an axis, a padding value is negative, or `size` is not positive finite.
 * @example
 * ```ts
 * const fit = fitScale(WORLD_BOUNDS, { width: 800, height: 600 }, { paddingPx: 24 });
 * const config = {
 *     size: { width: 800, height: 600 },
 *     scale: fit, // open showing everything
 *     minScale: fit * 0.8, // small overview slack — your policy
 *     maxScale: 64, // quality cap — intentionally hand-picked
 * };
 * ```
 */
export function fitScale(
    bounds: Bounds,
    size: { width: number; height: number },
    options: FitScaleOptions = {},
): number {
    const { padding = 0, paddingPx } = options;
    validateFitBounds(bounds, padding, paddingPx);
    for (const axis of ["width", "height"] as const) {
        const value = size[axis];
        if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
            throw configError(`fitScale size.${axis} must be a positive finite number, got ${value}`);
        }
    }

    if (paddingPx !== undefined) {
        // Pixel padding shrinks the viewport instead of growing the bounds,
        // so the margin is independent of the content's world size. Clamped
        // to keep at least 1px of fit area per axis when the padding would
        // consume the viewport.
        const fitWidth = bounds.maxX - bounds.minX;
        const fitHeight = bounds.maxY - bounds.minY;
        const availWidth = Math.max(1, size.width - paddingPx * 2);
        const availHeight = Math.max(1, size.height - paddingPx * 2);
        return Math.min(availWidth / fitWidth, availHeight / fitHeight);
    }

    const fitWidth = bounds.maxX - bounds.minX + padding * 2;
    const fitHeight = bounds.maxY - bounds.minY + padding * 2;
    return Math.min(size.width / fitWidth, size.height / fitHeight);
}
