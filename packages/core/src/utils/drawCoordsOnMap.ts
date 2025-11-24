import { CanvasGridMapConfig, Coords } from "../types";

const drawCoordsOnMap = ({
    ctx,
    coords,
    mapConfig,
}: {
    ctx: CanvasRenderingContext2D;
    coords: Coords;
    mapConfig: CanvasGridMapConfig;
}) => {
    const scale = mapConfig.scale || 1;
    const coordsMinScale = mapConfig.minScaleShowCoordinates ?? 0;

    // if the scale is less than the minimum scale for showing coordinates
    if (scale < coordsMinScale) {
        return;
    }

    // Save the current canvas state
    ctx.save();

    // Set fill style to black with 0.1 opacity
    ctx.fillStyle = "rgba(0, 0, 0, 0.1)";

    // Draw left border - 20px wide, full height
    ctx.fillRect(0, 0, 20, mapConfig.size.height);

    // Draw bottom border - full width, 20px high
    ctx.fillRect(20, mapConfig.size.height - 20, mapConfig.size.width, 20);

    // Set text properties for coordinates
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)";

    // Adjust font size based on scale (min 8px, max 12px)
    const fontSize = Math.min(12, Math.max(8, scale * 0.25));
    ctx.font = `${fontSize}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const cordGap = scale;
    const visibleAreaWidthInCords = mapConfig.size.width / cordGap;
    const visibleAreaHeightInCords = mapConfig.size.height / cordGap;

    // Draw Y coordinates (left side)
    for (let i = 0 - (coords.y % 1); i <= visibleAreaHeightInCords + 1; i++) {
        ctx.fillText(Math.round(coords.y + i).toString(), 10, cordGap * i + cordGap / 2);
    }

    // Draw X coordinates (bottom)
    for (let i = 0 - (coords.x % 1); i <= visibleAreaWidthInCords + 1; i++) {
        ctx.fillText(Math.round(coords.x + i).toString(), cordGap * i + cordGap / 2, mapConfig.size.height - 10);
    }

    // Restore the canvas state
    ctx.restore();
};

export default drawCoordsOnMap;
