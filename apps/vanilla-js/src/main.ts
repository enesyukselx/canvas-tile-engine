import "./style.css";
import villageImage1 from "/village1.webp";
import barbarVillageImage1 from "/village1_barbar.webp";
import villageImage4 from "/village4.webp";
import barbarVillageImage4 from "/village4_barbar.webp";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <div class="canvas-container" style="display: flex; flex-direction: column; gap: 12px; align-items: flex-start;">
        <div style="display: flex; gap: 16px; align-items: flex-start;">
            <canvas id="canvas"></canvas>
            <canvas id="mini-canvas"></canvas>
            <div id="popup" style="display:none; position:absolute; left:0; top:0; background:white; border:1px solid #ccc; padding:8px; z-index:10;"></div>
        </div>
        <div style="display: flex; gap: 8px; align-items: center;">
            <label style="display:flex; gap:4px; align-items:center;">
                <span style="color:white;">X</span>
                <input id="coord-x" type="number" value="0" style="width: 80px; padding: 4px;" />
            </label>
            <label style="display:flex; gap:4px; align-items:center;">
                <span style="color:white;">Y</span>
                <input id="coord-y" type="number" value="0" style="width: 80px; padding: 4px;" />
            </label>
            <button id="go-to-coords" style="padding: 8px 12px;">Go</button>
        </div>
    </div>
`;

const popup = document.getElementById("popup");

import { GridEngine, type GridEngineConfig } from "@grid-engine/core";

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
        const x = Math.floor(Math.random() * 400) - 200;
        const y = Math.floor(Math.random() * 400) - 200;
        const type = types[Math.floor(Math.random() * types.length)];
        items.push({ x, y, ...type });
    }
    return items;
}

const items = generateRandomItems(200000);

const startingCoords = { x: 0, y: 0 };

const mainMapOptions: GridEngineConfig = {
    scale: 50,
    minScale: 5,
    maxScale: 100,
    size: { width: 500, height: 500 },
    backgroundColor: "#337426ff",
    eventHandlers: {
        drag: true,
        zoom: true,
        resize: true,
        click: true,
        hover: true,
    },
    renderer: "canvas" as const, // Use literal type
    coordinates: {
        enabled: true,
        shownScaleRange: { min: 30, max: 100 },
    },
    debug: {
        enabled: true,
        grid: {
            enabled: false,
            color: "rgba(0, 0, 0, 0.3)",
            lineWidth: 1,
        },
        hud: {
            enabled: true,
            topLeftCoordinates: false,
            coordinates: true,
            scale: true,
            tilesInView: false,
        },
    },
};
const miniMapOptions = {
    scale: 10,
    minScale: 5,
    maxScale: 20,
    size: { width: 300, height: 300 },
    backgroundColor: "#337426ff",
    eventHandlers: {
        drag: true,
        zoom: false,
        resize: true,
    },
    debug: {
        enabled: false,
        grid: {
            enabled: true,
            color: "rgba(0, 0, 0, 0.3)",
            lineWidth: 1,
        },
        hud: {
            enabled: true,
            topLeftCoordinates: true,
            coordinates: true,
            scale: true,
            tilesInView: true,
        },
    },
};

// ───────────────────────────────────────────────
// MAIN CANVAS
// ───────────────────────────────────────────────
const mainMapCanvas = document.getElementById("canvas") as HTMLCanvasElement;
const mainMap = new GridEngine(mainMapCanvas, mainMapOptions, startingCoords);

// ───────────────────────────────────────────────
// MINI MAP
// ───────────────────────────────────────────────

const miniMapCanvas = document.getElementById("mini-canvas") as HTMLCanvasElement;
const miniMap = new GridEngine(miniMapCanvas, miniMapOptions, startingCoords);

// ───────────────────────────────────────────────
// DRAW OBJECTS ON BOTH MAPS
// ───────────────────────────────────────────────
const drawItems = async () => {
    const loaded = await Promise.all(
        items.map(async (item) => ({
            item,
            img: await mainMap.images.load(item.image),
        }))
    );

    const imageItems = loaded.map(({ item, img }) => ({
        img,
        x: item.x,
        y: item.y,
        size: 1,
    }));

    const circleItems = loaded.map(({ item }) => ({
        x: item.x,
        y: item.y,
        size: 0.1,
        origin: {
            mode: "cell" as const,
            x: 0.1,
            y: 0.1,
        },
        style: { fillStyle: item.color },
    }));

    const miniMapRects = loaded.map(({ item }) => ({
        x: item.x,
        y: item.y,
        size: 0.5,
        style: { fillStyle: item.color },
    }));

    mainMap.drawImage(imageItems);
    mainMap.drawCircle(circleItems, 1);
    miniMap.drawRect(miniMapRects);
};

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

const goToBtn = document.getElementById("go-to-coords") as HTMLButtonElement | null;
const xInput = document.getElementById("coord-x") as HTMLInputElement | null;
const yInput = document.getElementById("coord-y") as HTMLInputElement | null;
goToBtn?.addEventListener("click", () => {
    const x = xInput ? Number(xInput.value) : NaN;
    const y = yInput ? Number(yInput.value) : NaN;
    if (Number.isNaN(x) || Number.isNaN(y)) {
        alert("Please enter valid numbers for X and Y.");
        return;
    }
    mainMap.goCoords(x, y, 500);
});

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

drawItems().then(() => {
    mainMap.render();
    miniMap.render();
});
