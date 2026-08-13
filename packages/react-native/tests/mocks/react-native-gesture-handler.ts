/**
 * Minimal runtime mock of `react-native-gesture-handler`. Wired in via
 * `resolve.alias` in vitest.config.mts.
 *
 * RNGH's builders are chainable configuration objects whose handlers are
 * invoked by native code; the mock keeps the chaining contract and records the
 * configuration + handlers so tests can (a) assert how the transport and the
 * Pan blocker were configured and (b) call the touch handlers directly, which
 * is the only honest stand-in for a native gesture stream.
 */
import { createElement, Fragment, type ReactNode } from "react";

export interface TouchData {
    id: number;
    x: number;
    y: number;
    absoluteX: number;
    absoluteY: number;
}

export interface GestureTouchEvent {
    handlerTag: number;
    numberOfTouches: number;
    state: number;
    eventType: number;
    allTouches: TouchData[];
    changedTouches: TouchData[];
}

type TouchHandler = (event: GestureTouchEvent) => void;

export interface ManualGestureMock {
    readonly kind: "manual";
    jsThread: boolean;
    onTouchesDownHandler?: TouchHandler;
    onTouchesMoveHandler?: TouchHandler;
    onTouchesUpHandler?: TouchHandler;
    onTouchesCancelledHandler?: TouchHandler;
    runOnJS(value: boolean): ManualGestureMock;
    onTouchesDown(cb: TouchHandler): ManualGestureMock;
    onTouchesMove(cb: TouchHandler): ManualGestureMock;
    onTouchesUp(cb: TouchHandler): ManualGestureMock;
    onTouchesCancelled(cb: TouchHandler): ManualGestureMock;
}

export interface PanGestureMock {
    readonly kind: "pan";
    isEnabled?: boolean;
    minDistanceValue?: number;
    maxPointersValue?: number;
    cancelWhenOutside?: boolean;
    enabled(value: boolean): PanGestureMock;
    minDistance(value: number): PanGestureMock;
    maxPointers(value: number): PanGestureMock;
    shouldCancelWhenOutside(value: boolean): PanGestureMock;
}

export interface SimultaneousGestureMock {
    readonly kind: "simultaneous";
    gestures: Array<ManualGestureMock | PanGestureMock>;
}

const makeManual = (): ManualGestureMock => {
    const gesture: ManualGestureMock = {
        kind: "manual",
        jsThread: false,
        runOnJS(value) {
            gesture.jsThread = value;
            return gesture;
        },
        onTouchesDown(cb) {
            gesture.onTouchesDownHandler = cb;
            return gesture;
        },
        onTouchesMove(cb) {
            gesture.onTouchesMoveHandler = cb;
            return gesture;
        },
        onTouchesUp(cb) {
            gesture.onTouchesUpHandler = cb;
            return gesture;
        },
        onTouchesCancelled(cb) {
            gesture.onTouchesCancelledHandler = cb;
            return gesture;
        },
    };
    return gesture;
};

const makePan = (): PanGestureMock => {
    const gesture: PanGestureMock = {
        kind: "pan",
        enabled(value) {
            gesture.isEnabled = value;
            return gesture;
        },
        minDistance(value) {
            gesture.minDistanceValue = value;
            return gesture;
        },
        maxPointers(value) {
            gesture.maxPointersValue = value;
            return gesture;
        },
        shouldCancelWhenOutside(value) {
            gesture.cancelWhenOutside = value;
            return gesture;
        },
    };
    return gesture;
};

export const Gesture = {
    Manual: makeManual,
    Pan: makePan,
    Simultaneous: (...gestures: Array<ManualGestureMock | PanGestureMock>): SimultaneousGestureMock => ({
        kind: "simultaneous",
        gestures,
    }),
};

/** Every gesture handed to a `GestureDetector`, newest last. */
export const detectedGestures: SimultaneousGestureMock[] = [];

export function GestureDetector({ gesture, children }: { gesture: SimultaneousGestureMock; children?: ReactNode }) {
    detectedGestures.push(gesture);
    return createElement(Fragment, null, children);
}
GestureDetector.displayName = "GestureDetector";

export function GestureHandlerRootView({ children }: { children?: ReactNode }) {
    return createElement(Fragment, null, children);
}
GestureHandlerRootView.displayName = "GestureHandlerRootView";

const lastGesture = (): SimultaneousGestureMock => {
    const gesture = detectedGestures[detectedGestures.length - 1];
    if (!gesture) {
        throw new Error("gesture-handler mock: no GestureDetector has rendered yet");
    }
    return gesture;
};

/** The Manual touch transport of the most recent render. */
export const transportGesture = (): ManualGestureMock =>
    lastGesture().gestures.find((g): g is ManualGestureMock => g.kind === "manual")!;

/** The callback-less Pan blocker of the most recent render. */
export const blockerGesture = (): PanGestureMock =>
    lastGesture().gestures.find((g): g is PanGestureMock => g.kind === "pan")!;

/** Build a touch stream event. `x`/`y` are view-relative, `absoluteX/Y` screen-relative. */
export function touchEvent(
    all: Array<{ id: number; x: number; y: number }>,
    changed: Array<{ id: number; x: number; y: number }> = all,
): GestureTouchEvent {
    const toTouch = (t: { id: number; x: number; y: number }): TouchData => ({
        id: t.id,
        x: t.x,
        y: t.y,
        // Deliberately different from x/y: the component must forward the
        // view-relative pair, because the Skia canvas bounds getter always
        // reports { left: 0, top: 0 }.
        absoluteX: t.x + 1000,
        absoluteY: t.y + 2000,
    });
    return {
        handlerTag: 1,
        numberOfTouches: all.length,
        state: 4,
        eventType: 0,
        allTouches: all.map(toTouch),
        changedTouches: changed.map(toTouch),
    };
}

/** Reset recorded gestures between tests. */
export function resetGestureMock(): void {
    detectedGestures.length = 0;
}
