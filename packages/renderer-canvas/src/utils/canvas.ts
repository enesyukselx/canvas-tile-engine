import { CanvasTileEngineConfig } from "@canvas-tile-engine/core";

export function initStyles(
    canvasWrapper: HTMLDivElement,
    canvas: HTMLCanvasElement,
    isResponsive: CanvasTileEngineConfig["responsive"],
    width?: number,
    height?: number,
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
