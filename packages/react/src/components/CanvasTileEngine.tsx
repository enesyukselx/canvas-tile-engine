import { useEffect, useRef, useCallback, useMemo, useState } from "react";
import { CanvasTileEngine as CanvasTileEngineCore } from "@canvas-tile-engine/core";
import { EngineContext, type EngineContextValue } from "../context/EngineContext";
import type { CanvasTileEngineProps } from "../types";

// Import draw components for compound pattern
import { Rect } from "./draw/Rect";
import { Circle } from "./draw/Circle";
import { Image } from "./draw/Image";
import { Sprite } from "./draw/Sprite";
import { GridLines } from "./draw/GridLines";
import { Line } from "./draw/Line";
import { Text } from "./draw/Text";
import { Path } from "./draw/Path";
import { StaticRect } from "./draw/StaticRect";
import { StaticCircle } from "./draw/StaticCircle";
import { StaticImage } from "./draw/StaticImage";
import { DrawFunction } from "./draw/DrawFunction";

/**
 * React component that renders a CanvasTileEngine.
 * Supports both imperative API (via engine handle) and declarative API (via children).
 *
 * @example Declarative API with compound components
 * ```tsx
 * function App() {
 *   const engine = useCanvasTileEngine();
 *
 *   return (
 *     <CanvasTileEngine engine={engine} config={config}>
 *       <CanvasTileEngine.GridLines cellSize={50} layer={0} />
 *       <CanvasTileEngine.Image items={imageItems} layer={1} />
 *       <CanvasTileEngine.Circle items={markers} layer={2} />
 *     </CanvasTileEngine>
 *   );
 * }
 * ```
 *
 * @example Imperative API
 * ```tsx
 * function App() {
 *   const engine = useCanvasTileEngine();
 *
 *   useEffect(() => {
 *     if (engine.isReady) {
 *       engine.drawGridLines(50);
 *       engine.render();
 *     }
 *   }, [engine.isReady]);
 *
 *   return <CanvasTileEngine engine={engine} config={config} />;
 * }
 * ```
 */
function CanvasTileEngineBase({
    engine,
    renderer,
    config,
    center = { x: 0, y: 0 },
    className,
    style,
    children,
    onCoordsChange,
    onClick,
    onRightClick,
    onHover,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onDraw,
    onResize,
    onZoom,
    onWheel,
}: CanvasTileEngineProps) {
    // Children mount gate. This must be component-local state, not
    // `engine.isReady`: the handle outlives this component, so during a
    // key-driven remount `isReady` still reflects the previous engine and
    // children would mount in the first render — their draw effects then run
    // before this component's mount effect creates the new engine (child
    // effects fire first) and silently register nothing. Local state starts
    // false on every mount, so children always mount after their own engine
    // is attached.
    const [ready, setReady] = useState(false);

    // Stable callback refs
    const callbacksRef = useRef({
        onCoordsChange,
        onClick,
        onRightClick,
        onHover,
        onMouseDown,
        onMouseUp,
        onMouseLeave,
        onDraw,
        onResize,
        onZoom,
        onWheel,
    });

    // Update callback refs
    useEffect(() => {
        callbacksRef.current = {
            onCoordsChange,
            onClick,
            onRightClick,
            onHover,
            onMouseDown,
            onMouseUp,
            onMouseLeave,
            onDraw,
            onResize,
            onZoom,
            onWheel,
        };
    });

    // Debounced render - multiple draw components calling requestRender
    // in the same frame will trigger only one render
    const rafIdRef = useRef<number | null>(null);
    const requestRender = useCallback(() => {
        if (rafIdRef.current !== null) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            engine.render();
        });
    }, [engine]);

    // Cleanup RAF on unmount
    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    // Context value
    const contextValue = useMemo<EngineContextValue>(
        () => ({
            engine,
            requestRender,
        }),
        [engine, requestRender],
    );

    // Initialize engine when component mounts
    // Note: config and center are intentionally not in deps - we only want to create the engine once
    // Callbacks are accessed via callbacksRef which is always up-to-date
    useEffect(() => {
        const container = engine._containerRef.current;

        if (!container) {
            return;
        }

        // Create engine instance
        const instance = new CanvasTileEngineCore(container, config, renderer, center);

        // Set up callbacks using stable refs
        instance.onCoordsChange = (coords) => callbacksRef.current.onCoordsChange?.(coords);
        instance.onClick = (...args) => callbacksRef.current.onClick?.(...args);
        instance.onRightClick = (...args) => callbacksRef.current.onRightClick?.(...args);
        instance.onHover = (...args) => callbacksRef.current.onHover?.(...args);
        instance.onMouseDown = (...args) => callbacksRef.current.onMouseDown?.(...args);
        instance.onMouseUp = (...args) => callbacksRef.current.onMouseUp?.(...args);
        instance.onMouseLeave = (...args) => callbacksRef.current.onMouseLeave?.(...args);
        instance.onDraw = (...args) => callbacksRef.current.onDraw?.(...args);
        instance.onResize = () => callbacksRef.current.onResize?.();
        instance.onZoom = (scale) => callbacksRef.current.onZoom?.(scale);
        instance.onWheel = (...args) => callbacksRef.current.onWheel?.(...args);

        // Attach to handle, then open the children gate
        engine._setInstance(instance);
        setReady(true);

        // Initial render
        instance.render();

        // Cleanup on unmount
        return () => {
            instance.destroy();
            engine._setInstance(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine]);

    return (
        <EngineContext.Provider value={contextValue}>
            <div
                ref={engine._containerRef}
                className={className}
                style={{
                    ...style,
                }}
            >
                <canvas />
            </div>
            {/* Render children only after this component's engine exists */}
            {ready && children}
        </EngineContext.Provider>
    );
}

// Compound component pattern - attach draw components as static properties
export const CanvasTileEngine = Object.assign(CanvasTileEngineBase, {
    Rect,
    Circle,
    Image,
    Sprite,
    GridLines,
    Line,
    Text,
    Path,
    StaticRect,
    StaticCircle,
    StaticImage,
    DrawFunction,
});
