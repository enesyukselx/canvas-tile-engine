import {
    DEFAULT_VALUES,
    SpatialIndex,
    computeOriginOffset,
    overlayLineStyle,
    resolveBoxWorld,
    resolveLineWidthPx,
    resolveOrigin,
} from "@canvas-tile-engine/core";
import type { Bounds, Line, LineStyle, Rect, Text } from "@canvas-tile-engine/core";

/** Inclusive intersection, shared by the indexed and linear draw paths. */
export function intersectsBounds(a: Bounds, b: Bounds): boolean {
    return a.minX <= b.maxX && a.maxX >= b.minX && a.minY <= b.maxY && a.maxY >= b.minY;
}

/** Unknown metrics must never become a false-negative cull. */
export const UNBOUNDED: Bounds = { minX: -Infinity, minY: -Infinity, maxX: Infinity, maxY: Infinity };

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

/**
 * Large immutable registrations retain an R-tree of painted boxes. Shapes
 * provide a bounded pixel contribution, so their world-only index survives
 * zoom unchanged. Measured text rebuilds only when scale/font metrics change.
 *
 * Live style callbacks can arbitrarily enlarge strokes or text. Those draws
 * must scan their items, then cull against the resolved style in the draw loop.
 * The same loop supplies the precise test below the index threshold.
 */
export class PaintedCuller<T> {
    private index?: SpatialIndex<{ x: number; y: number; width: number; height: number; item: T }>;
    private scale?: number;
    private revision?: number;

    constructor(
        private items: T[],
        private boundsOf: (item: T, scale: number) => Bounds,
        private liveBounds = false,
        private pixelPadding?: number,
    ) {}

    query(viewport: Bounds, scale: number, revision = 0): T[] {
        if (this.items.length <= 500 || this.liveBounds) {
            return this.items;
        }
        const indexScale = this.pixelPadding !== undefined ? Infinity : scale;
        if (this.scale !== indexScale || this.revision !== revision) {
            const entries = this.items.map((item) => ({ item, bounds: this.boundsOf(item, indexScale) }));
            // Incomplete font metrics are not spatially indexable. Paint them
            // conservatively instead of inventing a finite text width.
            this.index = entries.every(({ bounds }) => finiteBounds(bounds))
                ? SpatialIndex.fromArray(
                      entries.map(({ item, bounds }) => ({
                          item,
                          x: (bounds.minX + bounds.maxX) / 2,
                          y: (bounds.minY + bounds.maxY) / 2,
                          width: bounds.maxX - bounds.minX,
                          height: bounds.maxY - bounds.minY,
                      })),
                  )
                : undefined;
            this.scale = indexScale;
            this.revision = revision;
        }
        const pad = (this.pixelPadding ?? 0) / scale;
        return this.index
            ? this.index
                  .query(viewport.minX - pad, viewport.minY - pad, viewport.maxX + pad, viewport.maxY + pad)
                  .map(({ item }) => item)
            : this.items;
    }
}
