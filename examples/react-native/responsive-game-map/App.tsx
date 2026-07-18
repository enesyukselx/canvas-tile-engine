import { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { Asset } from "expo-asset";
import {
    CanvasTileEngine,
    useCanvasTileEngine,
    Skia,
    type CanvasTileEngineConfig,
    type Circle,
    type Rect,
    type SkiaImageItem,
    type SkImage,
} from "@canvas-tile-engine/react-native";
import { RendererSkia } from "@canvas-tile-engine/renderer-skia";
import { INITIAL_COORDS, MAP_BACKGROUND_COLOR } from "./src/constants";
import { generateMapObjects, type MapObject } from "./src/generateMapObjects";
import { VillageModal } from "./src/components/VillageModal";

const MINI_MAP_SCALE_THRESHOLD = 25;

const mapConfig: CanvasTileEngineConfig = {
    scale: 50,
    minScale: 5,
    maxScale: 60,
    // Overridden by the component's measured layout size.
    size: { width: 0, height: 0 },
    backgroundColor: MAP_BACKGROUND_COLOR,
    eventHandlers: {
        zoom: "center",
        drag: true,
        click: true,
    },
    debug: {
        enabled: true,
        hud: {
            enabled: true,
            fps: true,
        },
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
    const map = useCanvasTileEngine();
    const renderer = useMemo(() => new RendererSkia(), []);
    const [scale, setScale] = useState(mapConfig.scale);

    const [imageItems, setImageItems] = useState<SkiaImageItem[]>([]);
    const [circleItems, setCircleItems] = useState<Circle[]>([]);
    const [rectItems, setRectItems] = useState<Rect[]>([]);

    const [modalItem, setModalItem] = useState<MapObject | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Generate map objects (memoized)
    const items = useMemo(
        () =>
            generateMapObjects(10000, INITIAL_COORDS.x, INITIAL_COORDS.y, 1.2),
        [],
    );

    // Source objects in the same order as imageItems, so a hitTest result's
    // index maps straight back to the map object it was drawn from.
    const imageSourcesRef = useRef<MapObject[]>([]);

    // Load images (as SkImage) and prepare draw data
    useEffect(() => {
        if (!map.isReady) return;

        const loadItems = async () => {
            const uniqueAssets = [...new Set(items.map((i) => i.image))];
            const imageCache = new Map<number, SkImage>();

            await Promise.all(
                uniqueAssets.map(async (mod) => {
                    const asset = Asset.fromModule(mod);
                    await asset.downloadAsync();
                    const uri = asset.localUri ?? asset.uri;
                    imageCache.set(mod, await map.loadImage(uri));
                }),
            );

            const newImageItems: SkiaImageItem[] = [];
            const newImageSources: MapObject[] = [];
            const newCircleItems: Circle[] = [];
            const newRectItems: Rect[] = [];

            for (const item of items) {
                const img = imageCache.get(item.image);
                if (!img) continue;

                newImageItems.push({ img, x: item.x, y: item.y, size: 1 });
                newImageSources.push(item);

                if (item.type !== "terrain") {
                    newCircleItems.push({
                        x: item.x,
                        y: item.y,
                        size: 0.1,
                        origin: { mode: "cell", x: 0.1, y: 0.1 },
                        style: { fillStyle: item.color },
                    });
                }

                newRectItems.push({
                    x: item.x,
                    y: item.y,
                    size: 0.7,
                    style: { fillStyle: item.color },
                });
            }

            imageSourcesRef.current = newImageSources;
            setImageItems(newImageItems);
            setCircleItems(newCircleItems);
            setRectItems(newRectItems);
        };

        void loadItems();
    }, [map, map.isReady, items]);

    const handleClick = (coords: { raw: { x: number; y: number } }) => {
        // Built-in hit testing: images are drawn on layer 0
        const hit = map.hitTestFirst(coords.raw, { layer: 0 });
        const item = hit ? imageSourcesRef.current[hit.index] : undefined;
        if (item && item.type !== "terrain") {
            setModalItem(item);
            setModalVisible(true);
        }
    };

    const isMini = scale < MINI_MAP_SCALE_THRESHOLD;

    return (
        // Touch input runs through react-native-gesture-handler; the app root
        // must be wrapped in GestureHandlerRootView.
        <GestureHandlerRootView style={styles.root}>
            <StatusBar style="light" />
            <CanvasTileEngine
                engine={map}
                renderer={renderer}
                config={mapConfig}
                center={INITIAL_COORDS}
                style={styles.canvas}
                onClick={(coords) => {
                    if (isMini) {
                        map.setScale(50);
                        map.setCenter({
                            x: coords.snapped.x,
                            y: coords.snapped.y,
                        });
                        setScale(50);
                    } else {
                        handleClick(coords);
                    }
                }}
                onZoom={(newScale) => setScale(newScale)}
            >
                <CanvasTileEngine.StaticImage
                    items={isMini ? [] : imageItems}
                    layer={0}
                    cacheKey="map-images"
                />
                <CanvasTileEngine.Circle
                    items={isMini ? [] : circleItems}
                    layer={1}
                />
                <CanvasTileEngine.StaticRect
                    items={isMini ? rectItems : []}
                    cacheKey="mini-map-rects"
                    layer={1}
                />
                <CanvasTileEngine.GridLines cellSize={5} layer={2} />
                <CanvasTileEngine.GridLines
                    cellSize={50}
                    lineWidth={isMini ? 2 : 4}
                    layer={2}
                />
                <CanvasTileEngine.DrawFunction layer={3}>
                    {(canvas, _coords, config) => {
                        const cx = config.size.width / 2;
                        const cy = config.size.height / 2;
                        const paint = Skia.Paint();
                        paint.setColor(Skia.Color("red"));
                        canvas.drawRect(
                            Skia.XYWHRect(cx - 5, cy - 5, 10, 10),
                            paint,
                        );
                    }}
                </CanvasTileEngine.DrawFunction>
            </CanvasTileEngine>

            <VillageModal
                item={modalItem}
                visible={modalVisible}
                onClose={() => setModalVisible(false)}
            />
        </GestureHandlerRootView>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: MAP_BACKGROUND_COLOR },
    canvas: { flex: 1 },
});
