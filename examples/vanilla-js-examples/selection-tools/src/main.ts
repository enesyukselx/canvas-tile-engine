import {
    CanvasTileEngine,
    ItemCollection,
    SelectionController,
    createItemCollectionSelectionAdapter,
    type Rect,
} from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import "./style.css";

type TileData = { id: string; label: string; locked: boolean; selectable: boolean };
type Tile = Rect<TileData> & { id: string; data: TileData };

const wrapper = document.querySelector<HTMLDivElement>("#canvas-wrapper")!;
const selectButton = document.querySelector<HTMLButtonElement>("#select-tool")!;
const panButton = document.querySelector<HTMLButtonElement>("#pan-tool")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-selection")!;
const count = document.querySelector<HTMLHeadingElement>("#selection-count")!;
const list = document.querySelector<HTMLUListElement>("#selected-items")!;
const toolStatus = document.querySelector<HTMLParagraphElement>("#tool-status")!;
const operationStatus = document.querySelector<HTMLSpanElement>("#operation-status")!;

const tiles = new ItemCollection<Tile>(
    Array.from({ length: 9 }, (_, index) => {
        const locked = index === 5;
        const selectable = index !== 8;
        const id = `tile-${index + 1}`;
        return {
            id,
            x: 1 + (index % 3) * 3,
            y: 1 + Math.floor(index / 3) * 2,
            width: 1.6,
            height: 1.2,
            radius: 0.16,
            origin: { mode: "self", x: 0.5, y: 0.5 },
            style: {
                fillStyle: locked ? "#d99a38" : selectable ? "#5675d7" : "#b2bdce",
                strokeStyle: "#ffffff",
                lineWidthPx: 2,
            },
            data: {
                id,
                label: locked ? "Locked" : selectable ? `Tile ${index + 1}` : "Decoration",
                locked,
                selectable,
            },
        };
    }),
    { keyOf: (item) => item.id },
);

const engine = new CanvasTileEngine(
    wrapper,
    {
        size: { width: wrapper.clientWidth, height: wrapper.clientHeight },
        scale: Math.min(56, wrapper.clientWidth / 10),
        minScale: 20,
        maxScale: 140,
        backgroundColor: "#f5f8fd",
        responsive: "preserve-scale",
        eventHandlers: { drag: true, zoom: true, click: true },
    },
    new RendererCanvas(),
    { x: 4.5, y: 3.5 },
);

engine.drawGridLines(1, 1, "#e2e9f3", 0);
const handle = engine.drawRect(tiles, 1, {
    styleOf: (item) =>
        selection.selectedIds.includes(item.data!.id) ? { strokeStyle: "#142c71", lineWidthPx: 3 } : undefined,
});
const selection: SelectionController<Tile> = new SelectionController(engine, {
    adapter: createItemCollectionSelectionAdapter(tiles, { handle }),
    grid: 1,
    selectable: (item) => item.data.selectable,
    locked: (item) => item.data.locked,
    onTransformStart: ({ ids }) => {
        operationStatus.textContent = `Moving ${ids.length} tile${ids.length === 1 ? "" : "s"}...`;
    },
    onTransformEnd: ({ ids, cancelled }) => {
        operationStatus.textContent = cancelled
            ? "Move cancelled; original positions restored"
            : `Moved ${ids.length} tile${ids.length === 1 ? "" : "s"}`;
    },
});

// Labels and the marquee are presentation only. The controller owns no draws.
engine.addDrawFunction((context, _coords, _config, transform) => {
    const ctx = context as CanvasRenderingContext2D;
    ctx.font = "600 12px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#ffffff";
    for (const item of tiles.items) {
        const point = transform.worldToScreen(item.x, item.y);
        ctx.fillText(item.data.label, point.x, point.y, (item.width ?? 1) * engine.getScale() - 10);
    }

    const marquee = selection.getSnapshot().marquee;
    if (marquee) {
        // Marquee/hit-test bounds use raw pointer coordinates, half a cell
        // beyond the item coordinates accepted by worldToScreen.
        const start = transform.worldToScreen(marquee.minX - 0.5, marquee.minY - 0.5);
        const end = transform.worldToScreen(marquee.maxX - 0.5, marquee.maxY - 0.5);
        ctx.fillStyle = "#3455b51c";
        ctx.strokeStyle = "#3455b5";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 4]);
        ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
        ctx.setLineDash([]);
    }
}, 2);

function updateInspector() {
    count.textContent = `${selection.selectedIds.length} selected`;
    clearButton.disabled = selection.selectedIds.length === 0;
    list.replaceChildren();
    for (const id of selection.selectedIds) {
        const item = tiles.get(id);
        if (!item) continue;
        const row = document.createElement("li");
        const label = document.createElement("strong");
        const position = document.createElement("span");
        label.textContent = item.data.label;
        position.textContent = `${item.x}, ${item.y}`;
        row.dataset.itemId = item.id;
        row.append(label, position);
        list.append(row);
    }
}

function activateSelection(active: boolean) {
    engine.setTool(active ? selection : null);
    selectButton.setAttribute("aria-pressed", String(active));
    panButton.setAttribute("aria-pressed", String(!active));
    toolStatus.textContent = active ? "Select & move active" : "Pan active";
    wrapper.style.cursor = active ? "default" : "grab";
}

selectButton.addEventListener("click", () => activateSelection(true));
panButton.addEventListener("click", () => activateSelection(false));
clearButton.addEventListener("click", () => selection.clearSelection());
const stopSelection = selection.subscribe(updateInspector);
const stopItems = tiles.subscribe(updateInspector);
activateSelection(true);
updateInspector();
engine.render();

window.addEventListener(
    "pagehide",
    () => {
        stopSelection();
        stopItems();
        selection.dispose();
        engine.destroy();
    },
    { once: true },
);
