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

// A hand-authored Tiled export: two tile layers (one animated water tile,
// one H-flipped tree GID) plus an object layer with a zone, a route, and a
// point of interest.
const json = await (await fetch("/maps/island.tmj")).json();
const map = await parseTiledMap(json);
if (map.warnings.length > 0) console.warn("[tiled]", map.warnings);

const { center: center, ...config } = gridToSize({
    columns: map.columns,
    rows: map.rows,
    cellSize: 48,
});

const CONFIG: CanvasTileEngineConfig = {
    ...config,
    gridAligned: true,
    responsive: "preserve-viewport",
    backgroundColor: "#e6e6e6",
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
    pathStyle: (data) =>
        data.type === "zone"
            ? { fillStyle: "rgba(34, 197, 94, 0.25)", strokeStyle: "#16a34a", lineWidthPx: 2 }
            : undefined,
});
engine.render();

engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<TiledObjectData>(coords.raw);
    if (hit?.item.data) console.log("clicked:", hit.item.data);
};
