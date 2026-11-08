import {
    DEFAULT_VALUES,
    SpatialIndex,
    computeOriginOffset,
    isFinitePoint,
    overlayLineStyle,
    resolveBoxWorld,
    resolveLineWidthPx,
    resolveOrigin,
} from "@canvas-tile-engine/core";
import type {
    Bounds,
    ItemCollectionChange,
    Line,
    LineStyle,
    Rect,
    SpatialIndexToken,
    Text,
} from "@canvas-tile-engine/core";

/** Inclusive intersection, shared by the indexed and linear draw paths. */
export function intersectsBounds(a: Bounds, b: Bounds): boolean {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Unknown metrics must never become a false-negative cull. */
export const UNBOUNDED: Bounds = { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };

/**
 * Bounds of an item with a non-finite position, endpoint or point, which
 * paints nothing on any renderer: an inverted box that intersects no viewport.
 * Returned by identity so the culler can index such an item nowhere instead
 * of counting it as unbounded (which would force a full scan every frame).
 */
export const NOWHERE: Bounds = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };

function finiteBounds(bounds: Bounds): boolean {
    return Object.values(bounds).every(Number.isFinite);
}

function rotatedBox(cx: number, cy: number, halfW: number, halfH: number, degrees: number): Bounds {
    const angle = degrees * (Math.PI / 180);
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const dx = cos * halfW + sin * halfH;
    const dy = sin * halfW + cos * halfH;
    return { minX: cx - dx, minY: cy - dy, maxX: cx + dx, maxY: cy + dy };
}

/**
 * Bounds in camera/corner-space, including the item-to-cell-center offset.
 * Images use their enclosing size box; aspect fitting and mirroring cannot
 * escape it. Circles use the same box without rotation.
 */
export function boxPaintBounds(item: Omit<Rect, "style">, scale: number, style?: Rect["style"], rotate = true): Bounds {
    if (!isFinitePoint(item)) {
        return NOWHERE;
    }
    const { width, height } = resolveBoxWorld(item, scale);
    const pos = {
        x: item.x + DEFAULT_VALUES.CELL_CENTER_OFFSET,
        y: item.y + DEFAULT_VALUES.CELL_CENTER_OFFSET,
    };
    const topLeft = computeOriginOffset(pos, width, height, resolveOrigin(item.origin), 1);
    // Canvas2D paints subpixel strokes as a 1px stroke with reduced alpha.
    const stroke = style?.strokeStyle
        ? Math.max(
              1 / scale,
              style.lineWidthPx !== undefined ? style.lineWidthPx / scale : (style.lineWidth ?? 1 / scale),
          ) / 2
        : 0;
    // Expand before rotation: this also contains the mitered rectangle corners.
    return rotatedBox(
        topLeft.x + width / 2,
        topLeft.y + height / 2,
        Math.abs(width) / 2 + stroke,
        Math.abs(height) / 2 + stroke,
        rotate ? (item.rotate ?? 0) : 0,
    );
}

/**
 * Maximum screen-pixel contribution to either bound coordinate, independent
 * of zoom. Indexing the world-only box and expanding a query by this / scale
 * retains the index during zoom, including mixed world/pixel dimensions.
 */
export function boxPixelPadding(item: Omit<Rect, "style">, style?: Rect["style"]): number {
    const width = Math.abs(item.widthPx ?? item.sizePx ?? 0);
    const height = Math.abs(item.heightPx ?? item.sizePx ?? 0);
    const origin = resolveOrigin(item.origin);
    const shift =
        origin.mode === "self" ? Math.max(Math.abs(0.5 - origin.x) * width, Math.abs(0.5 - origin.y) * height) : 0;
    // |sin| and |cos| <= 1; a full pixel width also covers rotated miter
    // corners (sqrt(2) times a half-width) and subpixel alpha hairlines.
    const stroke = style?.strokeStyle ? Math.max(1, style.lineWidthPx ?? 0) : 0;
    return shift + (width + height) / 2 + stroke;
}

