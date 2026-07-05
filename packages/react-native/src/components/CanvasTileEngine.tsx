import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    PixelRatio,
    StyleSheet,
    View,
    type GestureResponderEvent,
    type LayoutChangeEvent,
    type NativeTouchEvent,
} from "react-native";
import { Canvas, createPicture, Picture, type SkCanvas, type SkPicture, type SkImage } from "@shopify/react-native-skia";
import { CanvasTileEngine as CanvasTileEngineCore, type NormalizedPointer } from "@canvas-tile-engine/core";
import type { SkiaMount } from "@canvas-tile-engine/renderer-skia";
import { EngineContext, type EngineContextValue } from "../context/EngineContext";
import type { CanvasTileEngineProps } from "../types";

// Draw components for the compound pattern
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

// Tap heuristics: a touch that moves less than this (dp) and lasts less than
// this (ms) is treated as a tap/click.
const TAP_MOVE_THRESHOLD = 8;
const TAP_TIME_THRESHOLD = 300;

interface TapState {
    x: number;
    y: number;
    time: number;
    moved: boolean;
}

// RendererSkia's canvas bounds getter always reports { left: 0, top: 0 } (the
// host has no way to query the canvas's on-screen position), so clientX/Y must
// already be canvas-relative for GestureProcessor's `- bounds.left/top` math
// to land correctly. locationX/Y (relative to the touched view) satisfy that;
// pageX/Y (screen-relative) would not once the canvas is offset on screen.
const toPointer = (t: NativeTouchEvent): NormalizedPointer => ({
    x: t.locationX,
    y: t.locationY,
    clientX: t.locationX,
    clientY: t.locationY,
});

/**
 * React Native component that renders a CanvasTileEngine with the Skia renderer.
 * Supports both the imperative API (via the engine handle) and the declarative
 * API (via compound draw components) — identical to `@canvas-tile-engine/react`,
 * only the renderer (and `style` being a `ViewStyle`) differs.
 *
 * @example Declarative API with compound components
 * ```tsx
 * function App() {
 *   const engine = useCanvasTileEngine();
 *   return (
 *     <CanvasTileEngine engine={engine} config={config} renderer={new RendererSkia()} style={{ flex: 1 }}>
 *       <CanvasTileEngine.GridLines cellSize={50} layer={0} />
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
 *   useEffect(() => {
 *     if (engine.isReady) {
 *       engine.drawGridLines(50);
 *       engine.render();
 *     }
 *   }, [engine.isReady]);
 *   return <CanvasTileEngine engine={engine} config={config} renderer={new RendererSkia()} style={{ flex: 1 }} />;
 * }
 * ```
 */
