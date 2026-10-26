import {
    DEFAULT_VALUES,
    computeOriginOffset,
    resolveLineWidthPx,
    resolveOrigin,
    type Bounds,
    type Circle,
    type ImageItem,
    type Rect,
} from "@canvas-tile-engine/core";

/** Static geometry uses world sizes even when the item carries pixel sizes. */
function center(item: Rect | Circle | ImageItem<unknown>, width: number, height: number) {
    const pos = {
        x: item.x + DEFAULT_VALUES.CELL_CENTER_OFFSET,
        y: item.y + DEFAULT_VALUES.CELL_CENTER_OFFSET,
    };
    const corner = computeOriginOffset(pos, width, height, resolveOrigin(item.origin), 1);
    return { x: corner.x + width / 2, y: corner.y + height / 2 };
}

function rotatedBounds(cx: number, cy: number, halfW: number, halfH: number, degrees: number): Bounds {
    const angle = degrees * (Math.PI / 180);
    const cos = Math.abs(Math.cos(angle));
    const sin = Math.abs(Math.sin(angle));
    const dx = cos * halfW + sin * halfH;
    const dy = sin * halfW + cos * halfH;
    return { minX: cx - dx, minY: cy - dy, maxX: cx + dx, maxY: cy + dy };
}

function strokePadding(style: Rect["style"], scale: number): number {
    // Canvas2D paints subpixel widths as a 1px stroke with reduced alpha;
    // this also conservatively contains Skia's native subpixel/hairline stroke.
    return style?.strokeStyle ? Math.max(1, resolveLineWidthPx(style, scale)) / (2 * scale) : 0;
}

/** Corner-space world bounds, including the rotated rectangle's miter corners. */
export function staticRectPaintBounds(item: Rect, scale: number): Bounds {
    const width = item.width ?? item.size ?? 1;
    const height = item.height ?? item.size ?? 1;
    const c = center(item, width, height);
    const stroke = strokePadding(item.style, scale);
    return rotatedBounds(c.x, c.y, Math.abs(width) / 2 + stroke, Math.abs(height) / 2 + stroke, item.rotate ?? 0);
}

export function staticCirclePaintBounds(item: Circle, scale: number): Bounds {
    const size = item.size ?? 1;
    const c = center(item, size, size);
    const radius = Math.abs(size) / 2 + strokePadding(item.style, scale);
    return { minX: c.x - radius, minY: c.y - radius, maxX: c.x + radius, maxY: c.y + radius };
}

/** Image dimensions are supplied by the platform; sprite dimensions win. */
export function staticImagePaintBounds(
    item: ImageItem<unknown>,
    imageWidth: number,
    imageHeight: number,
): Bounds | null {
    const sourceWidth = item.sprite?.w ?? imageWidth;
    const sourceHeight = item.sprite?.h ?? imageHeight;
    if (![imageWidth, imageHeight, sourceWidth, sourceHeight].every((value) => Number.isFinite(value) && value > 0)) {
        return null;
    }
    const size = item.size ?? 1;
    const c = center(item, size, size);
    const aspect = sourceWidth / sourceHeight;
    const width = aspect > 1 ? size : size * aspect;
    const height = aspect > 1 ? size / aspect : size;
    // Aspect fitting and flips keep the image centered in its size box.
    return rotatedBounds(c.x, c.y, Math.abs(width) / 2, Math.abs(height) / 2, item.rotate ?? 0);
}

/**
 * Enclose the painted content, with a one-raster-pixel antialiasing guard.
 * Snap outwards at the recording scale so caching preserves pixel phase and
 * does not resample a fractional cache origin when blitted at that scale.
 * These are camera/corner-space coordinates, not item-center coordinates.
 */
export function staticCacheBounds<T>(
    items: T[],
    scale: number,
    boundsOf: (item: T, scale: number) => Bounds | null,
): Bounds | null {
    if (items.length === 0) {
        return null;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const item of items) {
        const box = boundsOf(item, scale);
        if (!box) {
            continue;
        }
        minX = Math.min(minX, box.minX);
        minY = Math.min(minY, box.minY);
        maxX = Math.max(maxX, box.maxX);
        maxY = Math.max(maxY, box.maxY);
    }
    if (minX === Infinity) {
        return null;
    }
    return {
        minX: (Math.floor(minX * scale) - 1) / scale,
        minY: (Math.floor(minY * scale) - 1) / scale,
        maxX: (Math.ceil(maxX * scale) + 1) / scale,
        maxY: (Math.ceil(maxY * scale) + 1) / scale,
    };
}
