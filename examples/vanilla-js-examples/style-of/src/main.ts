import {
    CanvasTileEngine,
    gridToSize,
    type CanvasTileEngineConfig,
    type Rect,
} from "@canvas-tile-engine/core";
import "./style.css";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const COLS = 20;
const ROWS = 20;

const { center: center, ...config } = gridToSize({
    columns: COLS,
    rows: ROWS,
    cellSize: 20,
});

const CONFIG: CanvasTileEngineConfig = {
    ...config,
    gridAligned: true,
    responsive: "preserve-viewport",
    backgroundColor: "#e6e6e6",
    eventHandlers: {
        click: true,
    },
};

const canvas = document.querySelector<HTMLDivElement>("#canvas");
const engine = new CanvasTileEngine(
    canvas,
    CONFIG,
    new RendererCanvas(),
    center,
);

engine.drawGridLines(1, 0.5, "#000000");

type TileData = { id: number };

const tiles: Rect<TileData>[] = [];
for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
        tiles.push({
            x,
            y,
            size: 0.9,
            style: { fillStyle: "#94a3b8" },
            data: { id: y * COLS + x },
        });
    }
}

const selected = new Set<number>();

// Registered ONCE. styleOf runs at paint time and reads `selected` live, so
// toggling a tile never re-registers the items or rebuilds the spatial index.
engine.drawRect(tiles, 1, {
    id: "tiles",
    styleOf: (tile) =>
        selected.has(tile.data!.id) ? { fillStyle: "#3b82f6" } : undefined,
});

engine.onClick = (coords) => {
    const hit = engine.hitTestFirst<TileData>(coords.raw);
    if (!hit) return;

    const id = hit.item.data!.id;
    if (selected.has(id)) {
        selected.delete(id);
    } else {
        selected.add(id);
    }

    engine.render(); // repaint alone shows the change
};

engine.render();
