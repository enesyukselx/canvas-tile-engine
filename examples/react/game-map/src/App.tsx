import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import {
    CanvasTileEngine,
    Circle,
    Rect,
    ImageItem,
    useCanvasTileEngine,
    CanvasTileEngineConfig,
} from "@canvas-tile-engine/react";
import { VillagePopup } from "./components/VillagePopup";
import { VillageModal } from "./components/VillageModal";
import { CoordinateInput } from "./components/CoordinateInput";
import { MapSizeSelect } from "./components/MapSizeSelect";
import { MapPlaceholder } from "./components/MapPlaceholder";
import { generateMapObjects, type MapObject } from "./generateMapObjects";
import { INITIAL_COORDS, MINI_MAP_SIZE_OPTIONS, MAIN_MAP_SIZE_OPTIONS, MAP_BACKGROUND_COLOR } from "./constants";
import calculateMiniMapBounds from "./utils/calculateMiniMapBounds";
import miniMapViewportRectangleDraw from "./utils/miniMapViewportRectangleDraw";

const mainMapConfig: CanvasTileEngineConfig = {
    scale: 50,
    minScale: 40,
    maxScale: 60,
    size: {
        width: 500,
        height: 500,
        maxHeight: 800,
        maxWidth: 800,
        minHeight: 200,
        minWidth: 200,
    },
    backgroundColor: MAP_BACKGROUND_COLOR,
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

const miniMapConfig: CanvasTileEngineConfig = {
    scale: 6,
    size: {
        width: 300,
        height: 300,
        maxWidth: 700,
        maxHeight: 700,
        minWidth: 100,
        minHeight: 100,
    },
    backgroundColor: MAP_BACKGROUND_COLOR,
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
    const [mainMapSize, setMainMapSize] = useState(mainMapConfig.size.width.toString());
    const [miniMapSize, setMiniMapSize] = useState(miniMapConfig.size.width.toString());

    // Image loading state
    const [imageItems, setImageItems] = useState<ImageItem[]>([]);
    const [circleItems, setCircleItems] = useState<Array<Circle>>([]);
    const [miniMapRects, setMiniMapRects] = useState<Array<Rect>>([]);

    // Popup state
    const [popupItem, setPopupItem] = useState<MapObject | null>(null);
    const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
    const [popupVisible, setPopupVisible] = useState(false);

    // Modal state
    const [modalItem, setModalItem] = useState<MapObject | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Navigation state
    // If true, the main map will be animated to the clicked position
    const [isNavigating, setIsNavigating] = useState(false);

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

    // Load images and prepare draw data
    useEffect(() => {
        if (!mainMap.isReady || !miniMap.isReady) return;

        const loadItems = async () => {
            // Preload unique images
            const uniqueUrls = [...new Set(items.map((i) => i.imageUrl))];
            const imageCache = new Map<string, HTMLImageElement>();

            await Promise.all(
                uniqueUrls.map(async (url) => {
                    imageCache.set(url, await mainMap.loadImage(url));
                })
            );

            // Build arrays
            const newImageItems: ImageItem[] = [];
            const newMiniMapRects: Array<Rect> = [];
            const newCircleItems: Array<Circle> = [];

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

        void loadItems();
    }, [mainMap.isReady, miniMap.isReady, mainMap.instance, items, mainMap.images]);

    // Recalculate mini map bounds - used for initial setup, resize, and zoom
    const recalculateMiniMapBounds = useCallback(() => {
        miniMap.setBounds(
            calculateMiniMapBounds(mainMap.getConfig(), miniMap.getConfig()) ?? {
                minX: -Infinity,
                maxX: Infinity,
                minY: -Infinity,
                maxY: Infinity,
            }
        );
    }, [mainMap, miniMap]);

    // Initial bounds calculation
    useEffect(() => {
        recalculateMiniMapBounds();
    }, [recalculateMiniMapBounds, mainMap.isReady, miniMap.isReady]);

    // Handle main map coords change
    const handleMainMapCoordsChange = (coords: { x: number; y: number }) => {
        if (isSyncingRef.current) return;

        setPopupVisible(false);
        setInputX(Math.round(coords.x).toString());
        setInputY(Math.round(coords.y).toString());

        isSyncingRef.current = true;
        miniMap.updateCoords(coords);
        isSyncingRef.current = false;
    };

    // Handle mini map coords change
    const handleMiniMapCoordsChange = (coords: { x: number; y: number }) => {
        if (isSyncingRef.current) return;

        isSyncingRef.current = true;
        setInputX(Math.round(coords.x).toString());
        setInputY(Math.round(coords.y).toString());
        mainMap.updateCoords(coords);
        isSyncingRef.current = false;
    };

    // Handle hover
    const handleHover = (
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
                y: client.snapped.y + cfg.scale / 2,
            });
            setPopupVisible(true);
        } else {
            setPopupVisible(false);
        }
    };

    // Handle click
    const handleClick = (coords: { raw: { x: number; y: number }; snapped: { x: number; y: number } }) => {
        const item = itemsByCoord.get(`${coords.snapped.x},${coords.snapped.y}`);

        if (item) {
            setModalItem(item);
            setModalVisible(true);
            setPopupVisible(false);
        }
    };

    // Handle go to coordinates
    const handleGoToCoords = () => {
        const x = Number(inputX);
        const y = Number(inputY);
        if (Number.isNaN(x) || Number.isNaN(y)) {
            alert("Please enter valid numbers for X and Y.");
            return;
        }
        setIsNavigating(true);
        mainMap.goCoords(x, y, 500, () => {
            setIsNavigating(false);
        });
    };

    // Handle mini map resize
    const handleMiniMapSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = Number(e.target.value);
        setMiniMapSize(e.target.value);
        miniMap.resize(newSize, newSize, 300);
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
            <div className="relative">
                <CanvasTileEngine
                    engine={mainMap}
                    config={mainMapConfig}
                    center={INITIAL_COORDS}
                    onCoordsChange={handleMainMapCoordsChange}
                    onResize={recalculateMiniMapBounds}
                    onZoom={recalculateMiniMapBounds}
                    onHover={handleHover}
                    onClick={handleClick}
                    onMouseLeave={() => setPopupVisible(false)}
                >
                    <CanvasTileEngine.Image items={imageItems} layer={0} />
                    <CanvasTileEngine.Circle items={circleItems} layer={1} />
                    <CanvasTileEngine.GridLines cellSize={5} layer={2} />
                    <CanvasTileEngine.GridLines cellSize={50} lineWidth={4} layer={2} />
                    <CanvasTileEngine.DrawFunction layer={3}>
                        {(ctx) => {
                            const cfg = mainMap.getConfig();
                            const centerX = cfg.size.width / 2;
                            const centerY = cfg.size.height / 2;
                            ctx.fillStyle = "red";
                            ctx.fillRect(centerX - 5, centerY - 5, 5, 5);
                        }}
                    </CanvasTileEngine.DrawFunction>
                </CanvasTileEngine>

                {/* Loading overlay */}
                {!mainMap.isReady && (
                    <div className="absolute inset-0">
                        <MapPlaceholder
                            width={mainMapConfig.size.width}
                            height={mainMapConfig.size.height}
                            label="Loading Main Map..."
                        />
                    </div>
                )}

                <CoordinateInput
                    inputX={inputX}
                    inputY={inputY}
                    onInputXChange={setInputX}
                    onInputYChange={setInputY}
                    onGoClick={handleGoToCoords}
                    disabled={isNavigating}
                />
            </div>

            {/* Mini Map */}
            <div className="relative">
                <CanvasTileEngine
                    engine={miniMap}
                    config={miniMapConfig}
                    center={INITIAL_COORDS}
                    onCoordsChange={handleMiniMapCoordsChange}
                    onResize={recalculateMiniMapBounds}
                    onDraw={(ctx) => miniMapViewportRectangleDraw(mainMap.getConfig(), miniMap.getConfig(), ctx)}
                >
                    <CanvasTileEngine.StaticRect items={miniMapRects} cacheKey="minimap-items" layer={0} />
                    <CanvasTileEngine.GridLines cellSize={1} lineWidth={0.5} strokeStyle="rgba(0,0,0,1)" layer={3} />
                    <CanvasTileEngine.GridLines cellSize={5} lineWidth={0.8} strokeStyle="rgba(0,0,0,1)" layer={3} />
                    <CanvasTileEngine.GridLines cellSize={50} lineWidth={2} strokeStyle="rgba(0,0,0,1)" layer={3} />
                </CanvasTileEngine>

                {/* Loading overlay */}
                {!miniMap.isReady && (
                    <div className="absolute inset-0">
                        <MapPlaceholder
                            width={miniMapConfig.size.width}
                            height={miniMapConfig.size.height}
                            label="Loading Mini Map..."
                        />
                    </div>
                )}

                <MapSizeSelect
                    id="minimap-size-select"
                    label="Mini Size"
                    value={miniMapSize}
                    options={MINI_MAP_SIZE_OPTIONS}
                    onChange={handleMiniMapSizeChange}
                />

                <MapSizeSelect
                    id="mainmap-size-select"
                    label="Main Size"
                    value={mainMapSize}
                    options={MAIN_MAP_SIZE_OPTIONS}
                    onChange={handleMainMapSizeChange}
                />
            </div>

            {/* Village Popup */}
            <VillagePopup item={popupItem} position={popupPosition} visible={popupVisible} />

            {/* Village Modal */}
            <VillageModal item={modalItem} visible={modalVisible} onClose={() => setModalVisible(false)} />
        </div>
    );
}
