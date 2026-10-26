import { describe, expect, it, vi } from "vitest";
import type { Text, TextAlign, TextBaseline } from "@canvas-tile-engine/core";
import { CanvasTextBounds } from "../src/canvas2d/CanvasTextBounds";
import { PaintedCuller, textPaintBounds, UNBOUNDED } from "../src/geometry/paintedBounds";

type InkMetrics = {
    actualBoundingBoxLeft?: number;
    actualBoundingBoxRight?: number;
    actualBoundingBoxAscent?: number;
    actualBoundingBoxDescent?: number;
};
const completeMetrics: InkMetrics = {
    actualBoundingBoxLeft: 30,
    actualBoundingBoxRight: 5,
    actualBoundingBoxAscent: 10,
    actualBoundingBoxDescent: 20,
};
const item: Text = { x: 2, y: 3, text: "label", fontPx: 20 };

function makeContext(metrics: InkMetrics = completeMetrics) {
    const stack: Array<{ font: string; textAlign: TextAlign; textBaseline: TextBaseline }> = [];
    const measureText = vi.fn((_text: string) => metrics);
    const ctx = {
        font: "12px original",
        textAlign: "left" as TextAlign,
        textBaseline: "alphabetic" as TextBaseline,
        direction: "ltr",
        save: vi.fn(() => {
            stack.push({ font: ctx.font, textAlign: ctx.textAlign, textBaseline: ctx.textBaseline });
        }),
        restore: vi.fn(() => {
            Object.assign(ctx, stack.pop());
        }),
        measureText,
    };
    return { ctx, measureText };
}

function makeFontEvents() {
    const listeners = new Map<string, Set<() => void>>();
    const faces: Array<{ status: string }> = [];
    const fonts = {
        status: "loaded",
        addEventListener: vi.fn((type: string, listener: () => void) => {
            if (!listeners.has(type)) {
                listeners.set(type, new Set());
            }
            listeners.get(type)!.add(listener);
        }),
        removeEventListener: vi.fn((type: string, listener: () => void) => {
            listeners.get(type)?.delete(listener);
        }),
        [Symbol.iterator]: () => faces[Symbol.iterator](),
    };
    return {
        fonts,
        faces,
        listeners,
        emit: (type: string) => {
            for (const listener of listeners.get(type) ?? []) {
                listener();
            }
        },
    };
}

