import type { Bounds, Coords, PathCommand } from "../types";
import { pathCommandsBounds } from "./flattenPath";

/**
 * An anchor-positioned item: `Rect`, `Circle`, `Text` and `ImageItem` all
 * satisfy it. The drawn cell spans `width ?? size` by `height ?? size` world
 * units (default 1), centered on `x`/`y`.
 */
export interface AnchoredItem {
    x: number;
    y: number;
    /** World-unit size; defaults to 1, the size the renderers draw with. */
    size?: number;
    /** Per-axis world width, overriding `size` on the x axis (non-square rects). */
    width?: number;
    /** Per-axis world height, overriding `size` on the y axis. */
    height?: number;
}

/** A two-endpoint item: `Line`. */
export interface EndpointItem {
    from: Coords;
    to: Coords;
}

/** A free-form outline: `PathItem`, in either of its two forms. */
export interface OutlineItem {
    points?: Coords[];
    commands?: PathCommand[];
}

/**
 * Anything {@link itemsBounds} can measure — every item kind the draw API
 * accepts, so a mixed list (`hitTest` results included) needs no filtering.
 */
export type BoundedItem = AnchoredItem | EndpointItem | OutlineItem;

/**
 * Conservative world bounds of one path item: the control-point hull for
 * command paths (curves never leave it), the vertex box for polylines.
 *
 * Null means "nothing is drawn" — an empty command list, or fewer than two
 * points — which is also how the renderers decide to skip a path entirely.
 */
export function pathItemBounds(item: OutlineItem): Bounds | null {
    if (item.commands !== undefined) {
        return pathCommandsBounds(item.commands);
    }

    const points = item.points;
    if (!points || points.length < 2) {
        return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of points) {
        if (p.x < minX) {
            minX = p.x;
        }
        if (p.y < minY) {
            minY = p.y;
        }
        if (p.x > maxX) {
            maxX = p.x;
        }
        if (p.y > maxY) {
            maxY = p.y;
        }
    }
    return { minX, maxX, minY, maxY };
}

/** One item's box, dispatched on which geometry fields it carries. */
function boundsOf(item: BoundedItem): Bounds | null {
    const endpoints = item as Partial<EndpointItem>;
    if (endpoints.from && endpoints.to) {
        return {
            minX: Math.min(endpoints.from.x, endpoints.to.x),
            maxX: Math.max(endpoints.from.x, endpoints.to.x),
            minY: Math.min(endpoints.from.y, endpoints.to.y),
            maxY: Math.max(endpoints.from.y, endpoints.to.y),
        };
    }

    const outline = item as OutlineItem;
    if (outline.commands !== undefined || outline.points !== undefined) {
        return pathItemBounds(outline);
    }

    const anchored = item as AnchoredItem;
    if (typeof anchored.x !== "number" || typeof anchored.y !== "number") {
        return null;
    }
    const size = anchored.size ?? 1;
    const halfW = (anchored.width ?? size) / 2;
    const halfH = (anchored.height ?? size) / 2;
    return {
        minX: anchored.x - halfW,
        maxX: anchored.x + halfW,
        minY: anchored.y - halfH,
        maxY: anchored.y + halfH,
    };
}

/**
 * World-space rectangle enclosing every item in the list — the input
 * `fitBounds` and `fitScale` ask for:
 *
 * ```ts
 * const selection = itemsBounds(selectedSeats);
 * if (selection) {
 *     engine.fitBounds(selection, { paddingPx: 24 });
 * }
 * ```
 *
 * Accepts every item kind the draw API does, mixed freely: anchored items
 * (`Rect`, `Circle`, `Text`, `ImageItem`) contribute their cell box, `Line` its
 * two endpoints, `PathItem` its vertex box or control-point hull.
 *
 * Camera-independent by design, which leaves out:
 *
 * - `origin` offsets and `rotate` — both stay within half an item of this box.
 * - `sizePx` / `fontPx` — pixel sizes only gain a world extent once a camera
 *   scale is picked.
 * - measured text — `Text` contributes its `size` box, not glyph extents: core
 *   has no font metrics, so a long label reaches past this box.
 *
 * Items that draw nothing (a one-point path, an object carrying no geometry)
 * are skipped. Returns null when nothing in the list has bounds.
 */
export function itemsBounds(items: BoundedItem[]): Bounds | null {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const item of items) {
        const box = boundsOf(item);
        if (!box) {
            continue;
        }
        if (box.minX < minX) {
            minX = box.minX;
        }
        if (box.maxX > maxX) {
            maxX = box.maxX;
        }
        if (box.minY < minY) {
            minY = box.minY;
        }
        if (box.maxY > maxY) {
            maxY = box.maxY;
        }
    }

    if (minX === Infinity) {
        return null;
    }
    return { minX, maxX, minY, maxY };
}
