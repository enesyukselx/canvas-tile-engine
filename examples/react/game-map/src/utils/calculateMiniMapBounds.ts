import { CanvasTileEngineConfig } from "@canvas-tile-engine/react";

// Calculate mini map bounds
// Mini map bounds should be calculated based on main map bounds. 
const calculateMiniMapBounds = (mainMapConfig: CanvasTileEngineConfig, miniMapConfig: CanvasTileEngineConfig) => {
    const mainBounds = mainMapConfig.bounds;

    if (!mainBounds) {
        return undefined;
    }

    const mainViewWidth = mainMapConfig.size.width / mainMapConfig.scale;
    const mainViewHeight = mainMapConfig.size.height / mainMapConfig.scale;

    const mainCenterMinX = mainBounds.minX + mainViewWidth / 2;
    const mainCenterMaxX = mainBounds.maxX - mainViewWidth / 2;
    const mainCenterMinY = mainBounds.minY + mainViewHeight / 2;
    const mainCenterMaxY = mainBounds.maxY - mainViewHeight / 2;

    const miniViewWidth = miniMapConfig.size.width / miniMapConfig.scale;
    const miniViewHeight = miniMapConfig.size.height / miniMapConfig.scale;

    return {
        minX: mainCenterMinX - miniViewWidth / 2,
        maxX: mainCenterMaxX + miniViewWidth / 2,
        minY: mainCenterMinY - miniViewHeight / 2,
        maxY: mainCenterMaxY + miniViewHeight / 2,
    };
};

export default calculateMiniMapBounds;