describe("CanvasTextBounds", () => {
    it("uses actual ink bearings with a one-pixel antialiasing margin", () => {
        const { ctx, measureText } = makeContext();
        const bounds = new CanvasTextBounds().measure(ctx, item, undefined, 10);
        expect(bounds).toEqual({ minX: -31, minY: -11, maxX: 6, maxY: 21 });
        expect(measureText).toHaveBeenCalledWith("label");
        expect(ctx.font).toBe("12px original");
        expect(ctx.textAlign).toBe("left");
        expect(ctx.textBaseline).toBe("alphabetic");
        expect(ctx.save).toHaveBeenCalledOnce();
        expect(ctx.restore).toHaveBeenCalledOnce();
    });

    it("sets font, alignment and baseline before measuring and rotates the returned bearings", () => {
        const { ctx, measureText } = makeContext();
        measureText.mockImplementation(() => {
            expect(ctx.font).toBe("700 20px TestFamily");
            expect(ctx.textAlign).toBe("right");
            expect(ctx.textBaseline).toBe("top");
            // A right-aligned glyph may finish before the anchor. A top
            // baseline can put the first painted pixel below the anchor.
            return {
                actualBoundingBoxLeft: 120,
                actualBoundingBoxRight: -4,
                actualBoundingBoxAscent: -3,
                actualBoundingBoxDescent: 17,
            };
        });
        const local = new CanvasTextBounds().measure(
            ctx,
            item,
            {
                fontFamily: "TestFamily",
                fontWeight: 700,
                textAlign: "right",
                textBaseline: "top",
            },
            10,
        );
        expect(local).toEqual({ minX: -121, minY: 2, maxX: -3, maxY: 18 });
        const world = textPaintBounds({ ...item, rotate: 90 }, 10, local);
        expect(world.minX).toBeCloseTo(0.7, 10);
        expect(world.minY).toBeCloseTo(-8.6, 10);
        expect(world.maxX).toBeCloseTo(2.3, 10);
        expect(world.maxY).toBeCloseTo(3.2, 10);
    });

    it("disables culling when measureText is unavailable", () => {
        const ctx = {
            save: vi.fn(),
            restore: vi.fn(),
            font: "",
            textAlign: "center" as const,
            textBaseline: "middle" as const,
        };
        expect(new CanvasTextBounds().measure(ctx, item, undefined, 10)).toBe(UNBOUNDED);
        expect(ctx.save).not.toHaveBeenCalled();
    });

    it.each([
        {},
        { actualBoundingBoxLeft: 30 },
        { ...completeMetrics, actualBoundingBoxLeft: undefined },
        { ...completeMetrics, actualBoundingBoxRight: NaN },
        { ...completeMetrics, actualBoundingBoxAscent: Infinity },
        { ...completeMetrics, actualBoundingBoxDescent: -Infinity },
    ])("disables culling for incomplete or nonfinite ink metrics (%j)", (metrics) => {
        const { ctx } = makeContext(metrics);
        expect(new CanvasTextBounds().measure(ctx, item, undefined, 10)).toBe(UNBOUNDED);
    });

    it("does not infer ink bounds from advance width alone", () => {
        const { ctx, measureText } = makeContext();
        measureText.mockReturnValue({ width: 100 } as InkMetrics);
        expect(new CanvasTextBounds().measure(ctx, item, undefined, 10)).toBe(UNBOUNDED);
    });

    it("reuses cached metrics for repeated text and decoration changes that cannot affect ink", () => {
        const { ctx, measureText } = makeContext();
        const measuring = new CanvasTextBounds();
        const bounds = measuring.measure(ctx, item, { fillStyle: "red" }, 10);
        expect(measuring.measure(ctx, item, { fillStyle: "blue" }, 10)).toBe(bounds);
        expect(measuring.measure(ctx, { ...item, x: 100, y: -100, rotate: 45 }, undefined, 10)).toBe(bounds);
        expect(measureText).toHaveBeenCalledOnce();
    });

    it.each([
        { name: "text", changedItem: { ...item, text: "other" } },
        { name: "font size", changedItem: { ...item, fontPx: 30 } },
        { name: "font family", style: { fontFamily: "serif" } },
        { name: "font weight", style: { fontWeight: "bold" as const } },
        { name: "alignment", style: { textAlign: "right" as const } },
        { name: "baseline", style: { textBaseline: "bottom" as const } },
        { name: "direction", direction: "rtl" },
    ])("remeasures when $name changes", ({ changedItem, style, direction }) => {
        const { ctx, measureText } = makeContext();
        const measuring = new CanvasTextBounds();
        measuring.measure(ctx, item, undefined, 10);
        if (direction) {
            ctx.direction = direction;
        }
        measuring.measure(ctx, changedItem ?? item, style, 10);
        expect(measureText).toHaveBeenCalledTimes(2);
    });

    it("uses scaled world font sizes but reuses fixed-pixel metrics across zoom levels", () => {
        const { ctx, measureText } = makeContext();
        const measuredFonts: string[] = [];
        measureText.mockImplementation(() => {
            measuredFonts.push(ctx.font);
            return completeMetrics;
        });
        const measuring = new CanvasTextBounds();
        measuring.measure(ctx, { ...item, fontPx: undefined, size: 2 }, undefined, 10);
        measuring.measure(ctx, { ...item, fontPx: undefined, size: 2 }, undefined, 20);
        expect(measuredFonts).toEqual(["20px sans-serif", "40px sans-serif"]);
        // fontPx=20 resolves to the first cache entry, regardless of scale.
        measuring.measure(ctx, item, undefined, 10);
        measuring.measure(ctx, item, undefined, 20);
        expect(measureText).toHaveBeenCalledTimes(2);
    });

    it("keeps each drawing context's metrics separate", () => {
        const first = makeContext();
        const second = makeContext({ ...completeMetrics, actualBoundingBoxRight: 100 });
        const measuring = new CanvasTextBounds();
        expect(measuring.measure(first.ctx, item, undefined, 10).maxX).toBe(6);
        expect(measuring.measure(second.ctx, item, undefined, 10).maxX).toBe(101);
        expect(first.measureText).toHaveBeenCalledOnce();
        expect(second.measureText).toHaveBeenCalledOnce();
    });

    it.each(["loadingdone", "loadingerror"])("invalidates measurements and the same-scale index after %s", (event) => {
        const { fonts, emit } = makeFontEvents();
        const { ctx, measureText } = makeContext();
        Object.assign(ctx, { canvas: { ownerDocument: { fonts } } });
        let inkLeft = 10;
        measureText.mockImplementation(() => ({
            actualBoundingBoxLeft: inkLeft,
            actualBoundingBoxRight: 0,
            actualBoundingBoxAscent: 5,
            actualBoundingBoxDescent: 5,
        }));
        const measuring = new CanvasTextBounds();
        const subject: Text = { ...item, x: 20, y: 0, style: { textAlign: "right" } };
        const items = [subject, ...Array.from({ length: 500 }, (_, n) => ({ ...subject, x: 10000 + n }))];
        const boundsOf = vi.fn((entry: Text, scale: number) =>
            textPaintBounds(entry, scale, measuring.measure(ctx, entry, entry.style, scale)),
        );
        const culler = new PaintedCuller(items, boundsOf);
        const viewport = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
        const before = measuring.getRevision(ctx);
        expect(culler.query(viewport, 10, before)).toEqual([]);
        expect(culler.query(viewport, 10, measuring.getRevision(ctx))).toEqual([]);
        expect(boundsOf).toHaveBeenCalledTimes(501);
        expect(measureText).toHaveBeenCalledOnce();

        inkLeft = 200;
        emit(event);
        const after = measuring.getRevision(ctx);
        expect(after).toBeGreaterThan(before);
        expect(culler.query(viewport, 10, after)).toEqual([subject]);
        expect(boundsOf).toHaveBeenCalledTimes(1002);
        expect(measureText).toHaveBeenCalledTimes(2);
        expect(fonts.addEventListener).toHaveBeenCalledTimes(2);
    });

    it("detects font-set and face changes before an asynchronous loading event arrives", () => {
        const { fonts, faces } = makeFontEvents();
        const { ctx, measureText } = makeContext();
        Object.assign(ctx, { canvas: { ownerDocument: { fonts } } });
        const measuring = new CanvasTextBounds();
        let revision = measuring.getRevision(ctx);
        measuring.measure(ctx, item, undefined, 10);
        const verifyInvalidation = () => {
            const next = measuring.getRevision(ctx);
            expect(next).toBeGreaterThan(revision);
            revision = next;
            measuring.measure(ctx, item, undefined, 10);
        };
        fonts.status = "loading";
        verifyInvalidation();
        faces.push({ status: "unloaded" });
        verifyInvalidation();
        faces[0].status = "loaded";
        verifyInvalidation();
        faces[0] = { status: "loaded" };
        verifyInvalidation();
        expect(measureText).toHaveBeenCalledTimes(5);
        expect(measuring.getRevision(ctx)).toBe(revision);
    });

    it.each([
        "direction",
        "letterSpacing",
        "wordSpacing",
        "fontKerning",
        "fontStretch",
        "fontVariantCaps",
        "textRendering",
    ])("invalidates text metrics and the index revision when inherited %s changes", (property) => {
        const { ctx, measureText } = makeContext();
        Object.assign(ctx, { [property]: "initial" });
        const measuring = new CanvasTextBounds();
        const before = measuring.getRevision(ctx);
        measuring.measure(ctx, item, undefined, 10);
        Object.assign(ctx, { [property]: "changed" });
        expect(measuring.getRevision(ctx)).toBeGreaterThan(before);
        measuring.measure(ctx, item, undefined, 10);
        expect(measureText).toHaveBeenCalledTimes(2);
    });

    it("clears metrics and removes both font listeners", () => {
        const { fonts, listeners } = makeFontEvents();
        const { ctx, measureText } = makeContext();
        Object.assign(ctx, { canvas: { ownerDocument: { fonts } } });
        const measuring = new CanvasTextBounds();
        measuring.measure(ctx, item, undefined, 10);
        measuring.measure(ctx, item, undefined, 10);
        expect(fonts.addEventListener).toHaveBeenCalledTimes(2);
        expect(measureText).toHaveBeenCalledOnce();
        measuring.clear();
        for (const [event, callback] of fonts.addEventListener.mock.calls) {
            expect(fonts.removeEventListener).toHaveBeenCalledWith(event, callback);
            expect(listeners.get(event)?.size).toBe(0);
        }
        expect(fonts.removeEventListener).toHaveBeenCalledTimes(2);
        measuring.measure(ctx, item, undefined, 10);
        expect(measureText).toHaveBeenCalledTimes(2);
        expect(fonts.addEventListener).toHaveBeenCalledTimes(4);
    });

    it("restores context state even when the platform measurement throws", () => {
        const { ctx, measureText } = makeContext();
        measureText.mockImplementation(() => {
            throw new Error("measurement failed");
        });
        expect(() => new CanvasTextBounds().measure(ctx, item, { textAlign: "right" }, 10)).toThrow(
            "measurement failed",
        );
        expect(ctx.font).toBe("12px original");
        expect(ctx.textAlign).toBe("left");
        expect(ctx.textBaseline).toBe("alphabetic");
        expect(ctx.restore).toHaveBeenCalledOnce();
    });
});
