import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
    CanvasTileEngine,
    useCanvasTileEngine,
    type CanvasTileEngineConfig,
    type ImageItem,
} from "@canvas-tile-engine/react";
import { VillagePopup } from "./components/VillagePopup";
import { generateMapObjects, type MapObject } from "./generateMapObjects";
import { INITIAL_COORDS, INITIAL_MAIN_MAP_SIZE, INITIAL_MINI_MAP_SIZE } from "./constants";

// Main map configuration
const mainMapConfig: CanvasTileEngineConfig = {
    scale: 50,
    minScale: 40,
    maxScale: 60,
    size: {
        width: INITIAL_MAIN_MAP_SIZE,
        height: INITIAL_MAIN_MAP_SIZE,
        maxHeight: 800,
        maxWidth: 800,
        minHeight: 200,
        minWidth: 200,
    },
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
const miniMapConfig: CanvasTileEngineConfig = {
    scale: 6,
    size: {
        width: INITIAL_MINI_MAP_SIZE,
        height: INITIAL_MINI_MAP_SIZE,
        maxWidth: 700,
        maxHeight: 700,
        minWidth: 100,
        minHeight: 100,
    },
    backgroundColor: "#337426ff",
    eventHandlers: {
        drag: true,
        resize: true,
    },
};

export default function App() {
    // Engine handles
    const mainMap = useCanvasTileEngine();
    const miniMap = useCanvasTileEngine();

    // State
    const [inputX, setInputX] = useState(INITIAL_COORDS.x.toString());
    const [inputY, setInputY] = useState(INITIAL_COORDS.y.toString());
    const [mainMapSize, setMainMapSize] = useState(INITIAL_MAIN_MAP_SIZE.toString());
    const [miniMapSize, setMiniMapSize] = useState(INITIAL_MINI_MAP_SIZE.toString());

    // Image loading state
    const [imageItems, setImageItems] = useState<ImageItem[]>([]);
    const [circleItems, setCircleItems] = useState<
        Array<{
            x: number;
            y: number;
            size: number;
            origin: { mode: "cell"; x: number; y: number };
            style: { fillStyle: string };
        }>
    >([]);
    const [miniMapRects, setMiniMapRects] = useState<
        Array<{ x: number; y: number; size: number; style: { fillStyle: string } }>
    >([]);

    // Popup state
    const [popupItem, setPopupItem] = useState<MapObject | null>(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const [popupVisible, setPopupVisible] = useState(false);

    // Sync flag ref
    const isSyncingRef = useRef(false);

    // Generate map objects (memoized)
    const items = useMemo(() => generateMapObjects(10000, INITIAL_COORDS.x, INITIAL_COORDS.y, 1.2), []);

    // Create coordinate-based Map for O(1) lookups
    const itemsByCoord = useMemo(() => {
        const map = new Map<string, MapObject>();
        for (const item of items) {
            if (item.type !== "terrain") {
                map.set(`${item.x},${item.y}`, item);
            }
        }
        return map;
    }, [items]);

    // Calculate mini map bounds
    const calculateMiniMapBounds = useCallback(() => {
        const mainCfg = mainMap.getConfig();
        const miniCfg = miniMap.getConfig();
        if (!mainCfg || !miniCfg) return null;

        const mainBounds = mainMapConfig.bounds!;

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
    }, [mainMap, miniMap]);

    // Load images and prepare draw data
    useEffect(() => {
        if (!mainMap.isReady || !miniMap.isReady) return;

        const loadImages = async () => {
            // Preload unique images
            const uniqueUrls = [...new Set(items.map((i) => i.imageUrl))];
            const imageCache = new Map<string, HTMLImageElement>();

            await Promise.all(
                uniqueUrls.map(async (url) => {
                    imageCache.set(url, await mainMap.instance!.images.load(url));
                })
            );

            // Build arrays
            const newImageItems: ImageItem[] = [];
            const newMiniMapRects: Array<{ x: number; y: number; size: number; style: { fillStyle: string } }> = [];
            const newCircleItems: Array<{
                x: number;
                y: number;
                size: number;
                origin: { mode: "cell"; x: number; y: number };
                style: { fillStyle: string };
            }> = [];

            for (const item of items) {
                const img = imageCache.get(item.imageUrl)!;

                newImageItems.push({ img, x: item.x, y: item.y, size: 1 });
                newMiniMapRects.push({ x: item.x, y: item.y, size: 0.9, style: { fillStyle: item.color } });

                if (item.type !== "terrain") {
                    newCircleItems.push({
                        x: item.x,
                        y: item.y,
                        size: 0.1,
                        origin: { mode: "cell", x: 0.1, y: 0.1 },
                        style: { fillStyle: item.color },
                    });
                }
            }

            setImageItems(newImageItems);
            setMiniMapRects(newMiniMapRects);
            setCircleItems(newCircleItems);
        };

        void loadImages();
    }, [mainMap.isReady, miniMap.isReady, mainMap.instance, items]);

    // Handle main map coords change
    const handleMainMapCoordsChange = useCallback(
        (coords: { x: number; y: number }) => {
            const bounds = calculateMiniMapBounds();
            if (bounds) {
                miniMap.setBounds(bounds);
            }

            if (isSyncingRef.current) return;

            setPopupVisible(false);
            setInputX(Math.round(coords.x).toString());
            setInputY(Math.round(coords.y).toString());

            isSyncingRef.current = true;
            miniMap.updateCoords(coords);
            miniMap.render();
            isSyncingRef.current = false;
        },
        [miniMap, calculateMiniMapBounds]
    );

    // Handle mini map coords change
    const handleMiniMapCoordsChange = useCallback(
        (coords: { x: number; y: number }) => {
            if (isSyncingRef.current) return;

            isSyncingRef.current = true;
            setInputX(Math.round(coords.x).toString());
            setInputY(Math.round(coords.y).toString());
            mainMap.updateCoords(coords);
            mainMap.render();
            isSyncingRef.current = false;
        },
        [mainMap]
    );

    // Handle mini map draw (viewport rectangle)
    const handleMiniMapDraw = useCallback(
        (ctx: CanvasRenderingContext2D) => {
            const mainCfg = mainMap.getConfig();
            const miniCfg = miniMap.getConfig();
            if (!mainCfg || !miniCfg) return;

            const ratio = miniCfg.scale / mainCfg.scale;
            const rectWidth = mainCfg.size.width * ratio;
            const rectHeight = mainCfg.size.height * ratio;
            const rectX = miniCfg.size.width / 2 - rectWidth / 2;
            const rectY = miniCfg.size.height / 2 - rectHeight / 2;

            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;
            ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        },
        [mainMap, miniMap]
    );

    // Handle hover
    const handleHover = useCallback(
        (
            coords: { raw: { x: number; y: number }; snapped: { x: number; y: number } },
            _mouse: unknown,
            client: { raw: { x: number; y: number }; snapped: { x: number; y: number } }
        ) => {
            const item = itemsByCoord.get(`${coords.snapped.x},${coords.snapped.y}`);

            if (item) {
                const cfg = mainMap.getConfig();
                setPopupItem(item);
                setPopupPosition({
                    x: client.snapped.x,
                    y: client.snapped.y + (cfg?.scale ?? 50) / 2,
                });
                setPopupVisible(true);
            } else {
                setPopupVisible(false);
            }
        },
        [itemsByCoord, mainMap]
    );

    // Handle click
    const handleClick = useCallback(
        (coords: { raw: { x: number; y: number }; snapped: { x: number; y: number } }) => {
            const item = itemsByCoord.get(`${coords.snapped.x},${coords.snapped.y}`);

            if (item) {
                alert(
                    `Village: ${item.villageName}\nPlayer: ${item.playerName}\nType: ${item.type}\nCoordinates: ${item.x} | ${item.y}`
                );
            }
        },
        [itemsByCoord]
    );

    // Handle mouse leave
    const handleMouseLeave = useCallback(() => {
        setPopupVisible(false);
    }, []);

    // Handle go to coordinates
    const handleGoToCoords = () => {
        const x = Number(inputX);
        const y = Number(inputY);
        if (Number.isNaN(x) || Number.isNaN(y)) {
            alert("Please enter valid numbers for X and Y.");
            return;
        }
        mainMap.goCoords(x, y, 500);
    };

    // Handle mini map resize
    const handleMiniMapSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = Number(e.target.value);
        setMiniMapSize(e.target.value);
        miniMap.resize(newSize, newSize, 300);

        setTimeout(() => {
            const bounds = calculateMiniMapBounds();
            if (bounds) {
                miniMap.setBounds(bounds);
            }
            miniMap.render();
        }, 350);
    };

    // Handle main map resize
    const handleMainMapSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = Number(e.target.value);
        setMainMapSize(e.target.value);
        mainMap.resize(newSize, newSize, 300);
    };

    return (
        <div className="flex flex-wrap justify-center gap-4 p-4">
            {/* Main Map */}
            <div>
                <CanvasTileEngine
                    engine={mainMap}
                    config={mainMapConfig}
                    center={INITIAL_COORDS}
                    className="rounded-lg"
                    onCoordsChange={handleMainMapCoordsChange}
                    onHover={handleHover}
                    onClick={handleClick}
                    onMouseLeave={handleMouseLeave}
                >
                    <CanvasTileEngine.Image items={imageItems} layer={0} />
                    <CanvasTileEngine.Circle items={circleItems} layer={1} />
                    <CanvasTileEngine.GridLines cellSize={5} layer={2} />
                    <CanvasTileEngine.GridLines cellSize={50} lineWidth={4} layer={2} />
                    <CanvasTileEngine.DrawFunction layer={3}>
                        {(ctx) => {
                            const cfg = mainMap.getConfig();
                            if (!cfg) return;
                            const centerX = cfg.size.width / 2;
                            const centerY = cfg.size.height / 2;
                            ctx.fillStyle = "red";
                            ctx.fillRect(centerX - 5, centerY - 5, 5, 5);
                        }}
                    </CanvasTileEngine.DrawFunction>
                </CanvasTileEngine>

                <div className="flex flex-wrap gap-2 mt-2 items-center">
                    <div>
                        <label className="text-white font-semibold" htmlFor="x">
                            X
                        </label>
                        <input
                            className="bg-white w-16 rounded-lg px-2 font-semibold ml-1"
                            id="x"
                            type="number"
                            value={inputX}
                            onChange={(e) => setInputX(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-white font-semibold" htmlFor="y">
                            Y
                        </label>
                        <input
                            className="bg-white w-16 rounded-lg px-2 font-semibold ml-1"
                            id="y"
                            type="number"
                            value={inputY}
                            onChange={(e) => setInputY(e.target.value)}
                        />
                    </div>
                    <div>
                        <button
                            onClick={handleGoToCoords}
                            className="cursor-pointer bg-zinc-600 hover:bg-zinc-700 text-white font-semibold px-2 py-1 rounded-lg"
                        >
                            Go
                        </button>
                    </div>
                </div>
            </div>

            {/* Mini Map */}
            <div>
                <CanvasTileEngine
                    engine={miniMap}
                    config={miniMapConfig}
                    center={INITIAL_COORDS}
                    className="rounded-lg"
                    onCoordsChange={handleMiniMapCoordsChange}
                    onDraw={handleMiniMapDraw}
                >
                    <CanvasTileEngine.StaticRect items={miniMapRects} cacheKey="minimap-items" layer={0} />
                    <CanvasTileEngine.GridLines cellSize={1} lineWidth={0.5} strokeStyle="rgba(0,0,0,1)" layer={3} />
                    <CanvasTileEngine.GridLines cellSize={5} lineWidth={0.8} strokeStyle="rgba(0,0,0,1)" layer={3} />
                    <CanvasTileEngine.GridLines cellSize={50} lineWidth={2} strokeStyle="rgba(0,0,0,1)" layer={3} />
                </CanvasTileEngine>

                <div className="mt-4">
                    <label htmlFor="minimap-size-select" className="text-white font-semibold">
                        Mini Size
                    </label>
                    <select
                        id="minimap-size-select"
                        className="ml-3 bg-white rounded p-1"
                        value={miniMapSize}
                        onChange={handleMiniMapSizeChange}
                    >
                        <option value="100">100x100</option>
                        <option value="200">200x200</option>
                        <option value="300">300x300</option>
                        <option value="400">400x400</option>
                        <option value="500">500x500</option>
                    </select>
                </div>

                <div className="mt-4">
                    <label htmlFor="mainmap-size-select" className="text-white font-semibold">
                        Main Size
                    </label>
                    <select
                        id="mainmap-size-select"
                        className="ml-2 bg-white rounded p-1"
                        value={mainMapSize}
                        onChange={handleMainMapSizeChange}
                    >
                        <option value="300">300x300</option>
                        <option value="400">400x400</option>
                        <option value="500">500x500</option>
                        <option value="600">600x600</option>
                        <option value="700">700x700</option>
                        <option value="800">800x800</option>
                    </select>
                </div>
            </div>

            {/* Village Popup */}
            <VillagePopup item={popupItem} position={popupPosition} visible={popupVisible} />

            {/* Loading Indicator */}
            {imageItems.length === 0 && (
                <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
                    <div className="text-white text-2xl font-semibold">Loading map...</div>
                </div>
            )}
        </div>
    );
}
