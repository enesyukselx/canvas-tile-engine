import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="canvas-container">
    <canvas id="canvas"></canvas>
  </div>
`;

import { CanvasGridMap } from "@canvas-grid-map/core";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
canvas.width = 800;
canvas.height = 500;

const gridMap = new CanvasGridMap(
    canvas,
    {
        scale: 40,
        minScale: 5,
        maxScale: 100,
        size: { width: canvas.width, height: canvas.height },
        backgroundColor: "#f0f0f0",
        events: {
            drag: true,
            zoom: true,
            resize: true,
        },
        showCoordinates: true,
        minScaleShowCoordinates: 10,
    },
    { x: 10, y: 0 }
);

gridMap.setupEvents();
gridMap.render();
