import { CanvasTileEngineConfig } from "@canvas-tile-engine/core";

export function initStyles(
    canvasWrapper: HTMLDivElement,
    canvas: HTMLCanvasElement,
    isResponsive: CanvasTileEngineConfig["responsive"],
    width?: number,
    height?: number
) {
    if (isResponsive) {
        Object.assign(canvasWrapper.style, {
            position: "relative",
            overflow: "hidden",
        });
    } else {
        Object.assign(canvasWrapper.style, {
            position: "relative",
            overflow: "hidden",
            width: width + "px",
            height: height + "px",
        });
    }

    Object.assign(canvas.style, {
        position: "absolute",
        top: "0",
        left: "0",
    });
}

/**
 * Apply lineWidth to canvas context with alpha fallback for values < 1.
 * For lineWidth < 1, uses globalAlpha to simulate thinner lines while keeping lineWidth at 1.
 * This ensures consistent rendering across browsers and DPR settings.
 *
 * @param ctx Canvas rendering context
 * @param lineWidth Desired line width (can be < 1 for semi-transparent thin lines)
 * @returns Cleanup function that resets globalAlpha to 1
 *
 */
export function applyLineWidth(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    lineWidth: number
): () => void {
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
