/**
 * Spatial indexing wrapper using RBush (R-Tree) for fast viewport queries
 * @internal
 */

import RBush from "rbush";

export interface SpatialItem {
    x: number;
    y: number;
    /**
     * Optional world-space size (width/height). Defaults to 0 for point-like items.
     */
    size?: number;
    /** Optional per-axis world width; overrides `size` on the x axis (non-square rects). */
    width?: number;
    /** Optional per-axis world height; overrides `size` on the y axis (non-square rects). */
    height?: number;
}

interface RBushItem<T> {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    order: number;
    item: T;
}

export class SpatialIndex<T extends SpatialItem> {
    private tree: RBush<RBushItem<T>>;
    private nextOrder = 0;

    constructor() {
        this.tree = new RBush();
    }

    /**
     * Append items to the R-Tree in registration order (faster than individual inserts).
     */
    load(items: T[]): void {
        const rbushItems: RBushItem<T>[] = items.map((item) => {
            const size = typeof item.size === "number" ? item.size : 0;
            const halfW = (typeof item.width === "number" ? item.width : size) / 2;
            const halfH = (typeof item.height === "number" ? item.height : size) / 2;

            return {
                minX: item.x - halfW,
                minY: item.y - halfH,
                maxX: item.x + halfW,
                maxY: item.y + halfH,
                order: this.nextOrder++,
                item,
            };
        });
        this.tree.load(rbushItems);
    }

    /**
     * Query all items within a rectangular range, in registration order.
     */
    query(minX: number, minY: number, maxX: number, maxY: number): T[] {
        const results = this.tree.search({ minX, minY, maxX, maxY });
        // R-Tree traversal follows spatial partitions, not paint order. Sort only
        // the matching entries so culling preserves the array's stacking order.
        results.sort((a, b) => a.order - b.order);
        return results.map((r) => r.item);
    }

    /**
     * Clear all items
     */
    clear(): void {
        this.tree.clear();
        this.nextOrder = 0;
    }

    /**
     * Create SpatialIndex from array of items
     */
    static fromArray<T extends SpatialItem>(items: T[]): SpatialIndex<T> {
        const index = new SpatialIndex<T>();
        index.load(items);
        return index;
    }
}
