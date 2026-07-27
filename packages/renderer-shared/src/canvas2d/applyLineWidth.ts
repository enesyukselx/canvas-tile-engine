/**
 * Apply lineWidth to a canvas context with an alpha fallback for values < 1.
 * For lineWidth < 1, uses globalAlpha to simulate thinner lines while keeping
 * lineWidth at 1. This ensures consistent rendering across browsers, DPR
 * settings, and the server renderer.
 *
 * @param ctx Canvas rendering context (any Canvas2D-shaped context).
 * @param lineWidth Desired line width (can be < 1 for semi-transparent thin lines).
 * @returns Cleanup function that resets globalAlpha to 1.
 */
export function applyLineWidth(ctx: { lineWidth: number; globalAlpha: number }, lineWidth: number): () => void {
    if (lineWidth >= 1) {
        ctx.lineWidth = lineWidth;
        return () => {}; // No cleanup needed
    }

    // For lineWidth < 1, use alpha to simulate thinner lines
    const alpha = Math.max(0, Math.min(lineWidth, 1));
    ctx.lineWidth = 1;
    ctx.globalAlpha = alpha;

    return () => {
        ctx.globalAlpha = 1;
    };
}
