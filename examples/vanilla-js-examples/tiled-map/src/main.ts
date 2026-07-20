import {
    CanvasTileEngine,
    gridToSize,
    type CanvasTileEngineConfig,
} from "@canvas-tile-engine/core";
import "./style.css";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import {
    mountTiledMap,
    parseTiledMap,
    type TiledObjectData,
} from "@canvas-tile-engine/tiled";

// "orthogonal-outside" — the official Tiled example map (45x31, authored in
// Tiled itself; see public/maps/CREDITS.txt — tileset by Buch, CC0). Two
// tile layers (Ground + Fringe) with base64+zlib data, and a hand-placed
// object layer: a spawn Location rect, a Trigger ellipse, a Fixture polygon,
// NPC patrol polylines, and dozens of tile objects (some with flipped GIDs).
const json = await (await fetch("/maps/outside.tmj")).json();
const map = await parseTiledMap(json);
if (map.warnings.length > 0) console.warn("[tiled]", map.warnings);

const { center: center, ...config } = gridToSize({
    columns: map.columns,
    rows: map.rows,
    cellSize: 32,
});

const CONFIG: CanvasTileEngineConfig = {
    ...config,
    gridAligned: true,
    responsive: "preserve-viewport",
    backgroundColor: "#1a1a24",
    eventHandlers: {
        click: true,
        drag: true,
        zoom: true,
    },
};

const canvas = document.querySelector<HTMLDivElement>("#canvas");
const engine = new CanvasTileEngine(
    canvas,
    CONFIG,
    new RendererCanvas(),
    center,
);

await mountTiledMap(engine, map, {
    resolveImage: (source) => `/maps/${source}`,
    // Style Tiled objects by their class; undefined falls back to the
    // package default (a soft blue).
    pathStyle: (data) => {
        switch (data.type) {
            case "Location":
                return {
                    fillStyle: "rgba(250, 204, 21, 0.12)",
                    strokeStyle: "#eab308",
                    lineWidthPx: 2,
                };
            case "Trigger":
                return {
                    fillStyle: "rgba(56, 189, 248, 0.1)",
                    strokeStyle: "#38bdf8",
                    lineWidthPx: 2,
                    lineDashPx: [6, 4],
                };
            case "Fixture":
                return {
                    fillStyle: "rgba(148, 163, 184, 0.12)",
                    strokeStyle: "#94a3b8",
                    lineWidthPx: 1,
                };
            case "NPC":
                return {
                    strokeStyle: "#f472b6",
                    lineWidthPx: 2,
                    lineDashPx: [8, 5],
                };
            default:
                return undefined;
        }
    },
    markerStyle: { fillStyle: "#ef4444" },
    markerSizePx: 8,
});
engine.render();

engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<TiledObjectData>(coords.raw);
    if (hit?.item.data) console.log("clicked:", hit.item.data);
};
