import { generateMapObjects } from "./generateMapObjects";
import "./style.css";
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";

const INITIAL_COORDS = { x: 0, y: 0 };

const popup = document.getElementById("village-popup");
const popupPlayerNameElem = document.getElementById("popup-player-name");
const popupNameElem = document.getElementById("popup-village-name");
const popupVillageTypeElem = document.getElementById("popup-village-type");
const popupPointsElem = document.getElementById("popup-village-points");
const popupCoordinatessElem = document.getElementById("popup-coordinates");

const inputX = document.getElementById("x") as HTMLInputElement;
const inputY = document.getElementById("y") as HTMLInputElement;
const goToCoordsBtn = document.getElementById("go-to-coords") as HTMLButtonElement;
const leftBtn = document.getElementById("left-btn") as HTMLButtonElement;
const rightBtn = document.getElementById("right-btn") as HTMLButtonElement;
const upBtn = document.getElementById("up-btn") as HTMLButtonElement;
const downBtn = document.getElementById("down-btn") as HTMLButtonElement;

inputX.value = INITIAL_COORDS.x.toString();
inputY.value = INITIAL_COORDS.y.toString();

const mainMapOptions: CanvasTileEngineConfig = {
    scale: 50,
    size: { width: 500, height: 500, maxHeight: 700, maxWidth: 700, minHeight: 200, minWidth: 200 },
    backgroundColor: "#337426ff",
    eventHandlers: {
        drag: true,
        resize: true,
        click: true,
        hover: true,
    },
    coordinates: {
        enabled: true,
        shownScaleRange: { min: 50, max: 50 },
    },
};

const miniMapOptions: CanvasTileEngineConfig = {
    scale: 10,
    size: { width: 300, height: 300, maxWidth: 700, maxHeight: 700, minWidth: 100, minHeight: 100 },
    backgroundColor: "#337426ff",
    eventHandlers: {
        drag: true,
        resize: true,
    },
};

const mainMapCanvas = document.getElementById("main-map-wrapper") as HTMLDivElement;
const miniMapCanvas = document.getElementById("mini-map-wrapper") as HTMLDivElement;

const mainMap = new CanvasTileEngine(mainMapCanvas, mainMapOptions, INITIAL_COORDS);
const miniMap = new CanvasTileEngine(miniMapCanvas, miniMapOptions, INITIAL_COORDS);

const items = generateMapObjects(5000, 0, 0, 1.2);

const drawItems = async () => {
    const loaded = await Promise.all(
        items.map(async (item) => ({
            item,
            img: await mainMap.images.load(item.imageUrl),
        }))
    );

    const imageItems = loaded.map(({ item, img }) => ({
        img,
        x: item.x,
        y: item.y,
        size: 1,
    }));

    const miniMapRects = loaded.map(({ item }) => ({
        x: item.x,
        y: item.y,
        size: 0.5,
        style: { fillStyle: item.color },
    }));

    mainMap.drawImage(imageItems);
    loaded.forEach(({ item }) => {
        if (item.type === "terrain") {
            return;
        }

        mainMap.drawCircle(
            {
                x: item.x,
                y: item.y,
                size: 0.1,
                origin: {
                    mode: "cell" as const,
                    x: 0.1,
                    y: 0.1,
                },
                style: { fillStyle: item.color },
            },
            1
        );
    });
    miniMap.drawRect(miniMapRects);
};

// Synchronization logic
let isSyncing = false;

miniMap.onCoordsChange = (coords) => {
    if (isSyncing) {
        return;
    }
    isSyncing = true;
    inputX.value = Math.round(coords.x).toString();
    inputY.value = Math.round(coords.y).toString();
    mainMap.updateCoords(coords);
    mainMap.render();

    isSyncing = false;
};

mainMap.onCoordsChange = (coords) => {
    if (isSyncing) {
        return;
    }
    popup?.classList.add("hidden");
    inputX.value = Math.round(coords.x).toString();
    inputY.value = Math.round(coords.y).toString();
    isSyncing = true;
    miniMap.updateCoords(coords);
    miniMap.render();

    isSyncing = false;
};

// Mini map viewport rectangle
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

    ctx.strokeStyle = "black";
    ctx.lineWidth = 1;
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
};

mainMap.onHover = (coords, _mouse, client) => {
    if (items.some((item) => item.x === coords.snapped.x && item.y === coords.snapped.y && item.type !== "terrain")) {
        popup?.classList.remove("hidden");
        popup!.style.left = `${client.raw.x - 120}px`;
        popup!.style.top = `${client.raw.y + 15}px`;
        const item = items.find((item) => item.x === coords.snapped.x && item.y === coords.snapped.y);
        console.log(item);
        if (item) {
            if (popupPlayerNameElem) popupPlayerNameElem.textContent = `Player: Joe Doe`;
            if (popupNameElem) popupNameElem.textContent = `Village: Joe's Village`;
            if (popupVillageTypeElem) popupVillageTypeElem.textContent = item.type;
            if (popupPointsElem) popupPointsElem.textContent = `Points: ${Math.floor(Math.random() * 1000)}`;
            if (popupCoordinatessElem) popupCoordinatessElem.textContent = `${item.x} · ${item.y}`;
        }
    } else {
        popup?.classList.add("hidden");
    }
};

mainMap.onMouseLeave = () => {
    popup?.classList.add("hidden");
};

goToCoordsBtn.addEventListener("click", () => {
    const x = Number(inputX.value);
    const y = Number(inputY.value);
    if (Number.isNaN(x) || Number.isNaN(y)) {
        alert("Please enter valid numbers for X and Y.");
        return;
    }
    mainMap.goCoords(x, y, 500);
});

leftBtn.addEventListener("click", () => {
    const currentCoords = mainMap.getCenterCoords();
    mainMap.goCoords(currentCoords.x - 5, currentCoords.y, 300);
});

rightBtn.addEventListener("click", () => {
    const currentCoords = mainMap.getCenterCoords();
    mainMap.goCoords(currentCoords.x + 5, currentCoords.y, 300);
});

upBtn.addEventListener("click", () => {
    const currentCoords = mainMap.getCenterCoords();
    mainMap.goCoords(currentCoords.x, currentCoords.y - 5, 300);
});

downBtn.addEventListener("click", () => {
    const currentCoords = mainMap.getCenterCoords();
    mainMap.goCoords(currentCoords.x, currentCoords.y + 5, 300);
});

drawItems().then(() => {
    mainMap.render();
    miniMap.render();
});
