import type { Bounds, Text } from "@canvas-tile-engine/core";
import { LruCache } from "../cache/lru";
import { UNBOUNDED } from "../geometry/paintedBounds";
import type { Canvas2DContextLike } from "./types";

type MeasuringContext = Pick<
    Canvas2DContextLike,
    | "save"
    | "restore"
    | "font"
    | "textAlign"
    | "textBaseline"
    | "measureText"
    | "direction"
    | "letterSpacing"
    | "wordSpacing"
    | "fontKerning"
    | "fontStretch"
    | "fontVariantCaps"
    | "textRendering"
    | "canvas"
>;

interface FontEvents {
    addEventListener(type: string, listener: () => void): void;
    removeEventListener(type: string, listener: () => void): void;
    readonly status?: string;
    [Symbol.iterator]?(): IterableIterator<{ readonly status: string }>;
}

function layoutKey(ctx: MeasuringContext): string {
    const canvas = ctx.canvas as
        | {
              ownerDocument?: { defaultView?: { getComputedStyle(element: object): { direction: string } } };
          }
        | undefined;
    const inheritedDirection =
        ctx.direction === "inherit" && canvas
            ? canvas.ownerDocument?.defaultView?.getComputedStyle(canvas).direction
            : undefined;
    return JSON.stringify([
        ctx.direction,
        inheritedDirection,
        ctx.letterSpacing,
        ctx.wordSpacing,
        ctx.fontKerning,
        ctx.fontStretch,
        ctx.fontVariantCaps,
        ctx.textRendering,
    ]);
}

/** Shared by browser/server Canvas2D and the WebGL text overlay. */
export class CanvasTextBounds {
    private contexts = new WeakMap<MeasuringContext, LruCache<string, Bounds>>();
    private fontSources = new Map<FontEvents, { status?: string; faces: object[]; states: string[] }>();
    private layouts = new WeakMap<MeasuringContext, string>();
    private revision = 0;
    private invalidate = () => {
        this.contexts = new WeakMap();
        this.revision++;
    };

    /** Font loading can replace fallback glyphs without changing font/scale. */
    private observe(ctx: MeasuringContext): FontEvents | undefined {
        const fonts = (ctx.canvas as { ownerDocument?: { fonts?: FontEvents } } | undefined)?.ownerDocument?.fonts;
        if (fonts && !this.fontSources.has(fonts)) {
            fonts.addEventListener("loadingdone", this.invalidate);
            fonts.addEventListener("loadingerror", this.invalidate);
            this.fontSources.set(fonts, { faces: [], states: [] });
        }
        return fonts;
    }

    getRevision(ctx: MeasuringContext): number {
        const fonts = this.observe(ctx);
        if (fonts) {
            const previous = this.fontSources.get(fonts)!;
            const faces = fonts[Symbol.iterator] ? Array.from(fonts as Iterable<{ readonly status: string }>) : [];
            if (
                previous.status !== fonts.status ||
                previous.faces.length !== faces.length ||
                faces.some((face, i) => face !== previous.faces[i] || face.status !== previous.states[i])
            ) {
                this.invalidate();
                this.fontSources.set(fonts, { status: fonts.status, faces, states: faces.map((face) => face.status) });
            }
        }
        const layout = layoutKey(ctx);
        if (this.layouts.get(ctx) !== layout) {
            this.layouts.set(ctx, layout);
            this.revision++;
        }
        return this.revision;
    }

    clear(): void {
        for (const fonts of this.fontSources.keys()) {
            fonts.removeEventListener("loadingdone", this.invalidate);
            fonts.removeEventListener("loadingerror", this.invalidate);
        }
        this.fontSources.clear();
        this.layouts = new WeakMap();
        this.invalidate();
    }

    measure(ctx: MeasuringContext, item: Text, style: Text["style"], scale: number): Bounds {
        this.observe(ctx);
        if (!ctx.measureText) {
            return UNBOUNDED;
        }
        const pxSize = item.fontPx ?? (item.size ?? 1) * scale;
        const family = style?.fontFamily ?? "sans-serif";
        const font =
            style?.fontWeight !== undefined ? `${style.fontWeight} ${pxSize}px ${family}` : `${pxSize}px ${family}`;
        const align = style?.textAlign ?? "center";
        const baseline = style?.textBaseline ?? "middle";
        const key = JSON.stringify([font, item.text, align, baseline, layoutKey(ctx)]);
        let cache = this.contexts.get(ctx);
        if (!cache) {
            cache = new LruCache(8192);
            this.contexts.set(ctx, cache);
        }
        const cached = cache.get(key);
        if (cached) {
            return cached;
        }
        ctx.save();
        let bounds: Bounds;
        try {
            ctx.font = font;
            ctx.textAlign = align;
            ctx.textBaseline = baseline;
            const metrics = ctx.measureText(item.text);
            const values = [
                metrics.actualBoundingBoxLeft,
                metrics.actualBoundingBoxRight,
                metrics.actualBoundingBoxAscent,
                metrics.actualBoundingBoxDescent,
            ];
            // Width alone cannot bound overhanging glyphs or vertical ink.
            // Missing metrics deliberately disable culling for this text.
            bounds = values.every((value) => typeof value === "number" && Number.isFinite(value))
                ? {
                      minX: -metrics.actualBoundingBoxLeft! - 1,
                      minY: -metrics.actualBoundingBoxAscent! - 1,
                      maxX: metrics.actualBoundingBoxRight! + 1,
                      maxY: metrics.actualBoundingBoxDescent! + 1,
                  }
                : UNBOUNDED;
        } finally {
            ctx.restore();
        }
        cache.set(key, bounds);
        return bounds;
    }
}
