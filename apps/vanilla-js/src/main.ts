import "./style.css";
import villageImage1 from "/village1.webp";
import barbarVillageImage1 from "/village1_barbar.webp";
import villageImage4 from "/village4.webp";
import barbarVillageImage4 from "/village4_barbar.webp";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <div class="canvas-container" style="display: flex; gap: 16px;">
        <canvas id="canvas"></canvas>
        <canvas id="mini-canvas"></canvas>
        <div id="popup" style="display:none; position:absolute; left:0; top:0; background:white; border:1px solid #ccc; padding:8px; z-index:10;"></div>
    </div>
`;

const popup = document.getElementById("popup");

import { CanvasGridMap } from "@canvas-grid-map/core";

const VILLAGE_TYPES = {
    barbar_1: {
        color: "darkgray",
        image: barbarVillageImage1,
    },
    normal_1: {
        color: "blue",
        image: villageImage1,
    },
    barbar_4: {
        color: "darkgray",
        image: barbarVillageImage4,
    },
    normal_4: {
        color: "red",
        image: villageImage4,
    },
};

// ───────────────────────────────────────────────
// DATA
// ───────────────────────────────────────────────
type VillageItem = {
    x: number;
    y: number;
    color: string;
    image: string;
};

function generateRandomItems(count: number): VillageItem[] {
    const types = Object.values(VILLAGE_TYPES);
    const items: VillageItem[] = [];
    for (let i = 0; i < count; i++) {
        const x = Math.floor(Math.random() * 21) - 10;
        const y = Math.floor(Math.random() * 21) - 10;
        const type = types[Math.floor(Math.random() * types.length)];
        items.push({ x, y, ...type });
    }
    return items;
}

const items = generateRandomItems(150);

const startingCoords = { x: 0, y: 0 };

const mainMapOptions = {
    scale: 50,
    minScale: 5,
    maxScale: 100,
    size: { width: 500, height: 500 },
    backgroundColor: "#337426ff",
    events: {
        drag: true,
        zoom: true,
        resize: true,
        click: true,
        hover: true,
    },
    showCoordinates: true,
    minScaleShowCoordinates: 10,
};

const miniMapOptions = {
    scale: 10,
    minScale: 5,
    maxScale: 20,
    size: { width: 300, height: 300 },
    backgroundColor: "#337426ff",
    events: {
        drag: true,
        zoom: false,
        resize: true,
    },
    showCoordinates: false,
};

// ───────────────────────────────────────────────
// MAIN CANVAS
// ───────────────────────────────────────────────
const mainMapCanvas = document.getElementById("canvas") as HTMLCanvasElement;
const mainMap = new CanvasGridMap(mainMapCanvas, mainMapOptions, startingCoords);

// ───────────────────────────────────────────────
// MINI MAP
// ───────────────────────────────────────────────

const miniMapCanvas = document.getElementById("mini-canvas") as HTMLCanvasElement;
const miniMap = new CanvasGridMap(miniMapCanvas, miniMapOptions, startingCoords);

// ───────────────────────────────────────────────
// DRAW OBJECTS ON BOTH MAPS
// ───────────────────────────────────────────────
items.forEach(async (item) => {
    mainMap.drawImage(await mainMap.images.load(item.image), item.x, item.y, 1, 0.7);
    miniMap.drawRect(item.x, item.y, { fillStyle: item.color }, 0.7);
});

// ───────────────────────────────────────────────
// MINI MAP → MAIN MAP SYNC
// ───────────────────────────────────────────────

let isSyncing = false;

miniMap.onCoordsChange = (coords) => {
    if (isSyncing) return;
    isSyncing = true;

    mainMap.updateCoords(coords);
    mainMap.render();

    isSyncing = false;
};

// ───────────────────────────────────────────────
// MAIN MAP → MINI MAP VIEWPORT UPDATE
// ───────────────────────────────────────────────
mainMap.onCoordsChange = (coords) => {
    if (isSyncing) return;
    isSyncing = true;
    popup!.style.display = "none";
    miniMap.updateCoords(coords);
    miniMap.render();

    isSyncing = false;
};

mainMap.onClick = (coords, _mouse, _client) => {
    if (items.some((item) => item.x === coords.snapped.x && item.y === coords.snapped.y)) {
        alert(`Clicked on village at (${coords.snapped.x}, ${coords.snapped.y})`);
        popup!.style.display = "none";
    }
};

mainMap.onMouseLeave = () => {
    popup!.style.display = "none";
};

mainMap.onHover = (coords, _mouse, client) => {
    if (items.some((item) => item.x === coords.snapped.x && item.y === coords.snapped.y)) {
        mainMapCanvas.style.cursor = "pointer";
        if (popup) {
            popup.style.display = "block";
            popup.style.left = client.raw.x + 10 + "px";
            popup.style.top = client.raw.y + 10 + "px";
            popup.innerHTML = `<span style="color: black;">Village at (${coords.snapped.x}, ${coords.snapped.y})</span>`;
        }
    } else {
        mainMapCanvas.style.cursor = "default";
        if (popup) {
            popup.style.display = "none";
        }
    }
};

// ───────────────────────────────────────────────
// MINI MAP VIEWPORT RECTANGLE DRAWING
// ───────────────────────────────────────────────
miniMap.onDraw = (ctx) => {
    const mainCfg = mainMap.getConfig();
    const miniCfg = miniMap.getConfig();

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
    ctx.fillStyle = "white";
    ctx.font = "16px Arial";

    ctx.fillText(`Scale: ${mainCfg.scale.toFixed(2)}`, 10, 20);
    ctx.fillText(`Rect: ${rectWidth.toFixed(1)}x${rectHeight.toFixed(1)}`, 10, 40);
    ctx.fillText(
        `Center: (${mainMap.getCenterCoords().x.toFixed(2)}, ${mainMap.getCenterCoords().y.toFixed(2)})`,
        10,
        60
    );
};

mainMap.onDraw = (ctx) => {
    const mainCfg = mainMap.getConfig();
    const rectWidth = mainCfg.size.width;
    const rectHeight = mainCfg.size.height;
    const rectX = mainCfg.size.width / 2 - rectWidth / 2;
    const rectY = mainCfg.size.height / 2 - rectHeight / 2;
    ctx.fillStyle = "black";
    ctx.fillRect(rectX + rectWidth / 2 - 5 / 2, rectY + rectHeight / 2 - 5 / 2, 5, 5);
};

// ───────────────────────────────────────────────
// EVENTS & INITIAL RENDER
// ───────────────────────────────────────────────
mainMap.setupEvents();
miniMap.setupEvents();

mainMap.render();
miniMap.render();
