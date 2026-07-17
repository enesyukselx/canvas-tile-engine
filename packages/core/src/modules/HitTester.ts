import { Circle, Coords, DrawHandle, ImageItem, Rect } from "../types";
import { SpatialIndex } from "./SpatialIndex";

/** Primitive kinds that participate in hit testing. */
export type HitKind = "rect" | "circle" | "image";

/** A single hit returned by `hitTest`, ordered by visual priority. */
export type HitResult<TImage = unknown, TData = unknown> = {
    /** The original item object passed to the draw call. */
    item: Rect<TData> | Circle<TData> | ImageItem<TImage, TData>;
    /** Which primitive kind the item was drawn as. */
    kind: HitKind;
    /** Layer the item is drawn on. */
    layer: number;
    /** Handle of the draw call that registered the item. */
    handle: DrawHandle;
    /** Position of the item inside its draw call's items array. */
    index: number;
};

export type HitTestOptions = {
    /** Only test items drawn on this layer. */
    layer?: number;
    /**
     * Expand every item's hit geometry outward by this many world units -
     * generous touch targets around small markers without invisible helper
     * items. Negative values are treated as 0.
     */
    padding?: number;
    /**
     * Extra hit padding in screen pixels, independent of zoom. The engine
     * converts it with the current scale at query time and adds it to
     * `padding`. Negative values are treated as 0.
     */
    paddingPx?: number;
};

type HitItem = Rect | Circle | ImageItem<unknown>;

type HitEntry = {
    handle: DrawHandle;
    kind: HitKind;
    layer: number;
    items: HitItem[];
    /** Registration order; later registrations draw on top within a layer. */
    seq: number;
    /** Largest item size, for safe spatial query padding. */
    maxSize: number;
    /** Lazy R-Tree over item anchors, built on the first query of a large entry. */
    index?: SpatialIndex<HitItem> | null;
    /** Item object -> position in `items`, built alongside the lazy index. */
    indexMap?: Map<HitItem, number>;
};

// Same threshold the renderers use for culling: linear scan is faster below it.
const SPATIAL_INDEX_THRESHOLD = 500;

/**
 * Core-side registry answering "which item is under this world point?".
 *
 * Maintained by the engine's draw delegations, so no renderer participates.
 * Geometry mirrors the renderers' drawing math (origin anchoring, image
 * aspect fit, rotation) in world units. Like rendering itself, results
 * reflect item positions as of the draw call - mutating positions requires
 * re-registration.
 *
 * Points are expected in ITEM space (integers are cell centers). Event
 * payloads report `coords.raw` in corner space - the cell of item `k` spans
 * `[k, k+1]` there - so the engine shifts by the cell-center offset before
 * calling in (see `CanvasTileEngine.rawToItemSpace`).
 *
 * Only `layer` and `padding` (world units) are read here; `paddingPx` is an
 * engine-level convenience that `CanvasTileEngine` converts with the current
 * scale and folds into `padding` before delegating (this module is
 * scale-unaware, like the rest of its geometry).
 * @internal
 */
export class HitTester {
    private entries = new Map<symbol, HitEntry>();
    private nextSeq = 0;

    /**
     * Live camera scale accessor. The registry's geometry is world-space and
     * scale-free, but screen-pixel style values (`lineWidthPx`, future
     * `sizePx`) must resolve against the current scale at query time.
     */
    constructor(private getScale: () => number = () => 1) {}

    register(handle: DrawHandle, kind: HitKind, items: HitItem | HitItem[], layer: number): void {
        const list = Array.isArray(items) ? items : [items];
        let maxSize = 0;
        for (const item of list) {
            const rect = item as Rect;
            const extent = Math.max(item.size ?? 1, rect.width ?? 0, rect.height ?? 0);
            if (extent > maxSize) maxSize = extent;
        }
        this.entries.set(handle.id, { handle, kind, layer, items: list, seq: this.nextSeq++, maxSize });
    }

    remove(handle: DrawHandle): void {
        this.entries.delete(handle.id);
    }

    clearLayer(layer: number): void {
        for (const [id, entry] of this.entries) {
            if (entry.layer === layer) this.entries.delete(id);
        }
    }

    clear(): void {
        this.entries.clear();
    }

