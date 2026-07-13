import {
    CanvasTileEngine,
    useCanvasTileEngine,
    type CanvasTileEngineConfig,
    type ImageItem,
} from "@canvas-tile-engine/react";
import "./App.css";
import { ADS, BOARD, createLogoSheet, GRID, INITIAL_CENTER, SHEET_FRAMES, SURFACE_COLOR } from "./constants";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { useEffect, useMemo, useState } from "react";

function App() {
    const engine = useCanvasTileEngine();
    const [sheet, setSheet] = useState<HTMLImageElement | null>(null);
    const [cursor, setCursor] = useState<"default" | "pointer">("default");
    // gridToSize derives size/scale/center for a fully visible 100x100 board;
    // preserve-viewport keeps all 100 blocks in view at any container width.
    const mapConfig: CanvasTileEngineConfig = {
        ...BOARD,
        minScale: BOARD.scale,
        maxScale: 40,
        responsive: "preserve-viewport",
        backgroundColor: SURFACE_COLOR,
        bounds: { minX: 0, maxX: GRID, minY: 0, maxY: GRID },
        eventHandlers: { drag: true, zoom: "pointer", hover: true, click: true },
    };

    // The three dummy logos live on one runtime-generated spritesheet;
    // each ad crops its frame via the `sprite` source rect.
    useEffect(() => {
        let cancelled = false;
        const img = new Image();
        img.onload = () => {
            if (!cancelled) setSheet(img);
        };
        img.src = createLogoSheet().toDataURL();
        return () => {
            cancelled = true;
        };
    }, []);

    // Each ad starts at block (ad.x, ad.y) and extends w x h blocks. The
    // engine anchors items to their coordinate's cell CENTER, so to land the
    // frame's top-left on that block we anchor its center at the region
    // center: top-left + half size - the half-cell offset. The frame's aspect
    // ratio matches w:h, so with size = max(w, h) it fills the region exactly.
    const adItems = useMemo<ImageItem<HTMLImageElement>[]>(() => {
        if (!sheet) return [];
        return ADS.map((ad) => ({
            x: ad.x + ad.w / 2 - 0.5,
            y: ad.y + ad.h / 2 - 0.5,
            size: Math.max(ad.w, ad.h),
            origin: { mode: "self", x: 0.5, y: 0.5 },
            img: sheet,
            sprite: SHEET_FRAMES[ad.logo],
        }));
    }, [sheet]);

    useEffect(() => {
        const canvas = engine.instance?.canvas;
        if (canvas) {
            canvas.style.cursor = cursor;
        }
    }, [cursor, engine.instance]);

    return (
        <>
            <section id="center">
                <div>
                    <h1>Million Dollar Homepage</h1>
                    <p style={{ padding: "0 20px" }}>
                        This is a canvas-tile-engine implementation of the Million Dollar Homepage. The original website
                        was created by Alex Tew in 2005 to raise money for his university education. It consisted of a
                        1000x1000 pixel grid where each pixel could be purchased for $1, allowing advertisers to display
                        their logos or messages.
                    </p>
                </div>
            </section>

            <section id="next-steps">
                <div>
                    <CanvasTileEngine
                        engine={engine}
                        renderer={new RendererCanvas()}
                        config={mapConfig}
                        center={INITIAL_CENTER}
                        onHover={(coords) => {
                            const hit = engine.hitTestFirst(coords.raw);
                            if (hit) {
                                setCursor("pointer");
                            } else {
                                setCursor("default");
                            }
                        }}
                        onClick={(coords) => {
                            const hit = engine.hitTestFirst(coords.raw);
                            if (hit) {
                                alert(ADS[hit.index].name);
                            }
                        }}
                        onMouseLeave={() => {
                            setCursor("default");
                        }}
                    >
                        <CanvasTileEngine.Image items={adItems} layer={2} />
                        <CanvasTileEngine.GridLines cellSize={1} lineWidth={0.1} layer={0} />
                    </CanvasTileEngine>
                </div>
            </section>
        </>
    );
}

export default App;
