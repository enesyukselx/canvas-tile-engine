import reactLogo from "./assets/react.svg";
import "./App.css";
import { CanvasTileEngine, useCanvasTileEngine, type CanvasTileEngineConfig } from "@canvas-tile-engine/react";
import { useState } from "react";

const HOVER_LAYER = 1;
const DRAW_LAYER = 2;

function App() {
    //
    const engine = useCanvasTileEngine();
    const config: CanvasTileEngineConfig = {
        scale: 40,
        gridAligned: true,
        size: {
            width: 400,
            height: 400,
        },
        backgroundColor: "#e6e6e6",
        eventHandlers: {
            hover: true,
        },
    };

    const [lastDrawLayer, setLastDrawLayer] = useState(DRAW_LAYER);
    const [currentColor, setCurrentColor] = useState("#000000");
    const [isDrawing, setIsDrawing] = useState(false);

    return (
        <>
            <div>
                <a href="https://react.dev" target="_blank">
                    <img src={reactLogo} className="logo react" alt="React logo" />
                </a>
            </div>
            <h2>React Pixel Paint Example</h2>
            <div className="paint-menu">
                <button
                    onClick={() => {
                        engine.clearLayer(lastDrawLayer);
                        engine.render();
                        setLastDrawLayer((prev) => (prev > DRAW_LAYER ? prev - 1 : DRAW_LAYER));
                    }}
                >
                    UNDO
                </button>
                <input type="color" value={currentColor} onChange={(e) => setCurrentColor(e.target.value)} />
            </div>
            <div className="paint">
                <CanvasTileEngine
                    engine={engine}
                    config={config}
                    onHover={(coords) => {
                        if (!isDrawing) {
                            engine.clearLayer(HOVER_LAYER);
                            engine.drawRect({
                                x: coords.snapped.x,
                                y: coords.snapped.y,
                                style: {
                                    fillStyle: `${currentColor}66`,
                                },
                            });
                        }

                        if (isDrawing) {
                            engine.drawRect(
                                {
                                    x: coords.snapped.x,
                                    y: coords.snapped.y,
                                    style: {
                                        fillStyle: currentColor,
                                    },
                                },
                                lastDrawLayer + 1
                            );
                        }

                        engine.render();
                    }}
                    onMouseDown={() => {
                        setIsDrawing(true);
                    }}
                    onMouseUp={() => {
                        setIsDrawing(false);
                        setLastDrawLayer((prev) => prev + 1);
                    }}
                    onMouseLeave={() => {
                        if (isDrawing) {
                            setLastDrawLayer((prev) => prev + 1);
                        } else {
                            engine.clearLayer(HOVER_LAYER);
                            engine.render();
                        }
                        setIsDrawing(false);
                    }}
                >
                    <CanvasTileEngine.GridLines cellSize={1} lineWidth={0.1} />
                </CanvasTileEngine>
            </div>
        </>
    );
}

export default App;