export function linePaintBounds(item: Line, scale: number, callStyle?: LineStyle): Bounds {
    // An infinite endpoint would otherwise still reach into the viewport.
    if (!isFinitePoint(item.from) || !isFinitePoint(item.to)) {
        return NOWHERE;
    }
    const style = overlayLineStyle(callStyle, item.style);
    const pad = Math.max(1, resolveLineWidthPx(style, scale)) / (2 * scale);
    const offset = DEFAULT_VALUES.CELL_CENTER_OFFSET;
    return {
        minX: Math.min(item.from.x, item.to.x) + offset - pad,
        minY: Math.min(item.from.y, item.to.y) + offset - pad,
        maxX: Math.max(item.from.x, item.to.x) + offset + pad,
        maxY: Math.max(item.from.y, item.to.y) + offset + pad,
    };
}

/** Path geometry is item-space; joins can extend beyond half the stroke width. */
export function pathPaintBounds(bounds: Bounds, style: LineStyle | undefined, scale: number): Bounds {
    // The Canvas2D default miter limit is 10; it also covers Skia's smaller
    // default and WebGL's segment strokes. A fill-only path is conservatively
    // padded too, since a live decoration can add a stroke.
    const pad = (10 * Math.max(1, resolveLineWidthPx(style, scale))) / (2 * scale);
    const offset = DEFAULT_VALUES.CELL_CENTER_OFFSET;
    return {
        minX: bounds.minX + offset - pad,
        minY: bounds.minY + offset - pad,
        maxX: bounds.maxX + offset + pad,
        maxY: bounds.maxY + offset + pad,
    };
}

/** Transform the platform-measured ink box about the text's anchor. */
export function textPaintBounds(item: Text, scale: number, localPxBounds: Bounds): Bounds {
    // Checked before the metrics: an unmeasured label must not be drawn at NaN.
    if (!isFinitePoint(item)) {
        return NOWHERE;
    }
    if (!finiteBounds(localPxBounds)) {
        return UNBOUNDED;
    }
    const angle = (item.rotate ?? 0) * (Math.PI / 180);
    const cx = (localPxBounds.minX + localPxBounds.maxX) / (2 * scale);
    const cy = (localPxBounds.minY + localPxBounds.maxY) / (2 * scale);
    return rotatedBox(
        item.x + DEFAULT_VALUES.CELL_CENTER_OFFSET + Math.cos(angle) * cx - Math.sin(angle) * cy,
        item.y + DEFAULT_VALUES.CELL_CENTER_OFFSET + Math.sin(angle) * cx + Math.cos(angle) * cy,
        (localPxBounds.maxX - localPxBounds.minX) / (2 * scale),
        (localPxBounds.maxY - localPxBounds.minY) / (2 * scale),
        item.rotate ?? 0,
    );
}

type IndexedPaintItem<T> = { x: number; y: number; width: number; height: number; item: T };
type PaintIndexEntry<T> = { token: SpatialIndexToken<IndexedPaintItem<T>>; bounded: boolean };

/**
 * Large registrations retain an R-tree of painted boxes. Collection changes
 * update only the affected entries, without replacing the draw registration.
 * Shapes provide a bounded pixel contribution, so their world-only index survives
 * zoom unchanged. Measured text rebuilds only when scale/font metrics change.
 *
 * Live style callbacks can arbitrarily enlarge strokes or text. Those draws
 * must scan their items, then cull against the resolved style in the draw loop.
 * The same loop supplies the precise test below the index threshold.
 */
export class PaintedCuller<T> {
    private index?: SpatialIndex<IndexedPaintItem<T>>;
    // A token per occurrence preserves legacy arrays with repeated references.
    // Change indices describe sequential operations, so this list follows the
    // deltas even when a collection's backing array already holds the final batch.
    private entries: PaintIndexEntry<T>[] = [];
    private unboundedCount = 0;
    private scale?: number;
    private revision?: number;
    private pixelPadding?: number;
    private pixelPaddingOf?: (item: T) => number;

