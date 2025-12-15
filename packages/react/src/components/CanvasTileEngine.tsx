import { useEffect, useRef, useCallback, useMemo } from "react";
import { CanvasTileEngine as CanvasTileEngineCore } from "@canvas-tile-engine/core";
import { EngineContext, type EngineContextValue } from "../context/EngineContext";
import type { CanvasTileEngineProps } from "../types";

// Import draw components for compound pattern
import { Rect } from "./draw/Rect";
import { Circle } from "./draw/Circle";
import { Image } from "./draw/Image";
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
    config,
    center = { x: 0, y: 0 },
    className,
    style,
    children,
    onCoordsChange,
    onClick,
    onHover,
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onDraw,
    onResize,
}: CanvasTileEngineProps) {
    // Stable callback refs
    const callbacksRef = useRef({
        onCoordsChange,
        onClick,
        onHover,
        onMouseDown,
        onMouseUp,
        onMouseLeave,
        onDraw,
        onResize,
    });

    // Update callback refs
    useEffect(() => {
        callbacksRef.current = {
            onCoordsChange,
            onClick,
            onHover,
            onMouseDown,
            onMouseUp,
            onMouseLeave,
            onDraw,
            onResize,
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
        [engine, requestRender]
    );

    // Initialize engine when component mounts
    useEffect(() => {
        const container = engine._containerRef.current;

        if (!container) {
            return;
        }

        // Create engine instance
        const instance = new CanvasTileEngineCore(container, config, center);

        // Set up callbacks using stable refs
        instance.onCoordsChange = (coords) => callbacksRef.current.onCoordsChange?.(coords);
        instance.onClick = (...args) => callbacksRef.current.onClick?.(...args);
        instance.onHover = (...args) => callbacksRef.current.onHover?.(...args);
        instance.onMouseDown = () => callbacksRef.current.onMouseDown?.();
        instance.onMouseUp = () => callbacksRef.current.onMouseUp?.();
        instance.onMouseLeave = () => callbacksRef.current.onMouseLeave?.();
        instance.onDraw = (...args) => callbacksRef.current.onDraw?.(...args);
        instance.onResize = () => callbacksRef.current.onResize?.();

        // Attach to handle
        engine._setInstance(instance);

        // Initial render
        instance.render();

        // Cleanup on unmount
        return () => {
            instance.destroy();
            engine._setInstance(null);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [engine]);

    // Update callbacks on engine when they change
    useEffect(() => {
        const instance = engine.instance;

        if (!instance) {
            return;
        }

        if (onClick !== undefined) instance.onClick = onClick;
        if (onHover !== undefined) instance.onHover = onHover;
        if (onMouseDown !== undefined) instance.onMouseDown = onMouseDown;
        if (onMouseUp !== undefined) instance.onMouseUp = onMouseUp;
        if (onMouseLeave !== undefined) instance.onMouseLeave = onMouseLeave;
        if (onDraw !== undefined) instance.onDraw = onDraw;
        if (onResize !== undefined) instance.onResize = onResize;
        if (onCoordsChange !== undefined) instance.onCoordsChange = onCoordsChange;
    }, [engine, onClick, onHover, onMouseDown, onMouseUp, onMouseLeave, onDraw, onResize, onCoordsChange]);

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
            {/* Render children only when engine is ready */}
            {engine.isReady && children}
        </EngineContext.Provider>
    );
}

// Compound component pattern - attach draw components as static properties
export const CanvasTileEngine = Object.assign(CanvasTileEngineBase, {
    Rect,
    Circle,
    Image,
    GridLines,
    Line,
    Text,
    Path,
    StaticRect,
    StaticCircle,
    StaticImage,
    DrawFunction,
});
