/**
 * Minimal runtime mock of `@shopify/react-native-skia`. Wired in via
 * `resolve.alias` in vitest.config.mts — the real module needs native (or
 * WASM) bindings that do not exist under node/jsdom.
 *
 * Only what the React Native binding touches at runtime is stubbed: the
 * `<Canvas>`/`<Picture>` presentation pair and `createPicture`. Everything the
 * binding imports from Skia beyond that is type-only.
 */
import { createElement, Fragment, type ReactNode } from "react";

export interface MockSize {
    width: number;
    height: number;
}

export interface MockPicture {
    readonly __picture: true;
    size?: MockSize;
    ops: string[];
}

/** Canvas handed to a frame painter; records the op names it receives. */
export function makeRecordingCanvas(ops: string[]) {
    const record =
        (op: string) =>
        (...args: unknown[]) => {
            ops.push(`${op}:${args.length}`);
        };
    return {
        save: () => ops.length,
        restore: record("restore"),
        restoreToCount: record("restoreToCount"),
        translate: record("translate"),
        scale: record("scale"),
        rotate: record("rotate"),
        drawRect: record("drawRect"),
        drawRRect: record("drawRRect"),
        drawCircle: record("drawCircle"),
        drawLine: record("drawLine"),
        drawText: record("drawText"),
        drawPath: record("drawPath"),
        drawImageRect: record("drawImageRect"),
        drawPicture: record("drawPicture"),
    };
}

/** Every picture recorded through `createPicture`, newest last. */
export const createdPictures: MockPicture[] = [];

export function createPicture(paint: (canvas: unknown) => void, size?: MockSize): MockPicture {
    const ops: string[] = [];
    paint(makeRecordingCanvas(ops));
    const picture: MockPicture = { __picture: true, size, ops };
    createdPictures.push(picture);
    return picture;
}

export interface CanvasProps {
    style?: unknown;
    pointerEvents?: string;
    children?: ReactNode;
}

/** Props of every `<Canvas>` render, newest last. */
export const canvasProps: CanvasProps[] = [];

export function Canvas(props: CanvasProps) {
    canvasProps.push(props);
    return createElement(Fragment, null, props.children);
}
Canvas.displayName = "Canvas";

/** Pictures handed to `<Picture>`, newest last — i.e. what would be on screen. */
export const presentedPictures: MockPicture[] = [];

export function Picture({ picture }: { picture: MockPicture }) {
    presentedPictures.push(picture);
    return null;
}
Picture.displayName = "Picture";

/** Reset recorded render state between tests. */
export function resetSkiaMock(): void {
    createdPictures.length = 0;
    canvasProps.length = 0;
    presentedPictures.length = 0;
}