    constructor(
        private items: readonly T[],
        private boundsOf: (item: T, scale: number) => Bounds,
        private liveBounds = false,
        pixelPadding?: number | ((item: T) => number),
    ) {
        if (typeof pixelPadding === "function") {
            this.pixelPaddingOf = pixelPadding;
            this.pixelPadding = items.reduce((max, item) => Math.max(max, pixelPadding(item)), 0);
        } else {
            this.pixelPadding = pixelPadding;
        }
    }

    /** Apply committed collection deltas; the shared items array is already current. */
    applyChanges(changes: readonly ItemCollectionChange<T>[]): void {
        for (const change of changes) {
            if (change.type !== "remove" && this.pixelPaddingOf) {
                // A conservative high-water mark avoids rescanning the collection
                // when its former widest marker is removed or shrunk.
                this.pixelPadding = Math.max(this.pixelPadding ?? 0, this.pixelPaddingOf(change.item));
            }
            if (!this.index || this.scale === undefined) {
                // The first indexed query will build from the final live list.
                continue;
            }
            if (change.type === "insert") {
                const { value, bounded } = this.indexedItem(change.item, this.scale);
                const token = this.index.insert(value);
                this.entries.splice(change.index, 0, { token, bounded });
                if (!bounded) {
                    this.unboundedCount++;
                }
                continue;
            }
            const entry = this.entries[change.index];
            if (change.type === "remove") {
                this.index.remove(entry.token);
                this.entries.splice(change.index, 1);
                if (!entry.bounded) {
                    this.unboundedCount--;
                }
            } else {
                const { value, bounded } = this.indexedItem(change.item, this.scale);
                this.index.update(entry.token, value);
                if (entry.bounded !== bounded) {
                    this.unboundedCount += bounded ? -1 : 1;
                }
                entry.bounded = bounded;
            }
        }
    }

    private indexedItem(item: T, scale: number): { value: IndexedPaintItem<T>; bounded: boolean } {
        const bounds = this.boundsOf(item, scale);
        if (bounds === NOWHERE) {
            // Paints nothing (non-finite position): a NaN anchor indexes it
            // where no query finds it, and it does not force a scan.
            return { bounded: true, value: { item, x: NaN, y: NaN, width: 0, height: 0 } };
        }
        const bounded = finiteBounds(bounds);
        // Unknown text metrics force a scan, but retain a harmless indexed slot
        // so becoming measurable later preserves its original painting order.
        return {
            bounded,
            value: bounded
                ? {
                      item,
                      x: (bounds.minX + bounds.maxX) / 2,
                      y: (bounds.minY + bounds.maxY) / 2,
                      width: bounds.maxX - bounds.minX,
                      height: bounds.maxY - bounds.minY,
                  }
                : { item, x: 0, y: 0, width: 0, height: 0 },
        };
    }

    query(viewport: Bounds, scale: number, revision = 0): readonly T[] {
        if (this.items.length <= 500 || this.liveBounds) {
            return this.items;
        }
        const indexScale = this.pixelPadding !== undefined ? Infinity : scale;
        if (this.scale !== indexScale || this.revision !== revision) {
            const entries = this.items.map((item) => this.indexedItem(item, indexScale));
            this.index = new SpatialIndex();
            const tokens = this.index.load(entries.map(({ value }) => value));
            this.entries = entries.map(({ bounded }, i) => ({ token: tokens[i], bounded }));
            this.unboundedCount = entries.reduce((count, entry) => count + (entry.bounded ? 0 : 1), 0);
            this.scale = indexScale;
            this.revision = revision;
        }
        const pad = (this.pixelPadding ?? 0) / scale;
        return this.index && this.unboundedCount === 0
            ? this.index
                  .query(viewport.minX - pad, viewport.minY - pad, viewport.maxX + pad, viewport.maxY + pad)
                  .map(({ item }) => item)
            : this.items;
    }
}
