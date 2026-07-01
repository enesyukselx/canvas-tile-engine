import { CanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/core";
import { RendererServer, SERVER_MOUNT, type Image, type SKRSContext2D } from "@canvas-tile-engine/renderer-server";
import { faker } from "@faker-js/faker";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { generateMapObjects } from "./generateMapObjects";

// Deterministic-ish output: seed the faker RNG used for names.
faker.seed(42);

const INITIAL_COORDS = { x: 200, y: 200 };
// Render @2x for crisp output. Logical size stays 500/300; PNGs are 2x that.
const PIXEL_RATIO = 2;

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "output");

// Main map configuration (same as the browser example; event handlers are
// ignored on the server since there is no interaction).
const mainMapOptions: CanvasTileEngineConfig = {
    scale: 50,
    minScale: 40,
    maxScale: 60,
    size: { width: 500, height: 500, maxHeight: 800, maxWidth: 800, minHeight: 200, minWidth: 200 },
    backgroundColor: "#337426ff",
    coordinates: {
        enabled: true,
        shownScaleRange: { min: 40, max: 60 },
    },
    bounds: { minX: 0, maxX: 500, minY: 0, maxY: 500 },
};

// Mini map configuration
const miniMapOptions: CanvasTileEngineConfig = {
    scale: 6,
    size: { width: 300, height: 300, maxWidth: 700, maxHeight: 700, minWidth: 100, minHeight: 100 },
    backgroundColor: "#337426ff",
};

// Build the two headless engines.
const mainRenderer = new RendererServer({ pixelRatio: PIXEL_RATIO });
const mainMap = new CanvasTileEngine(SERVER_MOUNT, mainMapOptions, mainRenderer, INITIAL_COORDS);

const miniRenderer = new RendererServer({ pixelRatio: PIXEL_RATIO });
const miniMap = new CanvasTileEngine(SERVER_MOUNT, miniMapOptions, miniRenderer, INITIAL_COORDS);

// Mini map bounds so its CENTER can move within the main map's center range.
const calculateMiniMapBounds = () => {
    const mainBounds = mainMapOptions.bounds!;
    const mainCfg = mainMap.getConfig();
    const miniCfg = miniMap.getConfig();

    const mainViewWidth = mainCfg.size.width / mainCfg.scale;
    const mainViewHeight = mainCfg.size.height / mainCfg.scale;

    const mainCenterMinX = mainBounds.minX + mainViewWidth / 2;
    const mainCenterMaxX = mainBounds.maxX - mainViewWidth / 2;
    const mainCenterMinY = mainBounds.minY + mainViewHeight / 2;
    const mainCenterMaxY = mainBounds.maxY - mainViewHeight / 2;

    const miniViewWidth = miniCfg.size.width / miniCfg.scale;
    const miniViewHeight = miniCfg.size.height / miniCfg.scale;

    return {
        minX: mainCenterMinX - miniViewWidth / 2,
        maxX: mainCenterMaxX + miniViewWidth / 2,
        minY: mainCenterMinY - miniViewHeight / 2,
        maxY: mainCenterMaxY + miniViewHeight / 2,
    };
};

async function main() {
    const t0 = Date.now();

    // Generate the map objects (villages, barbarian camps, terrain).
    const items = generateMapObjects(10000, INITIAL_COORDS.x, INITIAL_COORDS.y, 1.2);
    console.log(`Generated ${items.length} map objects`);

    // Preload unique images only (not once per object). Images are loaded from
    // disk via @napi-rs/canvas — .webp is decoded natively.
    const uniqueUrls = [...new Set(items.map((i) => i.imageUrl))];
    const imageCache = new Map<string, Image>();
    await Promise.all(
        uniqueUrls.map(async (url) => {
            imageCache.set(url, await mainMap.images.load(url));
        }),
    );
    console.log(`Loaded ${uniqueUrls.length} unique images`);

    // Build draw arrays in a single pass.
    const imageItems: Array<{ img: Image; x: number; y: number; size: number }> = [];
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

    // ─── Main map ───────────────────────────────────────────
    mainMap.drawImage(imageItems);
    mainMap.drawCircle(circleItems, 1);
    mainMap.drawGridLines(5);
    mainMap.drawGridLines(50, 4);

    // Custom draw: a red marker at the viewport center (layer 3, on top).
    mainMap.addDrawFunction((ctx) => {
        const context = ctx as SKRSContext2D;
        const centerX = mainMap.getConfig().size.width / 2;
        const centerY = mainMap.getConfig().size.height / 2;
        context.fillStyle = "red";
        context.fillRect(centerX - 5, centerY - 5, 10, 10);
    }, 3);

    mainMap.render();

    // ─── Mini map ───────────────────────────────────────────
    miniMap.setBounds(calculateMiniMapBounds());

    // Static cache: pre-render all rects once, then blit (huge win for 10k items).
    miniMap.drawStaticRect(miniMapRects, "minimap-items");
    miniMap.drawGridLines(1, 0.5, "rgba(0,0,0,1)", 3);
    miniMap.drawGridLines(5, 0.8, "rgba(0,0,0,1)", 3);
    miniMap.drawGridLines(50, 2, "rgba(0,0,0,1)", 3);

    // Custom draw: the main map's viewport rectangle, always centered.
    miniMap.onDraw = (ctx) => {
        const context = ctx as SKRSContext2D;
        const mainCfg = mainMap.getConfig();
        const miniCfg = miniMap.getConfig();
        const ratio = miniCfg.scale / mainCfg.scale;
        const rectWidth = mainCfg.size.width * ratio;
        const rectHeight = mainCfg.size.height * ratio;
        const rectX = miniCfg.size.width / 2 - rectWidth / 2;
        const rectY = miniCfg.size.height / 2 - rectHeight / 2;
        context.strokeStyle = "white";
        context.lineWidth = 2;
        context.strokeRect(rectX, rectY, rectWidth, rectHeight);
    };

    miniMap.render();

    // ─── Encode + write PNGs ────────────────────────────────
    await mkdir(OUTPUT_DIR, { recursive: true });
    const [mainPng, miniPng] = await Promise.all([mainRenderer.encode("png"), miniRenderer.encode("png")]);
    await Promise.all([
        writeFile(join(OUTPUT_DIR, "main-map.png"), mainPng),
        writeFile(join(OUTPUT_DIR, "mini-map.png"), miniPng),
    ]);

    mainMap.destroy();
    miniMap.destroy();

    console.log(`Wrote output/main-map.png (${mainPng.length} bytes) and output/mini-map.png (${miniPng.length} bytes)`);
    console.log(`Done in ${Date.now() - t0}ms`);
}

void main();
