import "./style.css";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
  <div class="canvas-container">
    <canvas id="canvas"></canvas>
    <br />
    <canvas id="mini-canvas"></canvas>
  </div>
`;

import { CanvasGridMap } from "@canvas-grid-map/core";

// ───────────────────────────────────────────────
// TEST DATA
// ───────────────────────────────────────────────
const items = [
    { x: 0, y: 0, color: "blue" },
    { x: 0, y: 1, color: "green" },
    { x: 3, y: 1, color: "green" },
    { x: 5, y: 2, color: "yellow" },
    { x: 1, y: 4, color: "purple" },
    { x: 4, y: 3, color: "orange" },
    { x: 2, y: 2, color: "pink" },
];

// ───────────────────────────────────────────────
// MAIN CANVAS
// ───────────────────────────────────────────────
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
            click: true,
        },
        showCoordinates: true,
        minScaleShowCoordinates: 10,
    },
    { x: 0, y: 0 }
);

// ───────────────────────────────────────────────
// MINI MAP
// ───────────────────────────────────────────────
const miniCanvas = document.getElementById("mini-canvas") as HTMLCanvasElement;

const miniGridMap = new CanvasGridMap(
    miniCanvas,
    {
        scale: 10,
        minScale: 5,
        maxScale: 20,
        size: { width: 300, height: 300 },
        backgroundColor: "#ddd",
        events: {
            drag: true,
            zoom: false, // ❗ mini map zoom yok
            resize: true,
        },
        showCoordinates: false,
    },
    { x: 0, y: 0 }
);

// ───────────────────────────────────────────────
// DRAW OBJECTS ON BOTH MAPS
// ───────────────────────────────────────────────
items.forEach((item) => {
    gridMap.drawRect(item.x, item.y, { fillStyle: item.color }, 1);
    miniGridMap.drawRect(item.x, item.y, { fillStyle: item.color }, 1);
});

let isSyncing = false;

// ───────────────────────────────────────────────
// MINI MAP → MAIN MAP SYNC
// ───────────────────────────────────────────────

miniGridMap.onCoordsChange = (coords) => {
    if (isSyncing) return;
    isSyncing = true;

    gridMap.updateCoords(coords);
    gridMap.render();

    isSyncing = false;
};

// ───────────────────────────────────────────────
// MAIN MAP → MINI MAP VIEWPORT UPDATE
// ───────────────────────────────────────────────
gridMap.onCoordsChange = (coords) => {
    if (isSyncing) return;
    isSyncing = true;

    miniGridMap.updateCoords(coords);
    miniGridMap.render();

    isSyncing = false;
};

gridMap.onClick = (coords) => {
    console.log("Main Map Clicked at:", coords);
};

// ───────────────────────────────────────────────
// MINI MAP VIEWPORT RECTANGLE DRAWING
// ───────────────────────────────────────────────
miniGridMap.onDraw = (ctx, opts) => {
    const mainCfg = gridMap.getConfig();
    const miniCfg = miniGridMap.getConfig();

    // SCALE RATIO
    const ratio = miniCfg.scale / mainCfg.scale;

    // MAIN VIEWPORT → MINI MAP SIZE
    const rectWidth = mainCfg.size.width * ratio;
    const rectHeight = mainCfg.size.height * ratio;

    // ALWAYS CENTERED
    const rectX = miniCfg.size.width / 2 - rectWidth / 2;
    const rectY = miniCfg.size.height / 2 - rectHeight / 2;

    ctx.strokeStyle = "blue";
    ctx.lineWidth = 2;
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);

    // OPTIONAL DEBUG
    ctx.fillStyle = "black";
    ctx.font = "12px Arial";
    ctx.fillText(`Scale: ${mainCfg.scale.toFixed(2)}`, 10, 20);
    ctx.fillText(`Rect: ${rectWidth.toFixed(1)}x${rectHeight.toFixed(1)}`, 10, 40);
};

// ───────────────────────────────────────────────
// EVENTS & INITIAL RENDER
// ───────────────────────────────────────────────
gridMap.setupEvents();
miniGridMap.setupEvents();

gridMap.render();
miniGridMap.render();
