import { CanvasTileEngineConfig } from "@canvas-tile-engine/react";

const miniMapViewportRectangleDraw = (
    mainMapConfig: CanvasTileEngineConfig,
    miniMapConfig: CanvasTileEngineConfig,
    ctx: CanvasRenderingContext2D
) => {
    const ratio = miniMapConfig.scale / mainMapConfig.scale;
    const rectWidth = mainMapConfig.size.width * ratio;
    const rectHeight = mainMapConfig.size.height * ratio;
    const rectX = miniMapConfig.size.width / 2 - rectWidth / 2;
    const rectY = miniMapConfig.size.height / 2 - rectHeight / 2;
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
};

export default miniMapViewportRectangleDraw;