    /** All items under `point` (world coords), highest visual priority first. */
    hitTest<TData = unknown>(point: Coords, opts?: HitTestOptions): HitResult<unknown, TData>[] {
        const results: Array<HitResult & { seq: number }> = [];
        const padding = Math.max(0, opts?.padding ?? 0);

        for (const entry of this.entries.values()) {
            if (opts?.layer !== undefined && entry.layer !== opts.layer) continue;

            if (entry.items.length > SPATIAL_INDEX_THRESHOLD) {
                this.ensureIndex(entry);
                // The index stores anchor-centered boxes; origin modes shift the
                // drawn box by up to half a cell (or half the item size), so pad
                // the query enough to never miss an edge candidate.
                const pad = 0.5 + entry.maxSize + padding;
                const candidates = entry.index!.query(point.x - pad, point.y - pad, point.x + pad, point.y + pad);
                for (const item of candidates) {
                    if (!this.testItem(point, item, entry.kind, padding)) continue;
                    results.push({
                        item,
                        kind: entry.kind,
                        layer: entry.layer,
                        handle: entry.handle,
                        index: entry.indexMap!.get(item)!,
                        seq: entry.seq,
                    });
                }
            } else {
                for (let i = 0; i < entry.items.length; i++) {
                    const item = entry.items[i];
                    if (!this.testItem(point, item, entry.kind, padding)) continue;
                    results.push({
                        item,
                        kind: entry.kind,
                        layer: entry.layer,
                        handle: entry.handle,
                        index: i,
                        seq: entry.seq,
                    });
                }
            }
        }

        // Visual priority: higher layer first; within a layer, later
        // registration first; within a draw call, later item first.
        results.sort((a, b) => b.layer - a.layer || b.seq - a.seq || b.index - a.index);
        // TData is caller-asserted: the registry stores items as unknown-data.
        return results.map(({ seq: _seq, ...hit }) => hit) as HitResult<unknown, TData>[];
    }

    /** The topmost item under `point`, or undefined. */
    hitTestFirst<TData = unknown>(point: Coords, opts?: HitTestOptions): HitResult<unknown, TData> | undefined {
        return this.hitTest<TData>(point, opts)[0];
    }

    private ensureIndex(entry: HitEntry): void {
        if (entry.index !== undefined) return;
        entry.index = SpatialIndex.fromArray(entry.items);
        entry.indexMap = new Map(entry.items.map((item, i) => [item, i]));
    }

    /** World-space box the item is drawn into, mirroring the renderers' math. */
    private boxFor(item: HitItem, kind: HitKind): { left: number; top: number; w: number; h: number } {
        const size = item.size ?? 1;
        // Only rects support per-axis dimensions; circle stays size (diameter)
        // and image keeps its aspect-fit size box below.
        const rect = item as Rect;
        const w = kind === "rect" ? (rect.width ?? size) : size;
        const h = kind === "rect" ? (rect.height ?? size) : size;
        const mode = item.origin?.mode === "self" ? "self" : "cell";
        const ox = item.origin?.x ?? 0.5;
        const oy = item.origin?.y ?? 0.5;

        // World-unit mirror of the renderers' computeOriginOffset (px = world * scale)
        const left = mode === "cell" ? item.x - 0.5 + ox - w / 2 : item.x - ox * w;
        const top = mode === "cell" ? item.y - 0.5 + oy - h / 2 : item.y - oy * h;

        if (kind !== "image") return { left, top, w, h };

        // Images are aspect-fit inside the size box (mirror of the draw path)
        const image = item as ImageItem<unknown>;
        const dims = this.imageDims(image);
        if (!dims) return { left, top, w: size, h: size };

        const aspect = dims.w / dims.h;
        let fitW = size;
        let fitH = size;
        if (aspect > 1) fitH = size / aspect;
        else fitW = size * aspect;

        return { left: left + (size - fitW) / 2, top: top + (size - fitH) / 2, w: fitW, h: fitH };
    }

    /** Source dimensions: the sprite frame when set, else the image itself. */
    private imageDims(item: ImageItem<unknown>): { w: number; h: number } | null {
        if (item.sprite) return { w: item.sprite.w, h: item.sprite.h };
        // Platform image handles differ: DOM/napi expose width/height as numbers,
        // Skia's SkImage exposes them as methods. Duck-type both.
        const img = item.img as { width?: number | (() => number); height?: number | (() => number) } | undefined;
        if (!img) return null;
        const w = typeof img.width === "function" ? img.width() : img.width;
        const h = typeof img.height === "function" ? img.height() : img.height;
        if (typeof w !== "number" || typeof h !== "number" || !w || !h) return null;
        return { w, h };
    }

    private testItem(point: Coords, item: HitItem, kind: HitKind, padding: number): boolean {
        const box = this.boxFor(item, kind);

        if (kind === "circle") {
            const cx = box.left + box.w / 2;
            const cy = box.top + box.h / 2;
            const r = box.w / 2 + padding;
            const dx = point.x - cx;
            const dy = point.y - cy;
            return dx * dx + dy * dy <= r * r;
        }

        let px = point.x;
        let py = point.y;

        // Rects and images rotate around the box center; inverse-rotate the point
        const rotate = (item as Rect).rotate ?? 0;
        if (rotate !== 0) {
            const cx = box.left + box.w / 2;
            const cy = box.top + box.h / 2;
            const rad = (-rotate * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            const dx = point.x - cx;
            const dy = point.y - cy;
            px = cx + dx * cos - dy * sin;
            py = cy + dx * sin + dy * cos;
        }

        // Padding expands the box in the item's own (rotated) frame, so the
        // inverse-rotated point comparison above keeps working unchanged.
        return (
            px >= box.left - padding &&
            px <= box.left + box.w + padding &&
            py >= box.top - padding &&
            py <= box.top + box.h + padding
        );
    }
}
