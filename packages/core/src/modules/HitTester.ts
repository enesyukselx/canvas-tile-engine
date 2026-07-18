import { Circle, Coords, DrawHandle, ImageItem, Line, LineStyle, PathCommand, PathItem, Rect } from "../types";
import { distanceToPolyline, pointInRing, pointInRings } from "../utils/pathGeometry";
import { flattenPathCommands, type Subpath } from "../utils/flattenPath";
import { ARC_SEGMENT_LENGTH, roundedPolyline, roundedRing } from "../utils/pathFlatten";
import { resolveCornerRadiusPx, resolveLineWidthPx } from "../utils/strokeStyle";
import { resolveSizeWorld } from "../utils/itemSize";
import { SpatialIndex } from "./SpatialIndex";

/** Primitive kinds that participate in hit testing. */
export type HitKind = "rect" | "circle" | "image" | "path" | "line";

/** A single hit returned by `hitTest`, ordered by visual priority. */
export type HitResult<TImage = unknown, TData = unknown> = {
    /** The original item object passed to the draw call. */
    item: Rect<TData> | Circle<TData> | ImageItem<TImage, TData> | PathItem<TData> | Line<TData>;
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

type HitItem = Rect | Circle | ImageItem<unknown> | PathItem | Line;
type BoxedItem = Rect | Circle | ImageItem<unknown>;

type HitEntry = {
    handle: DrawHandle;
    kind: HitKind;
    layer: number;
    items: HitItem[];
    /** Registration order; later registrations draw on top within a layer. */
    seq: number;
    /** Largest world-unit item size, for safe spatial query padding. */
    maxSize: number;
    /** Largest `sizePx`; its world extent depends on the scale at query time. */
    maxSizePx: number;
    /** Static draw calls replay at a recorded scale, so `sizePx` is ignored
     * for them — the hit box must match what is actually drawn. */
    ignoreSizePx?: boolean;
    /** Call-level stroke style (line entries only; path items carry their own). */
    style?: LineStyle;
    /** Lazy R-Tree over item anchors, built on the first query of a large entry. */
    index?: SpatialIndex<BoxedItem> | null;
    /** Item object -> position in `items`, built alongside the lazy index. */
    indexMap?: Map<HitItem, number>;
};

// Same threshold the renderers use for culling: linear scan is faster below it.
const SPATIAL_INDEX_THRESHOLD = 500;

// Stroke hit tests treat the line as at least this wide (screen pixels), so
// hairline strokes stay tappable at any zoom without the caller needing
// `paddingPx` for the common case.
const MIN_STROKE_HIT_WIDTH_PX = 8;

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

    register(
        handle: DrawHandle,
        kind: HitKind,
        items: HitItem | HitItem[],
        layer: number,
        opts?: { style?: LineStyle; ignoreSizePx?: boolean },
    ): void {
        const list = Array.isArray(items) ? items : [items];
        let maxSize = 0;
        let maxSizePx = 0;
        if (kind !== "path" && kind !== "line") {
            for (const item of list) {
                const rect = item as Rect;
                const extent = Math.max(rect.size ?? 1, rect.width ?? 0, rect.height ?? 0);
                if (extent > maxSize) maxSize = extent;
                const sizePx = (item as Circle).sizePx ?? 0;
                if (sizePx > maxSizePx) maxSizePx = sizePx;
            }
        }
        this.entries.set(handle.id, {
            handle,
            kind,
            layer,
            items: list,
            seq: this.nextSeq++,
            maxSize,
            maxSizePx,
            ignoreSizePx: opts?.ignoreSizePx,
            style: opts?.style,
        });
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

            // Paths and lines have no single anchor point for the R-Tree;
            // they always linear-scan (typically few, geometry-heavy items).
            const indexable = entry.kind !== "path" && entry.kind !== "line";

            if (indexable && entry.items.length > SPATIAL_INDEX_THRESHOLD) {
                this.ensureIndex(entry);
                // The index stores anchor-centered boxes; origin modes shift the
                // drawn box by up to half a cell (or half the item size), so pad
                // the query enough to never miss an edge candidate. sizePx
                // extents are scale-dependent (they grow as the camera zooms
                // out), so they join the pad at query time, never cached.
                const sizePxPad = entry.ignoreSizePx ? 0 : entry.maxSizePx / this.getScale();
                const pad = 0.5 + entry.maxSize + sizePxPad + padding;
                const candidates = entry.index!.query(point.x - pad, point.y - pad, point.x + pad, point.y + pad);
                for (const item of candidates) {
                    if (!this.testItem(point, item, entry, padding)) continue;
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
                    if (!this.testItem(point, item, entry, padding)) continue;
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
        // Only anchor-positioned kinds reach here (see `indexable` in hitTest).
        entry.index = SpatialIndex.fromArray(entry.items as BoxedItem[]);
        entry.indexMap = new Map(entry.items.map((item, i) => [item, i]));
    }

    /** World-space box the item is drawn into, mirroring the renderers' math. */
    private boxFor(
        item: BoxedItem,
        kind: HitKind,
        useSizePx: boolean,
    ): { left: number; top: number; w: number; h: number } {
        // Circles/images may be pixel-sized (sizePx wins over size); rects and
        // static entries stay world-sized. Resolved per query because a sizePx
        // item's world box changes with the camera scale.
        const size =
            useSizePx && kind !== "rect" ? resolveSizeWorld(item as Circle, this.getScale()) : (item.size ?? 1);
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

    /**
     * Effective half stroke width in world units for stroke-distance tests.
     * Resolved against the live scale because widths may be screen-pixel
     * (`lineWidthPx`), with a minimum tap width so hairlines stay hittable.
     */
    private strokeHalfWorld(style: LineStyle | PathItem["style"]): number {
        const scale = this.getScale();
        const widthPx = Math.max(resolveLineWidthPx(style, scale), MIN_STROKE_HIT_WIDTH_PX);
        return widthPx / scale / 2;
    }

    /**
     * Filled paths (fillStyle set) hit on their interior under the item's
     * fill rule, treating the outline as implicitly closed like Canvas2D
     * `fill()`. All paths additionally hit within half the stroke width of
     * the outline, so unfilled paths are tappable on the stroke itself and
     * filled edges stay forgiving.
     */
    /**
     * Flattened-subpath cache for command paths, re-flattened when the
     * camera scale drifts beyond 2x of the cached bucket (the polyline's
     * deviation from the true curve stays far below hit tolerances inside
     * that window, and hover-frequency queries stay cheap).
     */
    private flattenCache = new WeakMap<PathItem, { scale: number; subpaths: Subpath[] }>();

    private commandSubpaths(item: PathItem & { commands: PathCommand[] }): Subpath[] {
        const scale = this.getScale();
        const cached = this.flattenCache.get(item);
        if (cached && scale >= cached.scale / 2 && scale <= cached.scale * 2) return cached.subpaths;
        const subpaths = flattenPathCommands(item.commands, ARC_SEGMENT_LENGTH / scale);
        this.flattenCache.set(item, { scale, subpaths });
        return subpaths;
    }

    /** Command paths: hit-test the same flattened geometry WebGL draws. */
    private testCommandPath(point: Coords, item: PathItem & { commands: PathCommand[] }, padding: number): boolean {
        const subpaths = this.commandSubpaths(item);
        if (subpaths.length === 0) return false;

        const filled = item.style?.fillStyle !== undefined;
        if (
            filled &&
            pointInRings(
                point,
                subpaths.map((sub) => sub.points),
                item.fillRule,
            )
        )
            return true;

        const threshold = this.strokeHalfWorld(item.style) + padding;
        for (const sub of subpaths) {
            if (distanceToPolyline(point, sub.points, sub.closed) <= threshold) return true;
        }
        return false;
    }

    private testPath(point: Coords, item: PathItem, padding: number): boolean {
        if (item.commands !== undefined) {
            return this.testCommandPath(point, item as PathItem & { commands: PathCommand[] }, padding);
        }
        const points = item.points;
        if (!points || points.length < 2) return false;

        // Test against the same rounded outline the renderers draw: corner
        // radii resolve to screen pixels, so convert to world units with the
        // live scale and flatten at the renderers' sampling density.
        const scale = this.getScale();
        const radiusWorld = resolveCornerRadiusPx(item.style, scale) / scale;
        const outline =
            radiusWorld > 0
                ? item.closed === true
                    ? roundedRing(points, radiusWorld, ARC_SEGMENT_LENGTH / scale)
                    : roundedPolyline(points, radiusWorld, ARC_SEGMENT_LENGTH / scale)
                : points;

        const filled = item.style?.fillStyle !== undefined;
        if (filled && pointInRing(point, outline, item.fillRule)) return true;
        const closed = filled || item.closed === true;
        return distanceToPolyline(point, outline, closed) <= this.strokeHalfWorld(item.style) + padding;
    }

    private testLine(point: Coords, item: Line, style: LineStyle | undefined, padding: number): boolean {
        const threshold = this.strokeHalfWorld(style) + padding;
        return distanceToPolyline(point, [item.from, item.to], false) <= threshold;
    }

    private testItem(point: Coords, item: HitItem, entry: HitEntry, padding: number): boolean {
        const kind = entry.kind;
        if (kind === "path") return this.testPath(point, item as PathItem, padding);
        if (kind === "line") return this.testLine(point, item as Line, entry.style, padding);

        const box = this.boxFor(item as BoxedItem, kind, !entry.ignoreSizePx);

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
