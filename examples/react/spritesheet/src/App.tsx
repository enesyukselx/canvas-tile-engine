import { useEffect, useMemo, useState } from "react";
import {
    CanvasTileEngine,
    SpriteSheet,
    useCanvasTileEngine,
    type CanvasTileEngineConfig,
    type ImageItem,
} from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";

// dragon.png: 432x512 sheet, 3 columns x 4 rows -> 144x128 per frame.
// Each row is one flap cycle of a different flight direction.
const sheet = new SpriteSheet({ frameWidth: 144, frameHeight: 128, columns: 3 });
const ANIMATION_FPS = 8;

const config: CanvasTileEngineConfig = {
    scale: 60,
    minScale: 25,
    maxScale: 150,
    size: { width: 800, height: 600 },
    backgroundColor: "#0f2027",
    eventHandlers: {
        zoom: true,
        drag: true,
        click: true,
    },
};

// One animated dragon per sheet row
const DRAGONS = [
    { x: 1, y: 2, size: 1, row: 0 },
    { x: 2, y: 2, size: 1, row: 1 },
    { x: 3, y: 2, size: 1, row: 2 },
    { x: 4, y: 2, size: 1, row: 3 },
];

function useDragonImage() {
    const [img, setImg] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        const image = new Image();
        image.onload = () => setImg(image);
        image.src = "/dragon.png";
    }, []);

    return img;
}

function App() {
    const engine = useCanvasTileEngine();
    const img = useDragonImage();
    const [playing, setPlaying] = useState(true);

    // Static frames: pick single frames from the sheet, no animation
    const staticItems = useMemo<ImageItem[]>(() => {
        if (!img) return [];
        return [0, 1, 2, 3].map((row) => ({
            x: row + 1,
            y: 3,
            size: 1,
            img,
            sprite: sheet.frame(0, row),
        }));
    }, [img]);

    // Animated dragons: item + flap-cycle frames per sheet row
    const animatedDragons = useMemo(() => {
        if (!img) return [];
        return DRAGONS.map((dragon) => ({
            key: dragon.row,
            item: { x: dragon.x, y: dragon.y, size: dragon.size, img } satisfies ImageItem,
            frames: sheet.framesInRow(dragon.row, 0, 2),
        }));
    }, [img]);

    return (
        <div className="page">
            <h1>Spritesheet &amp; Animation (React)</h1>
            <p className="hint">
                One 432&times;512 sheet (3 columns &times; 4 rows, 144&times;128 frames). Left column: fixed frames via{" "}
                <code>&lt;Image&gt;</code> with a <code>sprite</code> rect. Right side: dragons animated with{" "}
                <code>&lt;Sprite&gt;</code>. Drag to pan, scroll to zoom, click to {playing ? "pause" : "resume"}.
            </p>
            <CanvasTileEngine
                className="map-wrapper"
                engine={engine}
                config={config}
                renderer={new RendererCanvas()}
                center={{ x: 6, y: 4.5 }}
                onClick={() => setPlaying((prev) => !prev)}
            >
                <CanvasTileEngine.GridLines cellSize={1} lineWidth={1} strokeStyle="rgba(255,255,255,0.08)" />
                {img && (
                    <>
                        <CanvasTileEngine.Image items={staticItems} />
                        {animatedDragons.map((dragon) => (
                            <CanvasTileEngine.Sprite
                                key={dragon.key}
                                items={dragon.item}
                                frames={dragon.frames}
                                fps={ANIMATION_FPS}
                                playing={playing}
                            />
                        ))}
                    </>
                )}
            </CanvasTileEngine>
        </div>
    );
}

export default App;
