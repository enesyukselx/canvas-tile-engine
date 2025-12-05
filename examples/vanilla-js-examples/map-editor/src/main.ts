import "./style.css";
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";

// ========================================
// TYPES
// ========================================

type BuildingType = "home" | "farm" | "barrack" | "library" | "tower" | "forest";

interface PlacedBuilding {
    x: number;
    y: number;
    type: BuildingType;
}

// ========================================
// CONSTANTS
// ========================================

const INITIAL_COORDS = { x: 0, y: 0 };

const HOVER_LAYER_INDEX = 0;
// const SELECT_LAYER_INDEX = 1;
const OBJECTS_LAYER_INDEX = 2;

const BUILDING_IMAGES: Record<BuildingType, string> = {
    home: "/buildings/home.png",
    farm: "/buildings/farm.png",
    barrack: "/buildings/barrack.png",
    library: "/buildings/library.png",
    tower: "/buildings/tower.png",
    forest: "/buildings/forest.png",
};

// ========================================
// STATE
// ========================================

let selectedBuilding: BuildingType | null = null;
let placedBuildings: PlacedBuilding[] = [];
const loadedImages: Map<BuildingType, HTMLImageElement> = new Map();

// ========================================
// UI ELEMENTS
// ========================================

// User Menu Buttons
const saveButton = document.getElementById("save-button") as HTMLButtonElement;
const loadButton = document.getElementById("load-button") as HTMLButtonElement;
const clearButton = document.getElementById("clear-button") as HTMLButtonElement;
const centerButton = document.getElementById("center-button") as HTMLButtonElement;

// Building buttons
const buildingButtons = document.querySelectorAll("[data-building]");

// Get the map container element
const mapWrapper = document.getElementById("map-container") as HTMLDivElement;

const mapOptions: CanvasTileEngineConfig = {
    scale: 100,
    minScale: 80,
    maxScale: 120,
    size: { width: window.innerWidth, height: window.innerHeight, minHeight: 200, minWidth: 200 },
    backgroundColor: "#0d9e42",
    eventHandlers: {
        zoom: true,
        drag: true,
        resize: false,
        click: true,
        hover: true,
    },
    coordinates: {
        enabled: true,
        shownScaleRange: { min: 50, max: 200 },
    },
    debug: {
        enabled: true,
        grid: {
            enabled: true,
            color: "rgba(255, 255, 255, 0.1)",
            lineWidth: 1,
        },
        hud: {
            enabled: true,
            coordinates: true,
        },
    },
};

const map = new CanvasTileEngine(mapWrapper, mapOptions, {
    x: INITIAL_COORDS.x,
    y: INITIAL_COORDS.y,
});

// ========================================
// IMAGE LOADING
// ========================================

async function loadAllImages() {
    const loadPromises = Object.entries(BUILDING_IMAGES).map(async ([type, url]) => {
        const img = await map.images.load(url);
        loadedImages.set(type as BuildingType, img);
    });
    await Promise.all(loadPromises);
}

// ========================================
// DRAWING FUNCTIONS
// ========================================

function drawBuildings() {
    map.clearLayer(OBJECTS_LAYER_INDEX);

    if (placedBuildings.length === 0) {
        map.render();
        return;
    }

    const imageItems = placedBuildings.map((building) => ({
        x: building.x,
        y: building.y,
        size: 1,
        img: loadedImages.get(building.type)!,
    }));

    map.drawImage(imageItems, OBJECTS_LAYER_INDEX);
    map.render();
}

function drawHoverPreview(x: number, y: number) {
    map.clearLayer(HOVER_LAYER_INDEX);

    // Check if there's already a building at this position
    const existingBuilding = placedBuildings.find((b) => b.x === x && b.y === y);

    if (selectedBuilding && !existingBuilding) {
        // Show building preview (semi-transparent)
        const img = loadedImages.get(selectedBuilding);
        if (img) {
            map.drawImage(
                {
                    x,
                    y,
                    size: 1,
                    img,
                },
                HOVER_LAYER_INDEX
            );
        }
        // Green hover for valid placement
        map.drawRect(
            {
                x,
                y,
                size: 1,
                style: { fillStyle: "rgba(34, 197, 94, 0.3)" },
            },
            HOVER_LAYER_INDEX
        );
    } else if (existingBuilding) {
        // Red hover for occupied cell
        map.drawRect(
            {
                x,
                y,
                size: 1,
                style: { fillStyle: "rgba(239, 68, 68, 0.3)" },
            },
            HOVER_LAYER_INDEX
        );
    } else {
        // Default hover (no building selected)
        map.drawRect(
            {
                x,
                y,
                size: 1,
                style: { fillStyle: "rgba(255, 255, 255, 0.15)" },
            },
            HOVER_LAYER_INDEX
        );
    }

    map.render();
}