// NOTE: Do not wrap this component in memo(). `engine.isReady` is read from a
// ref, so the `isReady && children` gate below only re-evaluates because the
// hook's setState re-renders the parent. With a stable engine handle, memo()
// would skip that re-render and the declarative children would never mount.
function CanvasTileEngineBase({
    engine,
    renderer,
    config,
    center = { x: 0, y: 0 },
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
}: CanvasTileEngineProps) {
    const [picture, setPicture] = useState<SkPicture | null>(null);
    const [size, setSize] = useState({ width: 0, height: 0 });

    const instanceRef = useRef<CanvasTileEngineCore<SkiaMount, SkImage> | null>(null);
    const sizeRef = useRef({ width: 0, height: 0 });
    const tapRef = useRef<TapState | null>(null);
    // The renderer actually wired to the engine. Captured at creation so gesture
    // forwarding is unaffected if the `renderer` prop identity changes between
    // renders (e.g. an inline `new RendererSkia()`).
    const rendererRef = useRef(renderer);

    // Keep callbacks current without recreating the engine.
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
    });
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
        };
    });

    // Debounced render - multiple draw components calling requestRender in the
    // same frame trigger only one render.
    const rafIdRef = useRef<number | null>(null);
    const requestRender = useCallback(() => {
        if (rafIdRef.current !== null) return;
        rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = null;
            engine.render();
        });
    }, [engine]);

    useEffect(() => {
        return () => {
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
        };
    }, []);

    // The mount contract handed to the engine: it records each frame painter
    // into an SkPicture and triggers a re-render.
    const mount = useMemo<SkiaMount>(
        () => ({
            getSize: () => sizeRef.current,
            getDpr: () => PixelRatio.get(),
            present: (paint: (canvas: SkCanvas) => void) => {
                const { width, height } = sizeRef.current;
                if (width <= 0 || height <= 0) return;
                setPicture(createPicture(paint, { width, height }));
            },
        }),
        []
    );

    const contextValue = useMemo<EngineContextValue>(
        () => ({ engine, requestRender }),
        [engine, requestRender]
    );

    const wireCallbacks = useCallback((instance: CanvasTileEngineCore<SkiaMount, SkImage>) => {
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
    }, []);

    const handleLayout = useCallback(
        (e: LayoutChangeEvent) => {
            const { width, height } = e.nativeEvent.layout;
            const w = Math.round(width);
            const h = Math.round(height);
            if (w <= 0 || h <= 0) return;

            const prev = sizeRef.current;
            sizeRef.current = { width: w, height: h };
            setSize({ width: w, height: h });

            if (!instanceRef.current) {
                // First layout: create the engine sized to the measured area.
                const mergedConfig = { ...config, size: { ...config.size, width: w, height: h } };
                const instance = new CanvasTileEngineCore<SkiaMount, SkImage>(mount, mergedConfig, renderer, center);
                wireCallbacks(instance);
                instanceRef.current = instance;
                rendererRef.current = renderer;
                engine._setInstance(instance);
                instance.render();
            } else if (prev.width !== w || prev.height !== h) {
                instanceRef.current.resize(w, h, 0);
            }
        },
        // Engine is created once; config/center are read at creation time.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [engine, mount, renderer, wireCallbacks]
    );

    // Tear down on unmount.
    useEffect(() => {
        return () => {
            instanceRef.current?.destroy();
            instanceRef.current = null;
            engine._setInstance(null);
        };
    }, [engine]);

    // ─── Touch → renderer gesture forwarding ───

    const onResponderGrant = useCallback((e: GestureResponderEvent) => {
        const pointers = e.nativeEvent.touches.map(toPointer);
        rendererRef.current.dispatchTouchStart(pointers);
        tapRef.current =
            pointers.length === 1 ? { x: pointers[0].x, y: pointers[0].y, time: Date.now(), moved: false } : null;
    }, []);

    const onResponderMove = useCallback((e: GestureResponderEvent) => {
        const pointers = e.nativeEvent.touches.map(toPointer);
        rendererRef.current.dispatchTouchMove(pointers);
        const tap = tapRef.current;
        if (tap && pointers.length === 1) {
            if (Math.hypot(pointers[0].x - tap.x, pointers[0].y - tap.y) > TAP_MOVE_THRESHOLD) {
                tap.moved = true;
            }
        } else {
            tapRef.current = null;
        }
    }, []);

    const endTouch = useCallback((e: GestureResponderEvent, allowTap: boolean) => {
        const remaining = e.nativeEvent.touches.map(toPointer);
        const changed = toPointer(e.nativeEvent);
        rendererRef.current.dispatchTouchEnd(remaining, changed);

        const tap = tapRef.current;
        if (allowTap && tap && !tap.moved && Date.now() - tap.time < TAP_TIME_THRESHOLD) {
            rendererRef.current.dispatchTap(changed);
        }
        tapRef.current = null;
    }, []);

    const onResponderRelease = useCallback((e: GestureResponderEvent) => endTouch(e, true), [endTouch]);
    const onResponderTerminate = useCallback((e: GestureResponderEvent) => endTouch(e, false), [endTouch]);

    return (
        <EngineContext.Provider value={contextValue}>
            <View
                style={[styles.fill, style]}
                onLayout={handleLayout}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={onResponderGrant}
                onResponderMove={onResponderMove}
                onResponderRelease={onResponderRelease}
                onResponderTerminate={onResponderTerminate}
                onResponderTerminationRequest={() => false}
            >
                {size.width > 0 && size.height > 0 && (
                    <Canvas style={{ width: size.width, height: size.height }}>
                        {picture && <Picture picture={picture} />}
                    </Canvas>
                )}
            </View>
            {/* Render children (draw components) only when engine is ready */}
            {engine.isReady && children}
        </EngineContext.Provider>
    );
}

const styles = StyleSheet.create({
    fill: {
        flex: 1,
        overflow: "hidden",
    },
});

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
