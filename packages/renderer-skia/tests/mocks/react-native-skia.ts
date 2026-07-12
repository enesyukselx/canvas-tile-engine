/**
 * Minimal runtime mock of `@shopify/react-native-skia` for node tests.
 * Wired in via `resolve.alias` in vitest.config.mts — the real module
 * requires native bindings that don't exist in a node environment.
 */

export const PaintStyle = { Fill: 0, Stroke: 1 };

export interface MockPaint {
    style: number;
    color: unknown;
    strokeWidth: number;
    alphaf: number;
    setAntiAlias(v: boolean): void;
    setStyle(v: number): void;
    setColor(c: unknown): void;
    setStrokeWidth(w: number): void;
    setAlphaf(a: number): void;
}

const makePaint = (): MockPaint => {
    const paint: MockPaint = {
        style: 0,
        color: undefined,
        strokeWidth: 1,
        alphaf: 1,
        setAntiAlias() {},
        setStyle(v: number) {
            paint.style = v;
        },
        setColor(c: unknown) {
            paint.color = c;
        },
        setStrokeWidth(w: number) {
            paint.strokeWidth = w;
        },
        setAlphaf(a: number) {
            paint.alphaf = a;
        },
    };
    return paint;
};

/** Every string passed to Skia.Color, for asserting parse/cache behavior. */
export const colorParseCalls: string[] = [];

export interface MockOp {
    op: string;
    [key: string]: unknown;
}

export interface MockPicture {
    __picture: true;
    bounds: unknown;
    ops: MockOp[];
}

/**
 * Op-recording canvas used by the PictureRecorder mock (and reusable from
 * tests as a frame canvas). Paint state is captured at call time, mirroring
 * Skia's snapshot-on-record semantics.
 */
export function makeRecordingCanvas() {
    const ops: MockOp[] = [];
    const canvas = {
        save: () => ops.length,
        restoreToCount() {},
        rotate(deg: number, px: number, py: number) {
            ops.push({ op: "rotate", deg, px, py });
        },
        translate(x: number, y: number) {
            ops.push({ op: "translate", x, y });
        },
        scale(sx: number, sy: number) {
            ops.push({ op: "scale", sx, sy });
        },
        drawRect(rect: unknown, paint: MockPaint) {
            ops.push({ op: "rect", rect, style: paint.style, color: paint.color, strokeWidth: paint.strokeWidth });
        },
        drawRRect(rrect: unknown, paint: MockPaint) {
            ops.push({ op: "rrect", rrect, style: paint.style, color: paint.color });
        },
        drawCircle(cx: number, cy: number, r: number, paint: MockPaint) {
            ops.push({ op: "circle", cx, cy, r, style: paint.style, strokeWidth: paint.strokeWidth });
        },
        drawLine(x1: number, y1: number, x2: number, y2: number, paint: MockPaint) {
            ops.push({ op: "line", x1, y1, x2, y2, strokeWidth: paint.strokeWidth });
        },
        drawText(text: string, x: number, y: number, _paint: MockPaint, font: { size: number }) {
            ops.push({ op: "text", text, x, y, fontSize: font.size });
        },
        drawPath() {
            ops.push({ op: "path" });
        },
        drawImageRect(img: unknown, src: unknown, dest: unknown, paint: MockPaint) {
            ops.push({ op: "image", img, src, dest, alpha: paint.alphaf });
        },
        drawPicture(picture: MockPicture) {
            ops.push({ op: "picture", picture });
        },
    };
    return { canvas, ops };
}

export const Skia = {
    Paint: makePaint,
    Color: (value: string) => {
        colorParseCalls.push(value);
        return { parsed: value };
    },
    XYWHRect: (x: number, y: number, width: number, height: number) => ({ x, y, width, height }),
    RRectXY: (rect: unknown, rx: number, ry: number) => ({ rect, rx, ry }),
    Path: {
        Make: () => {
            const segments: Array<[string, number, number]> = [];
            return {
                segments,
                moveTo(x: number, y: number) {
                    segments.push(["M", x, y]);
                },
                lineTo(x: number, y: number) {
                    segments.push(["L", x, y]);
                },
            };
        },
    },
    PictureRecorder: () => {
        let recording: { canvas: unknown; ops: MockOp[] } | null = null;
        let bounds: unknown;
        return {
            beginRecording(cullRect?: unknown) {
                recording = makeRecordingCanvas();
                bounds = cullRect;
                return recording.canvas;
            },
            finishRecordingAsPicture(): MockPicture {
                return { __picture: true, bounds, ops: recording?.ops ?? [] };
            },
        };
    },
};

export interface MockFont {
    size: number;
    setSize(s: number): void;
    measureText(text: string): { x: number; y: number; width: number; height: number };
    getMetrics(): { ascent: number; descent: number };
}

/** Every style passed to matchFont, for asserting font cache behavior. */
export const matchFontCalls: Array<{ fontFamily: string; fontSize: number }> = [];

export const matchFont = (style: { fontFamily: string; fontSize: number }): MockFont => {
    matchFontCalls.push(style);
    const font: MockFont = {
        size: style.fontSize,
        setSize(s: number) {
            font.size = s;
        },
        measureText: (text: string) => ({ x: 0, y: 0, width: text.length * 6, height: 10 }),
        getMetrics: () => ({ ascent: -8, descent: 2 }),
    };
    return font;
};
