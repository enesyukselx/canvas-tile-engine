import "./style.css";
import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";

const INITIAL_COORDS = { x: 0, y: 0 };

const HOVER_LAYER_INDEX = 0;
const SELECT_LAYER_INDEX = 1;
const OBJECTS_LAYER_INDEX = 2;

// User Menu Buttons
const saveButton = document.getElementById("save-button") as HTMLButtonElement;
const loadButton = document.getElementById("load-button") as HTMLButtonElement;
const clearButton = document.getElementById("clear-button") as HTMLButtonElement;
const centerButton = document.getElementById("center-button") as HTMLButtonElement;

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

// If the window is resized, resize the map accordingly
window.addEventListener("resize", () => {
    map.resize(window.innerWidth, window.innerHeight, 0);
    map.render();
});

map.onHover = (coords) => {
    // Clear previous hover layer
    map.clearLayer(HOVER_LAYER_INDEX);
    // Draw new hover rectangle
    map.drawRect(
        {
            x: coords.snapped.x,
            y: coords.snapped.y,
            style: {
                fillStyle: "#75ba80",
            },
        },
        HOVER_LAYER_INDEX
    );

    // Render the map to show changes
    map.render();
};

map.onMouseLeave = () => {
    // Clear hover layer when mouse leaves the map
    map.clearLayer(HOVER_LAYER_INDEX);
    // Render the map to show changes
    map.render();
};

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
    // Clear objects layer
    map.clearLayer(OBJECTS_LAYER_INDEX);
    // Render the map to show changes
    map.render();
});

centerButton.addEventListener("click", () => {
    // Center the map at the initial coordinates
    map.goCoords(INITIAL_COORDS.x, INITIAL_COORDS.y);
    // Render the map to show changes
    map.render();
});

map.render();
