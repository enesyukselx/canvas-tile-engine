import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    PixelRatio,
    StyleSheet,
    View,
    type GestureResponderEvent,
    type LayoutChangeEvent,
    type NativeTouchEvent,
} from "react-native";
import {
    Canvas,
    createPicture,
    Picture,
    type SkCanvas,
    type SkPicture,
    type SkImage,
} from "@shopify/react-native-skia";
import { CanvasTileEngine as CanvasTileEngineCore, type NormalizedPointer } from "@canvas-tile-engine/core";
import type { SkiaMount } from "@canvas-tile-engine/renderer-skia";
import { EngineContext, type EngineContextValue } from "../context/EngineContext";
import type { CanvasTileEngineProps } from "../types";

// Draw components for the compound pattern
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

// Tap heuristics: a touch that moves less than this (dp) and lasts less than
// this (ms) is treated as a tap/click.
const TAP_MOVE_THRESHOLD = 8;
const TAP_TIME_THRESHOLD = 300;

// No tap may fire within this window after a multi-touch gesture. iOS can drop
// touch bookkeeping mid-pinch (RN's "trackedTouchCount" warning) and release
// the responder while one finger is still down; that finger then re-grants as
// a fresh gesture whose lift would otherwise register as a clean tap.
const MULTI_TOUCH_TAP_COOLDOWN_MS = 400;

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
    // Children mount gate. This must be component-local state, not
    // `engine.isReady`: the handle outlives this component, so during a
    // key-driven remount `isReady` still reflects the previous engine and
    // children would mount before this component creates its own engine on
    // first layout — their draw effects would silently register nothing.
    // Local state starts false on every mount, so children always mount
    // after their own engine is attached.
    const [ready, setReady] = useState(false);

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
        [],
    );

    const contextValue = useMemo<EngineContextValue>(() => ({ engine, requestRender }), [engine, requestRender]);

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
                setReady(true);
                instance.render();
            } else if (prev.width !== w || prev.height !== h) {
                instanceRef.current.resize(w, h, 0);
            }
        },
        // Engine is created once; config/center are read at creation time.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [engine, mount, renderer, wireCallbacks],
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

    // Number of touches last forwarded to the engine. The responder grant only
    // fires for the first finger — RN delivers later finger downs/ups via
    // onResponderStart/onResponderEnd — so the count is tracked to re-dispatch
    // touchStart/touchEnd whenever it changes, mirroring DOM touchstart/touchend
    // semantics that GestureProcessor's pinch handling expects.
    const touchCountRef = useRef(0);

    // True once the current gesture has ever had more than one finger down.
    // Kept separately from tapRef because iOS can drop individual touch-start
    // events (RN then warns "Ended a touch event which was not counted in
    // trackedTouchCount"), so any single signal of a second finger — start,
    // end, or move — must permanently disqualify the gesture as a tap.
    const multiTouchRef = useRef(false);
    // Timestamp of the last multi-touch evidence, for the tap cooldown window.
    const lastMultiTouchAtRef = useRef(0);

    const markMultiTouch = useCallback(() => {
        multiTouchRef.current = true;
        lastMultiTouchAtRef.current = Date.now();
        tapRef.current = null;
    }, []);

    const onResponderGrant = useCallback(
        (e: GestureResponderEvent) => {
            const pointers = e.nativeEvent.touches.map(toPointer);
            touchCountRef.current = pointers.length;
            multiTouchRef.current = false;
            if (pointers.length > 1) markMultiTouch();
            rendererRef.current.dispatchTouchStart(pointers);
            tapRef.current =
                pointers.length === 1 ? { x: pointers[0].x, y: pointers[0].y, time: Date.now(), moved: false } : null;
        },
        [markMultiTouch],
    );

    // Fires for each finger down while we already hold the responder. The first
    // finger is handled by grant (same touch count → skipped here); additional
    // fingers re-dispatch touchStart so the engine enters/rebases pinch mode.
    const onResponderStart = useCallback(
        (e: GestureResponderEvent) => {
            const pointers = e.nativeEvent.touches.map(toPointer);
            if (pointers.length > 1) markMultiTouch();
            if (pointers.length === touchCountRef.current) return;
            touchCountRef.current = pointers.length;
            rendererRef.current.dispatchTouchStart(pointers);
        },
        [markMultiTouch],
    );

    // Fires for each finger lift. The final lift is left to release/terminate,
    // which carries the changed pointer for tap detection; only mid-gesture
    // drops (pinch → drag handoff) are dispatched here.
    const onResponderEnd = useCallback(
        (e: GestureResponderEvent) => {
            const remaining = e.nativeEvent.touches.map(toPointer);
            // A finger lifting while others remain proves this was a multi-touch gesture.
            if (remaining.length >= 1) markMultiTouch();
            if (remaining.length === 0 || remaining.length === touchCountRef.current) return;
            touchCountRef.current = remaining.length;
            rendererRef.current.dispatchTouchEnd(remaining);
        },
        [markMultiTouch],
    );

    const onResponderMove = useCallback(
        (e: GestureResponderEvent) => {
            const pointers = e.nativeEvent.touches.map(toPointer);
            if (pointers.length > 1) markMultiTouch();

            // Safety net: if a finger-count change wasn't delivered via
            // onResponderStart/End, resync the engine before forwarding moves.
            if (pointers.length !== touchCountRef.current) {
                const prev = touchCountRef.current;
                touchCountRef.current = pointers.length;
                if (pointers.length > prev) rendererRef.current.dispatchTouchStart(pointers);
                else rendererRef.current.dispatchTouchEnd(pointers);
                return;
            }

            rendererRef.current.dispatchTouchMove(pointers);
            const tap = tapRef.current;
            if (tap && pointers.length === 1) {
                if (Math.hypot(pointers[0].x - tap.x, pointers[0].y - tap.y) > TAP_MOVE_THRESHOLD) {
                    tap.moved = true;
                }
            } else {
                tapRef.current = null;
            }
        },
        [markMultiTouch],
    );

    const endTouch = useCallback((e: GestureResponderEvent, allowTap: boolean) => {
        const remaining = e.nativeEvent.touches.map(toPointer);
        // Suppress the tap paths both during a multi-touch gesture and in the
        // cooldown window after one: broken iOS touch tracking can release the
        // responder early and re-grant the still-down finger as a "new"
        // gesture, whose lift would otherwise look like a clean tap.
        const suppressTap =
            multiTouchRef.current || Date.now() - lastMultiTouchAtRef.current < MULTI_TOUCH_TAP_COOLDOWN_MS;
        // touchEnd is dispatched without the changed pointer: the engine's
        // touch-end mouseUp/click path would double-fire onClick alongside
        // dispatchTap below. onMouseUp is raised via dispatchPointerUp instead,
        // and click is owned solely by this component's tap detection (whose
        // move threshold tolerates finger jitter the engine's path does not).
        touchCountRef.current = remaining.length;
        rendererRef.current.dispatchTouchEnd(remaining);
        // Withheld whenever taps are suppressed: if iOS dropped the second
        // finger's start event, the engine never entered pinch mode and would
        // otherwise treat the final lift as a clean single-pointer release.
        if (!suppressTap) rendererRef.current.dispatchPointerUp(toPointer(e.nativeEvent));

        const tap = tapRef.current;
        if (allowTap && !suppressTap && tap && !tap.moved && Date.now() - tap.time < TAP_TIME_THRESHOLD) {
            rendererRef.current.dispatchTap(toPointer(e.nativeEvent));
        }
        tapRef.current = null;
        if (remaining.length === 0) multiTouchRef.current = false;
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
                onResponderStart={onResponderStart}
                onResponderEnd={onResponderEnd}
                onResponderMove={onResponderMove}
                onResponderRelease={onResponderRelease}
                onResponderTerminate={onResponderTerminate}
                onResponderTerminationRequest={() => false}
            >
                {size.width > 0 &&
                    size.height > 0 && (
                        // pointerEvents="none": the canvas is purely visual — all
                        // gestures are handled by the wrapper View's responder, so
                        // the Skia view must never intercept touches itself.
                        <Canvas pointerEvents="none" style={{ width: size.width, height: size.height }}>
                            {picture && <Picture picture={picture} />}
                        </Canvas>
                    )}
            </View>
            {/* Render children (draw components) only after this component's engine exists */}
            {ready && children}
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
