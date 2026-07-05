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
    setAntiAlias(v: boolean): void;
    setStyle(v: number): void;
    setColor(c: unknown): void;
    setStrokeWidth(w: number): void;
}

const makePaint = (): MockPaint => {
    const paint: MockPaint = {
        style: 0,
        color: undefined,
        strokeWidth: 1,
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
    };
    return paint;
};

/** Every string passed to Skia.Color, for asserting parse/cache behavior. */
export const colorParseCalls: string[] = [];

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
