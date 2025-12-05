import "./style.css";
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { generateMapObjects } from "./generateMapObjects";

const INITIAL_COORDS = { x: 200, y: 200 };
const INITIAL_MAIN_MAP_SIZE = 500;
const INITIAL_MINI_MAP_SIZE = 300;
// Popup elements
const popup = document.getElementById("village-popup");
const popupPlayerNameElem = document.getElementById("popup-player-name");
const popupNameElem = document.getElementById("popup-village-name");
const popupVillageTypeElem = document.getElementById("popup-village-type");
const popupPointsElem = document.getElementById("popup-village-points");
const popupCoordinatesElem = document.getElementById("popup-coordinates");

// Input elements for coordinates and button to go to coordinates
const inputX = document.getElementById("x") as HTMLInputElement;

const inputY = document.getElementById("y") as HTMLInputElement;

const goToCoordsBtn = document.getElementById("go-to-coords") as HTMLButtonElement;

// Event listeners for resizing maps
// Mini map size input event listener
const miniMapSizeInput = document.getElementById("minimap-size-select") as HTMLInputElement;

miniMapSizeInput.value = INITIAL_MINI_MAP_SIZE.toString();
miniMapSizeInput.addEventListener("change", () => {
    const newSize = Number(miniMapSizeInput.value);
    if (Number.isNaN(newSize) || newSize < 100 || newSize > 700) {
        alert("Please enter a valid size between 100 and 700.");
        miniMapSizeInput.value = INITIAL_MINI_MAP_SIZE.toString();
        return;
    }
    miniMap.resize(newSize, newSize, 300);
    // Recalculate bounds after resize since viewport size changed
    miniMap.setBounds(calculateMiniMapBounds());
    miniMap.render();
});

// Main map size input event listener
const mainMapSizeInput = document.getElementById("mainmap-size-select") as HTMLInputElement;
mainMapSizeInput.value = INITIAL_MAIN_MAP_SIZE.toString();
mainMapSizeInput.addEventListener("change", () => {
    const newSize = Number(mainMapSizeInput.value);
    if (Number.isNaN(newSize) || newSize < 200 || newSize > 800) {
        alert("Please enter a valid size between 200 and 800.");
        mainMapSizeInput.value = INITIAL_MAIN_MAP_SIZE.toString();
        return;
    }
    mainMap.resize(newSize, newSize, 300);
    mainMap.render();
});

// Set initial values for input fields
inputX.value = INITIAL_COORDS.x.toString();
inputY.value = INITIAL_COORDS.y.toString();

// Main map configuration
const mainMapOptions: CanvasTileEngineConfig = {
    scale: 50,
    minScale: 40,
    maxScale: 60,
    size: { width: 500, height: 500, maxHeight: 800, maxWidth: 800, minHeight: 200, minWidth: 200 },
    backgroundColor: "#337426ff",
    eventHandlers: {
        zoom: true,
        drag: true,
        resize: true,
        click: true,
        hover: true,
    },
    coordinates: {
        enabled: true,
        shownScaleRange: { min: 40, max: 60 },
    },
    bounds: {
        minX: 0,
        maxX: 500,
        minY: 0,
        maxY: 500,
    },
};

// Mini map configuration
const miniMapOptions: CanvasTileEngineConfig = {
    scale: 6,
    size: { width: 300, height: 300, maxWidth: 700, maxHeight: 700, minWidth: 100, minHeight: 100 },
    backgroundColor: "#337426ff",
    eventHandlers: {
        drag: true,
        resize: true,
    },
    // Bounds will be dynamically based on viewport size
};

// Canvas-wrapper elements for main and mini maps
const mainMapCanvas = document.getElementById("main-map-wrapper") as HTMLDivElement;
const miniMapCanvas = document.getElementById("mini-map-wrapper") as HTMLDivElement;

// Initialize maps
const mainMap = new CanvasTileEngine(mainMapCanvas, mainMapOptions, INITIAL_COORDS);
const miniMap = new CanvasTileEngine(miniMapCanvas, miniMapOptions, INITIAL_COORDS);

// Calculate mini map bounds so its CENTER can move within main map's CENTER range
// Main map center range: (bounds.min + viewWidth/2) to (bounds.max - viewWidth/2)
// Mini map should have same center range, so we need to adjust bounds for its viewport
const calculateMiniMapBounds = () => {
    const mainBounds = mainMapOptions.bounds!;
    const mainCfg = mainMap.getConfig();
    const miniCfg = miniMap.getConfig();

    // Main map viewport size in world units
    const mainViewWidth = mainCfg.size.width / mainCfg.scale;
    const mainViewHeight = mainCfg.size.height / mainCfg.scale;

    // Main map center movement range
    const mainCenterMinX = mainBounds.minX + mainViewWidth / 2;
    const mainCenterMaxX = mainBounds.maxX - mainViewWidth / 2;
    const mainCenterMinY = mainBounds.minY + mainViewHeight / 2;
    const mainCenterMaxY = mainBounds.maxY - mainViewHeight / 2;

    // Mini map viewport size in world units
    const miniViewWidth = miniCfg.size.width / miniCfg.scale;
    const miniViewHeight = miniCfg.size.height / miniCfg.scale;

    return {
        minX: mainCenterMinX - miniViewWidth / 2,
        maxX: mainCenterMaxX + miniViewWidth / 2,
        minY: mainCenterMinY - miniViewHeight / 2,
        maxY: mainCenterMaxY + miniViewHeight / 2,
    };
};

// Generate map objects
const items = generateMapObjects(10000, INITIAL_COORDS.x, INITIAL_COORDS.y, 1.2);

