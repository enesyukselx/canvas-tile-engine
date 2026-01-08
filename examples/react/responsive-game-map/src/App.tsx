import { useState, useEffect, useMemo } from "react";
import {
    CanvasTileEngine,
    Circle,
    ImageItem,
    useCanvasTileEngine,
    CanvasTileEngineConfig,
    Rect,
} from "@canvas-tile-engine/react";
import { INITIAL_COORDS, MAP_BACKGROUND_COLOR } from "./constants";
import { generateMapObjects, type MapObject } from "./generateMapObjects";
import { VillageModal } from "./components/VillageModal";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

const MINI_MAP_SCALE_THRESHOLD = 25;

const mapConfig: CanvasTileEngineConfig = {
    scale: 50,
    minScale: 5,
    maxScale: 60,
    size: {
        width: window.innerWidth,
        height: window.innerHeight,
    },
    responsive: "preserve-scale",
    backgroundColor: MAP_BACKGROUND_COLOR,
    eventHandlers: {
        hover: true,
        zoom: true,
        drag: true,
        click: true,
    },
    coordinates: {
        enabled: true,
        shownScaleRange: { min: 30, max: 80 },
    },
    bounds: {
        minX: 0,
        maxX: 500,
        minY: 0,
        maxY: 500,
    },
};

export default function App() {
    // Engine handles
    const map = useCanvasTileEngine();
    const [scale, setScale] = useState(mapConfig.scale);

    // Image loading state
    const [imageItems, setImageItems] = useState<ImageItem[]>([]);
    const [circleItems, setCircleItems] = useState<Array<Circle>>([]);
    const [rectItems, setRectItems] = useState<Array<Rect>>([]);

    // Modal state
    const [modalItem, setModalItem] = useState<MapObject | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

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
        if (!map.isReady) return;

        const loadItems = async () => {
            // Preload unique images
            const uniqueUrls = [...new Set(items.map((i) => i.imageUrl))];
            const imageCache = new Map<string, HTMLImageElement>();

            await Promise.all(
                uniqueUrls.map(async (url) => {
                    imageCache.set(url, await map.loadImage(url));
                })
            );

            // Build arrays
            const newImageItems: ImageItem[] = [];
            const newCircleItems: Array<Circle> = [];
            const newRectItems: Array<Rect> = [];

            for (const item of items) {
                const img = imageCache.get(item.imageUrl)!;

                newImageItems.push({ img, x: item.x, y: item.y, size: 1 });

                if (item.type !== "terrain") {
                    newCircleItems.push({
                        x: item.x,
                        y: item.y,
                        size: 0.1,
                        origin: { mode: "cell", x: 0.1, y: 0.1 },
                        style: { fillStyle: item.color },
                    });
                }

                newRectItems.push({ x: item.x, y: item.y, size: 0.7, style: { fillStyle: item.color } });
            }

            setImageItems(newImageItems);
            setCircleItems(newCircleItems);
            setRectItems(newRectItems);
        };

        void loadItems();
    }, [map, map.isReady, map.instance, items, map.images]);

    // Handle click
    const handleClick = (coords: { raw: { x: number; y: number }; snapped: { x: number; y: number } }) => {
        const item = itemsByCoord.get(`${coords.snapped.x},${coords.snapped.y}`);

        if (item) {
            setModalItem(item);
            setModalVisible(true);
        }
    };

    return (
        <>
            {/* Main Map */}
            <div>
                <CanvasTileEngine
                    engine={map}
                    renderer={new RendererCanvas()}
                    config={mapConfig}
                    center={INITIAL_COORDS}
                    onHover={(coords) => {
                        if (scale < MINI_MAP_SCALE_THRESHOLD) {
                            window.document.body.style.cursor = "move";
                            return;
                        }
                        const item = itemsByCoord.get(`${coords.snapped.x},${coords.snapped.y}`);
                        if (item) {
                            window.document.body.style.cursor = "pointer";
                        } else {
                            window.document.body.style.cursor = "move";
                        }
                    }}
                    onClick={(coords) => {
                        if (scale < MINI_MAP_SCALE_THRESHOLD) {
                            map.setScale(50);
                            map.updateCoords({ x: coords.snapped.x, y: coords.snapped.y });
                            setScale(50);
                        } else {
                            window.document.body.style.cursor = "default";
                            handleClick(coords);
                        }
                    }}
                    onZoom={(newScale) => setScale(newScale)}
                >
                    <CanvasTileEngine.Image items={scale < MINI_MAP_SCALE_THRESHOLD ? [] : imageItems} layer={0} />
                    <CanvasTileEngine.Circle items={scale < MINI_MAP_SCALE_THRESHOLD ? [] : circleItems} layer={1} />
                    <CanvasTileEngine.Rect items={scale > MINI_MAP_SCALE_THRESHOLD ? [] : rectItems} layer={1} />
                    <CanvasTileEngine.GridLines cellSize={5} layer={2} />
                    <CanvasTileEngine.GridLines
                        cellSize={50}
                        lineWidth={MINI_MAP_SCALE_THRESHOLD > scale ? 2 : 4}
                        layer={2}
                    />
                    <CanvasTileEngine.DrawFunction layer={3}>
                        {(ctx) => {
                            const context = ctx as CanvasRenderingContext2D;
                            const cfg = map.getConfig();
                            const centerX = cfg.size.width / 2;
                            const centerY = cfg.size.height / 2;
                            context.fillStyle = "red";
                            context.fillRect(centerX - 5, centerY - 5, 5, 5);
                        }}
                    </CanvasTileEngine.DrawFunction>
                </CanvasTileEngine>
            </div>

            {/* Village Modal */}
            <VillageModal item={modalItem} visible={modalVisible} onClose={() => setModalVisible(false)} />
        </>
    );
}
