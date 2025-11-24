import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="canvas-container">
    <canvas id="canvas"></canvas>
    <br />
    <canvas id="mini-canvas"></canvas>
  </div>
`;

import { CanvasGridMap } from "@canvas-grid-map/core";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const miniCanvas = document.getElementById("mini-canvas") as HTMLCanvasElement;

const items = [
    { x: 0, y: 0, color: "blue" },
    { x: 3, y: 1, color: "green" },
    { x: 5, y: 2, color: "yellow" },
    { x: 1, y: 4, color: "purple" },
    { x: 4, y: 3, color: "orange" },
    { x: 2, y: 2, color: "pink" },
];

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

const miniGridMap = new CanvasGridMap(
    miniCanvas,
    {
        scale: 10,
        minScale: 5,
        maxScale: 20,
        size: { width: 300, height: 300 },
        backgroundColor: "red",
        events: {
            drag: true,
            zoom: false,
            resize: true,
        },
        showCoordinates: false,
    },
    { x: 0, y: 0 }
);

miniGridMap.setupEvents();
items.forEach((item) => {
    miniGridMap.drawRect(item.x, item.y, { fillStyle: item.color });
});
miniGridMap.onCoordsChange = (coords) => {
    gridMap.updateCoords(coords);
};
miniGridMap.render();

gridMap.setupEvents();

items.forEach((item) => {
    gridMap.drawRect(item.x, item.y, { fillStyle: item.color });
});

gridMap.onCoordsChange = (coords) => {
    miniGridMap.updateCoords(coords);
};

gridMap.onResize = () => {
    //
    const gridMapConfig = gridMap.getConfig();

    miniGridMap.onDraw = (ctx, opts) => {
        ctx.fillStyle = "black";
        ctx.font = "12px Arial";
        ctx.fillText(`Scale: ${opts.scale.toFixed(2)}`, 10, 20);
        ctx.fillText(
            `Coords: (${gridMap.getCenterCoords().x.toFixed(2)}, ${gridMap.getCenterCoords().y.toFixed(2)})`,
            10,
            40
        );

        const ratio = miniGridMap.getConfig().scale / gridMapConfig.scale;

        const x = opts.width / 2 - (gridMapConfig.size.width * ratio) / 2;
        const y = opts.height / 2 - (gridMapConfig.size.height * ratio) / 2;

        ctx.strokeStyle = "blue";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, gridMapConfig.size.width * ratio, gridMapConfig.size.height * ratio);
    };

    miniGridMap.render();
};

gridMap.render();

// gridMap.drawRect(0, 0, { fillStyle: "blue" });
// gridMap.drawRect(3, 0, { fillStyle: "blue" });
// gridMap.drawCircle(0, 0, { fillStyle: "yellow" }, 1);
// gridMap.drawText("Hello World", 0, 0, { fillStyle: "black", font: "10px Arial" });
// gridMap.drawPath(
//     [
//         { x: 1, y: 2 },
//         { x: 2, y: 2 },
//         { x: 3, y: 4 },
//         { x: 4, y: 11 },
//     ],
//     { strokeStyle: "black", lineWidth: 2 }
// );
// gridMap.drawLine(0, 0, 3, 0, { strokeStyle: "green", lineWidth: 3 });
