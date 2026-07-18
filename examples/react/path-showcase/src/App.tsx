import { useState } from "react";
import { CanvasTileEngine, useCanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/react";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";
import { labelItems, lineItems, pathItems, type ShapeData } from "./scene";

const INITIAL_CENTER = { x: 13, y: 11 };

const config: CanvasTileEngineConfig = {
    scale: 42,
    minScale: 8,
    maxScale: 160,
    size: { width: window.innerWidth, height: window.innerHeight },
    responsive: "preserve-scale",
    backgroundColor: "#0f172a",
    eventHandlers: { drag: true, zoom: "pointer", click: true, hover: true },
};

export default function App() {
    const engine = useCanvasTileEngine();

    const [useWebGL, setUseWebGL] = useState(false);
    // Renderer is read once at mount, so the toggle remounts via `key` —
    // carrying the current camera over so both renderers show the same frame.
    const [view, setView] = useState({
        center: INITIAL_CENTER,
        scale: config.scale,
    });
    const [hit, setHit] = useState<string | null>(null);

    const toggleRenderer = () => {
        if (engine.isReady) {
            setView({ center: engine.getCenter(), scale: engine.getScale() });
        }
        setUseWebGL((v) => !v);
    };

    const setCursor = (cursor: string) => {
        const canvas = engine.instance?.canvas;
        if (canvas) canvas.style.cursor = cursor;
    };

    return (
        <>
            <CanvasTileEngine
                key={useWebGL ? "webgl" : "canvas"}
                engine={engine}
                renderer={useWebGL ? new RendererWebGL() : new RendererCanvas()}
                config={{ ...config, scale: view.scale }}
                center={view.center}
                onHover={(coords) => {
                    setCursor(engine.hitTestFirst(coords.raw) ? "pointer" : "move");
                }}
                onMouseLeave={() => setCursor("default")}
                onClick={(coords) => {
                    const result = engine.hitTestFirst<ShapeData>(coords.raw);
                    setHit(result ? `${result.kind} → ${result.item.data?.name ?? "(no data)"}` : null);
                }}
            >
                <CanvasTileEngine.GridLines cellSize={1} strokeStyle="#1e293b" layer={0} />
                <CanvasTileEngine.GridLines cellSize={5} strokeStyle="#334155" layer={0} />
                <CanvasTileEngine.Path items={pathItems} layer={1} />
                <CanvasTileEngine.Line
                    items={lineItems}
                    style={{
                        strokeStyle: "#f472b6",
                        lineWidthPx: 4,
                        lineDash: [0.4, 0.2],
                    }}
                    layer={1}
                />
                <CanvasTileEngine.Text items={labelItems} layer={2} />
            </CanvasTileEngine>

            <div className="hud top-right">
                <button
                    className={`renderer-toggle ${useWebGL ? "webgl" : "canvas"}`}
                    onClick={toggleRenderer}
                    title="Switch renderer — the camera carries over"
                >
                    {useWebGL ? "WebGL" : "Canvas2D"} ⇄
                </button>
            </div>

            <div className="hud bottom-left">
                <div className="hit-panel">
                    {hit ? (
                        <>
                            hit → <span className="kind">{hit}</span>
                        </>
                    ) : (
                        <span className="muted">
                            Click a shape — its kind and data appear here. Empty space clears.
                        </span>
                    )}
                </div>
            </div>
        </>
    );
}
