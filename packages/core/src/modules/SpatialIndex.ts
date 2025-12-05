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
}

interface RBushItem<T> {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    item: T;
}

export class SpatialIndex<T extends SpatialItem> {
    private tree: RBush<RBushItem<T>>;

    constructor() {
        this.tree = new RBush();
    }

    /**
     * Bulk load items into the R-Tree (much faster than individual inserts)
     */
    load(items: T[]): void {
        const rbushItems: RBushItem<T>[] = items.map((item) => {
            const size = typeof item.size === "number" ? item.size : 0;
            const half = size / 2;

            return {
                minX: item.x - half,
                minY: item.y - half,
                maxX: item.x + half,
                maxY: item.y + half,
                item,
            };
        });
        this.tree.load(rbushItems);
    }

    /**
     * Query all items within a rectangular range
     */
    query(minX: number, minY: number, maxX: number, maxY: number): T[] {
        const results = this.tree.search({ minX, minY, maxX, maxY });
        return results.map((r) => r.item);
    }

    /**
     * Clear all items
     */
    clear(): void {
        this.tree.clear();
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
