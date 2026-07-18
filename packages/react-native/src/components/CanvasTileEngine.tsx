import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PixelRatio, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector, type GestureTouchEvent, type TouchData } from "react-native-gesture-handler";
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
// to land correctly. RNGH's TouchData x/y (relative to the handler's view)
// satisfy that; absoluteX/Y (screen-relative) would not once the canvas is
// offset on screen.
const toPointer = (t: TouchData): NormalizedPointer => ({
    x: t.x,
    y: t.y,
    clientX: t.x,
    clientY: t.y,
});

// Pointers that remain on screen after this event: on up events some
// platforms still report the lifting pointer inside `allTouches`, so the
// changed (lifted) ids are filtered out explicitly.
const remainingPointers = (e: GestureTouchEvent): NormalizedPointer[] => {
    const lifted = new Set(e.changedTouches.map((t) => t.id));
    return e.allTouches.filter((t) => !lifted.has(t.id)).map(toPointer);
};

/**
 * React Native component that renders a CanvasTileEngine with the Skia renderer.
 * Supports both the imperative API (via the engine handle) and the declarative
 * API (via compound draw components) — identical to `@canvas-tile-engine/react`,
 * only the renderer (and `style` being a `ViewStyle`) differs.
 *
 * Touch input runs through react-native-gesture-handler, so the app root (or
 * any ancestor of this component) must be wrapped in `GestureHandlerRootView`.
 * Because the gesture participates in native arbitration, the map coexists
 * with scrollable parents: it claims the touch stream while interactions are
 * enabled and lets the ScrollView pan when they are not.
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
    onWheel,
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
        onWheel,
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
            onWheel,
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
        instance.onWheel = (...args) => callbacksRef.current.onWheel?.(...args);
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

    // ─── Touch → renderer gesture forwarding (react-native-gesture-handler) ───
    //
    // Two composed RNGH gestures, deliberately avoiding the GestureStateManager:
    // with Reanimated installed, manager.activate()/fail() (setGestureState)
    // only works from UI-thread worklets and silently no-ops from runOnJS
    // callbacks — a library cannot ship reliably workletized code. Instead:
    //
    // - A Manual gesture is a pure touch TRANSPORT: raw touches feed the
    //   renderer's existing dispatchTouch* API on the JS thread. It never
    //   changes gesture state; whether a gesture's touches are forwarded at
    //   all is decided in JS on the first touch (claimRef).
    // - A callback-less Pan "blocker" activates NATIVELY after a tiny
    //   movement, which is what actually cancels an enclosing ScrollView's
    //   pan (native arbitration needs a native activation, not JS state
    //   calls). It runs simultaneous with the transport and is disabled
    //   whenever no interaction would consume the touches, so scrollable
    //   parents keep working over non-interactive maps.

    // Number of touches last forwarded to the engine, tracked to re-dispatch
    // touchStart/touchEnd whenever the finger count changes, mirroring DOM
    // touchstart/touchend semantics that GestureProcessor's pinch handling
    // expects.
    const touchCountRef = useRef(0);

    // Whether the current gesture's touches are forwarded to the engine.
    // Decided once per gesture on the first touch, like the old responder
    // claim check.
    const claimRef = useRef(false);

    // True once the current gesture has ever had more than one finger down.
    // Kept separately from tapRef because iOS can drop individual touch-start
    // events, so any single signal of a second finger — start, end, or move —
    // must permanently disqualify the gesture as a tap. These defenses predate
    // RNGH but stay until multi-touch reliability is re-verified on device.
    const multiTouchRef = useRef(false);
    // Timestamp of the last multi-touch evidence, for the tap cooldown window.
    const lastMultiTouchAtRef = useRef(0);

    const markMultiTouch = useCallback(() => {
        multiTouchRef.current = true;
        lastMultiTouchAtRef.current = Date.now();
        tapRef.current = null;
    }, []);

    // Consume touches only while some interaction actually uses them —
    // otherwise a parent ScrollView must keep receiving the gesture. Checked
    // per gesture because setEventHandlers can toggle handlers at runtime.
    // onMouseDown/onMouseUp are not config-gated, and unlike the web there is
    // no synthetic-mouse fallback, so their presence also claims the touches.
    const shouldClaimGesture = useCallback(() => {
        const instance = instanceRef.current;
        if (!instance) return false;
        const eventHandlers = instance.getConfig().eventHandlers;
        if (eventHandlers.click || eventHandlers.drag || eventHandlers.zoom || eventHandlers.hover) return true;
        return Boolean(callbacksRef.current.onMouseDown || callbacksRef.current.onMouseUp);
    }, []);

    const onTouchesDown = useCallback(
        (e: GestureTouchEvent) => {
            const pointers = e.allTouches.map(toPointer);

            if (touchCountRef.current === 0) {
                claimRef.current = shouldClaimGesture();
                if (!claimRef.current) return;
                multiTouchRef.current = false;
                tapRef.current =
                    pointers.length === 1
                        ? { x: pointers[0].x, y: pointers[0].y, time: Date.now(), moved: false }
                        : null;
            }
            if (!claimRef.current) return;

            if (pointers.length > 1) markMultiTouch();
            if (pointers.length === touchCountRef.current) return;
            touchCountRef.current = pointers.length;
            // Additional fingers re-dispatch touchStart so the engine
            // enters/rebases pinch mode.
            rendererRef.current.dispatchTouchStart(pointers);
        },
        [markMultiTouch, shouldClaimGesture],
    );

    const onTouchesMove = useCallback(
        (e: GestureTouchEvent) => {
            if (!claimRef.current) return;
            const pointers = e.allTouches.map(toPointer);
            if (pointers.length > 1) markMultiTouch();

            // Safety net: if a finger-count change wasn't delivered via
            // onTouchesDown/Up, resync the engine before forwarding moves.
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

    const endTouch = useCallback(
        (e: GestureTouchEvent, allowTap: boolean) => {
            if (!claimRef.current) return;
            const remaining = remainingPointers(e);
            const changed = e.changedTouches.length > 0 ? toPointer(e.changedTouches[0]) : undefined;

            if (remaining.length > 0) {
                // A finger lifted while others remain: proves multi-touch, and
                // the engine leaves/rebases pinch mode.
                markMultiTouch();
                if (remaining.length !== touchCountRef.current) {
                    touchCountRef.current = remaining.length;
                    rendererRef.current.dispatchTouchEnd(remaining);
                }
                return;
            }

            // Final lift. Suppress the tap paths both during a multi-touch
            // gesture and in the cooldown window after one: broken iOS touch
            // tracking can end a gesture early and restart the still-down
            // finger as a "new" gesture, whose lift would otherwise look like
            // a clean tap.
            const suppressTap =
                multiTouchRef.current || Date.now() - lastMultiTouchAtRef.current < MULTI_TOUCH_TAP_COOLDOWN_MS;
            // touchEnd is dispatched without the changed pointer: the engine's
            // touch-end mouseUp/click path would double-fire onClick alongside
            // dispatchTap below. onMouseUp is raised via dispatchPointerUp
            // instead, and click is owned solely by this component's tap
            // detection (whose move threshold tolerates finger jitter the
            // engine's path does not).
            touchCountRef.current = 0;
            rendererRef.current.dispatchTouchEnd([]);
            // Withheld whenever taps are suppressed: if iOS dropped the second
            // finger's start event, the engine never entered pinch mode and
            // would otherwise treat the final lift as a clean single-pointer
            // release.
            if (!suppressTap && changed) rendererRef.current.dispatchPointerUp(changed);

            const tap = tapRef.current;
            if (
                allowTap &&
                !suppressTap &&
                changed &&
                tap &&
                !tap.moved &&
                Date.now() - tap.time < TAP_TIME_THRESHOLD
            ) {
                rendererRef.current.dispatchTap(changed);
            }
            tapRef.current = null;
            multiTouchRef.current = false;
        },
        [markMultiTouch],
    );

    const onTouchesUp = useCallback((e: GestureTouchEvent) => endTouch(e, true), [endTouch]);
    const onTouchesCancelled = useCallback((e: GestureTouchEvent) => endTouch(e, false), [endTouch]);

    // Blocker enablement is read at render time; the component re-renders on
    // every engine frame (picture state), so a runtime setEventHandlers
    // toggle is picked up on the next painted frame.
    const interactionsClaimed = shouldClaimGesture();

    // The transport reads live state through refs; runOnJS keeps the
    // callbacks on the JS thread (the engine is a plain JS object) even when
    // Reanimated is installed.
    const gesture = useMemo(() => {
        const transport = Gesture.Manual()
            .runOnJS(true)
            .onTouchesDown(onTouchesDown)
            .onTouchesMove(onTouchesMove)
            .onTouchesUp(onTouchesUp)
            .onTouchesCancelled(onTouchesCancelled);
        // Callback-less by design: its only job is to activate natively on a
        // tiny movement, which cancels an enclosing ScrollView's pan. Taps
        // don't move far enough to activate it — and don't scroll pages
        // either, so nothing needs blocking for them.
        const blocker = Gesture.Pan()
            .enabled(interactionsClaimed)
            .minDistance(2)
            .maxPointers(10)
            .shouldCancelWhenOutside(false);
        return Gesture.Simultaneous(transport, blocker);
    }, [interactionsClaimed, onTouchesDown, onTouchesMove, onTouchesUp, onTouchesCancelled]);

    return (
        <EngineContext.Provider value={contextValue}>
            <GestureDetector gesture={gesture}>
                <View style={[styles.fill, style]} onLayout={handleLayout}>
                    {size.width > 0 &&
                        size.height > 0 && (
                            // pointerEvents="none": the canvas is purely visual — all
                            // gestures are handled by the wrapper's GestureDetector, so
                            // the Skia view must never intercept touches itself.
                            <Canvas pointerEvents="none" style={{ width: size.width, height: size.height }}>
                                {picture && <Picture picture={picture} />}
                            </Canvas>
                        )}
                </View>
            </GestureDetector>
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