// ========================================
// BUILDING SELECTION
// ========================================

function selectBuilding(type: BuildingType | null) {
    selectedBuilding = type;

    // Update UI
    buildingButtons.forEach((btn) => {
        const btnType = btn.getAttribute("data-building");
        if (btnType === type) {
            btn.classList.add("ring-2", "ring-lime-400", "ring-offset-2", "ring-offset-transparent");
        } else {
            btn.classList.remove("ring-2", "ring-lime-400", "ring-offset-2", "ring-offset-transparent");
        }
    });

    // Update cursor
    if (type) {
        mapWrapper.style.cursor = "crosshair";
    } else {
        mapWrapper.style.cursor = "grab";
    }
}

// ========================================
// BUILDING PLACEMENT
// ========================================

function placeBuilding(x: number, y: number) {
    if (!selectedBuilding) return;

    // Check if position is already occupied
    const existingIndex = placedBuildings.findIndex((b) => b.x === x && b.y === y);

    if (existingIndex !== -1) {
        // Remove existing building (toggle behavior)
        placedBuildings.splice(existingIndex, 1);
    } else {
        // Place new building
        placedBuildings.push({
            x,
            y,
            type: selectedBuilding,
        });
    }

    drawBuildings();
}

// function removeBuilding(x: number, y: number) {
//     const index = placedBuildings.findIndex((b) => b.x === x && b.y === y);
//     if (index !== -1) {
//         placedBuildings.splice(index, 1);
//         drawBuildings();
//     }
// }

// ========================================
// EVENT HANDLERS
// ========================================

// If the window is resized, resize the map accordingly
window.addEventListener("resize", () => {
    map.resize(window.innerWidth, window.innerHeight, 0);
    map.render();
});

map.onHover = (coords) => {
    drawHoverPreview(coords.snapped.x, coords.snapped.y);
};

map.onMouseLeave = () => {
    // Clear hover layer when mouse leaves the map
    map.clearLayer(HOVER_LAYER_INDEX);
    // Render the map to show changes
    map.render();
};

map.onClick = (coords) => {
    const x = coords.snapped.x;
    const y = coords.snapped.y;

    if (selectedBuilding) {
        placeBuilding(x, y);
        // Redraw hover after placement
        drawHoverPreview(x, y);
    }
};

// Building button click handlers
buildingButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
        const type = btn.getAttribute("data-building") as BuildingType;
        if (selectedBuilding === type) {
            // Deselect if clicking the same building
            selectBuilding(null);
        } else {
            selectBuilding(type);
        }
    });
});

// User Menu Button Event Listeners
saveButton.addEventListener("click", () => {
    // TODO: implement save functionality
    alert("Save functionality is not implemented yet.");
});

loadButton.addEventListener("click", () => {
    // TODO: implement load functionality
    alert("Load functionality is not implemented yet.");
});

clearButton.addEventListener("click", () => {
    if (placedBuildings.length === 0) return;
    if (confirm("Are you sure you want to clear all buildings?")) {
        placedBuildings = [];
        drawBuildings();
    }
});

centerButton.addEventListener("click", () => {
    // Center the map at the initial coordinates
    map.goCoords(INITIAL_COORDS.x, INITIAL_COORDS.y);
});

// Keyboard shortcuts
document.addEventListener("keydown", (e) => {
    // ESC to deselect building
    if (e.key === "Escape") {
        selectBuilding(null);
    }

    // Number keys to select buildings
    const buildingKeys: Record<string, BuildingType> = {
        "1": "home",
        "2": "farm",
        "3": "barrack",
        "4": "library",
        "5": "tower",
        "6": "forest",
    };

    if (buildingKeys[e.key]) {
        selectBuilding(buildingKeys[e.key]);
    }

    // C to center
    if (e.key === "c" || e.key === "C") {
        map.goCoords(INITIAL_COORDS.x, INITIAL_COORDS.y);
    }
});

// ========================================
// INITIALIZATION
// ========================================

async function init() {
    await loadAllImages();
    map.render();
}

void init();
