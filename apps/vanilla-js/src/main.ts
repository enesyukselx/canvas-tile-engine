import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="canvas-container">
    <canvas id="canvas"></canvas>
  </div>
`;

import { CanvasGridMap } from "@canvas-grid-map/core";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;

const gridMap = new CanvasGridMap(
    canvas,
    {
        scale: 50,
        minScale: 5,
        maxScale: 100,
        size: { width: 500, height: 500 },
        backgroundColor: "red",
        events: {
            drag: true,
            zoom: true,
            resize: true,
        },
        showCoordinates: true,
        minScaleShowCoordinates: 10,
    },
    { x: 0, y: 0 }
);

gridMap.setupEvents();
gridMap.drawRect(0, 0, { fillStyle: "blue" });
gridMap.drawRect(3, 0, { fillStyle: "blue" });
gridMap.drawRect(1, 2, { fillStyle: "blue" });
gridMap.drawRect(1, 5, { fillStyle: "blue" });
gridMap.drawLine(0, 0, 5, 5, { strokeStyle: "green", lineWidth: 3 });
gridMap.drawCircle(0, 0, 0.5, { fillStyle: "yellow" });
gridMap.drawText("Hello World", 0, 0, { fillStyle: "black", font: "10px Arial" });
gridMap.drawPath(
    [
        { x: 1, y: 2 },
        { x: 2, y: 2 },
        { x: 3, y: 4 },
        { x: 4, y: 11 },
    ],
    { strokeStyle: "black", lineWidth: 2 }
);
gridMap.render();