// Create coordinate-based Map for O(1) lookups (hover/click)
const itemsByCoord = new Map<string, (typeof items)[0]>();
for (const item of items) {
    if (item.type !== "terrain") {
        itemsByCoord.set(`${item.x},${item.y}`, item);
    }
}

// Function to draw items on both maps
const drawItems = async () => {
    // Preload unique images only (not 50k times!)
    const uniqueUrls = [...new Set(items.map((i) => i.imageUrl))];
    const imageCache = new Map<string, HTMLImageElement>();
    await Promise.all(
        uniqueUrls.map(async (url) => {
            imageCache.set(url, await mainMap.images.load(url));
        })
    );

    // Build arrays in single pass
    const imageItems: Array<{ img: HTMLImageElement; x: number; y: number; size: number }> = [];
    const miniMapRects: Array<{ x: number; y: number; size: number; style: { fillStyle: string } }> = [];
    const circleItems: Array<{
        x: number;
        y: number;
        size: number;
        origin: { mode: "cell"; x: number; y: number };
        style: { fillStyle: string };
    }> = [];

    for (const item of items) {
        const img = imageCache.get(item.imageUrl)!;

        imageItems.push({ img, x: item.x, y: item.y, size: 1 });
        miniMapRects.push({ x: item.x, y: item.y, size: 0.9, style: { fillStyle: item.color } });

        if (item.type !== "terrain") {
            circleItems.push({
                x: item.x,
                y: item.y,
                size: 0.1,
                origin: { mode: "cell", x: 0.1, y: 0.1 },
                style: { fillStyle: item.color },
            });
        }
    }

    // Draw on maps
    mainMap.drawImage(imageItems);
    mainMap.drawCircle(circleItems, 1);

    // Use pre-rendered static cache for mini map (huge performance boost for 100k items!)
    miniMap.drawStaticRect(miniMapRects, "minimap-items");
};

// Synchronization logic between main map and mini map
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
    // Set initial bounds for mini map
    miniMap.setBounds(calculateMiniMapBounds());

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
// Draws a rectangle on the mini map representing the current viewport of the main map
// "onDraw" is a callback for custom drawing on the map's canvas
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

    ctx.strokeStyle = "white";
    ctx.lineWidth = 2;
    ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
};

// Custom draw function on the main map to draw a red square at the center
// This draw function is added with a priority of 3 (to be drawn after other elements)
mainMap.addDrawFunction((ctx) => {
    const centerX = mainMap.getConfig().size.width / 2;
    const centerY = mainMap.getConfig().size.height / 2;
    ctx.fillStyle = "red";
    ctx.fillRect(centerX - 5, centerY - 5, 5, 5);
}, 3);

// Handle hover events on the main map
// coords: The coordinates of the hover event
// mouse: The mouse event object
// client: The client coordinates of the mouse event
mainMap.onHover = (coords, _mouse, client) => {
    // O(1) lookup using coordinate Map
    const item = itemsByCoord.get(`${coords.snapped.x},${coords.snapped.y}`);

    if (item) {
        popup?.classList.remove("hidden");
        if (popup) {
            const position = {
                x: client.snapped.x - 160 < 0 ? 0 : client.snapped.x - 160,
                y: client.snapped.y + mainMap.getConfig().scale / 2,
            };
            popup.style.left = `${position.x}px`;
            popup.style.top = `${position.y}px`;
        }

        // Update popup content
        if (popupPlayerNameElem) {
            popupPlayerNameElem.textContent = `${item.playerName}`;
        }
        if (popupNameElem) {
            popupNameElem.textContent = `${item.villageName}`;
        }
        if (popupVillageTypeElem) {
            popupVillageTypeElem.textContent = item.type.toUpperCase();
        }
        if (popupPointsElem) {
            popupPointsElem.textContent = `Points: 500`;
        }
        if (popupCoordinatesElem) {
            popupCoordinatesElem.textContent = `${item.x} | ${item.y}`;
        }
    } else {
        popup?.classList.add("hidden");
    }
};

// Handle mouse leave event on the main map
mainMap.onMouseLeave = () => {
    popup?.classList.add("hidden");
};

// Handle click events on the main map
// eslint-disable-next-line @typescript-eslint/no-unused-vars
mainMap.onClick = (coords, _mouse, _client) => {
    // O(1) lookup using coordinate Map
    const item = itemsByCoord.get(`${coords.snapped.x},${coords.snapped.y}`);

    if (item) {
        alert(
            `Village: ${item.villageName}\nPlayer: ${item.playerName}\nType: ${item.type}\nCoordinates: ${item.x} | ${item.y}`
        );
    }
};

// Handle click event on the "Go To Coordinates" button
goToCoordsBtn.addEventListener("click", () => {
    const x = Number(inputX.value);
    const y = Number(inputY.value);
    if (Number.isNaN(x) || Number.isNaN(y)) {
        alert("Please enter valid numbers for X and Y.");
        return;
    }
    mainMap.goCoords(x, y, 500);
});

// Initial drawing of items and rendering of maps
// Image loading is asynchronous, so we wait for it to complete before rendering
void drawItems().then(() => {
    mainMap.drawGridLines(5);
    mainMap.drawGridLines(50, 4);
    mainMap.render();
    miniMap.drawGridLines(1, 0.5, "rgba(0,0,0,1)", 3);
    miniMap.drawGridLines(5, 0.8, "rgba(0,0,0,1)", 3);
    miniMap.drawGridLines(50, 2, "rgba(0,0,0,1)", 3);
    miniMap.render();
});
