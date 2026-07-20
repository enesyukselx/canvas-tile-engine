import {
    CanvasTileEngine,
    gridToSize,
    type CanvasTileEngineConfig,
} from "@canvas-tile-engine/core";
import "./style.css";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const { center: center, ...config } = gridToSize({
    columns: 20,
    rows: 20,
    cellSize: 20,
});

const CONFIG: CanvasTileEngineConfig = {
    ...config,
    gridAligned: true,
    responsive: "preserve-viewport",
    backgroundColor: "#e6e6e6",
    eventHandlers: {
        hover: true,
    },
};

const canvas = document.querySelector<HTMLDivElement>("#canvas");
const engine = new CanvasTileEngine(
    canvas,
    CONFIG,
    new RendererCanvas(),
    center,
);

engine.drawGridLines(1, 0.5, "#000000");

engine.onHover = (coords) => {
    engine.drawRect(
        [
            {
                x: coords.snapped.x,
                y: coords.snapped.y,
                size: 1,
                style: { fillStyle: "#666666" },
            },
        ],
        1,
        {
            id: "hover",
        },
    );

    engine.render();
};

engine.onMouseLeave = () => {
    engine.drawRect([], 1, {
        id: "hover",
    });
    engine.render();
};

engine.render();
