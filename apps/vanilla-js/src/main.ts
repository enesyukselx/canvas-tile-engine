import "./style.css";
import villageImage1 from "/village1.webp";
import barbarVillageImage1 from "/village1_barbar.webp";
import villageImage4 from "/village4.webp";
import barbarVillageImage4 from "/village4_barbar.webp";

document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
    <div class="canvas-container" style="display: flex; gap: 16px; align-items: flex-start;">
        <canvas id="canvas"></canvas>
        <canvas id="mini-canvas"></canvas>
        <div style="display: flex; flex-direction: column; gap: 8px;">
            <button id="go-to-10-10" style="padding: 8px 12px;">Go to (10, 10)</button>
        </div>
        <div id="popup" style="display:none; position:absolute; left:0; top:0; background:white; border:1px solid #ccc; padding:8px; z-index:10;"></div>
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
        const x = Math.floor(Math.random() * 21) - 10;
        const y = Math.floor(Math.random() * 21) - 10;
        const type = types[Math.floor(Math.random() * types.length)];
        items.push({ x, y, ...type });
    }
    return items;
}

const items = generateRandomItems(150);

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
    renderer: "canvas" as const, // Use literal type
    debug: {
        enabled: true,
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

    loaded.forEach(({ item, img }) => {
        mainMap.drawImage(img, item.x, item.y, {
            size: 1,
        });
        mainMap.drawCircle(
            item.x,
            item.y,
            {
                size: 0.1,
                origin: {
                    mode: "cell",
                    x: 0.1,
                    y: 0.1,
                },
                style: { fillStyle: item.color },
            },
            1
        );
        miniMap.drawRect(item.x, item.y, {
            size: 0.5,
            style: { fillStyle: item.color },
        });
    });
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

const goToBtn = document.getElementById("go-to-10-10");
goToBtn?.addEventListener("click", () => {
    mainMap.goCoords(10, 10, 500);
    // miniMap.goCoords(10, 10, 500);
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

drawItems().then(() => {
    mainMap.render();
    miniMap.render();
});
