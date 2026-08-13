/**
 * Minimal runtime mock of `react-native` for the component tests. Wired in via
 * `resolve.alias` in vitest.config.mts — the real package ships Flow-typed
 * source that vitest's esbuild transform cannot parse, and its primitives need
 * a native host anyway.
 *
 * `View` renders no host element: the tree under test is components only, so
 * react-dom has nothing to lay out and jsdom is never asked to render a native
 * surface. Props are recorded instead, which is what tests drive (`onLayout`).
 */
import { createElement, Fragment, type ReactNode } from "react";

export interface LayoutRectangle {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface LayoutChangeEvent {
    nativeEvent: { layout: LayoutRectangle };
}

export type ViewStyle = Record<string, unknown>;

export interface ViewProps {
    style?: unknown;
    onLayout?: (event: LayoutChangeEvent) => void;
    pointerEvents?: string;
    children?: ReactNode;
}

/** Props of every `View` render, newest last. */
export const viewProps: ViewProps[] = [];

export function View(props: ViewProps) {
    viewProps.push(props);
    return createElement(Fragment, null, props.children);
}
View.displayName = "View";

export const StyleSheet = {
    create: <T extends Record<string, unknown>>(styles: T): T => styles,
    flatten: (style: unknown) => style,
};

/** Device pixel ratio reported to the engine mount; arbitrary but not 1. */
export const PixelRatio = {
    get: () => 3,
    getFontScale: () => 1,
    roundToNearestPixel: (n: number) => Math.round(n),
};

export const Platform = {
    OS: "android",
    select<T>(spec: { ios?: T; android?: T; default?: T }): T {
        return (spec.android ?? spec.default) as T;
    },
};

/** Fire `onLayout` on the most recently rendered View. Wrap calls in `act`. */
export function emitLayout(width: number, height: number, x = 0, y = 0): void {
    const onLayout = viewProps[viewProps.length - 1]?.onLayout;
    if (!onLayout) {
        throw new Error("react-native mock: no View with onLayout has rendered yet");
    }
    onLayout({ nativeEvent: { layout: { x, y, width, height } } });
}

/** Reset recorded props between tests. */
export function resetReactNativeMock(): void {
    viewProps.length = 0;
}
