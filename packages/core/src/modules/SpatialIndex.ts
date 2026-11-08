/**
 * Spatial indexing wrapper using RBush (R-Tree) for fast viewport queries
 * @internal
 */

import RBush from "rbush";
import { isFinitePoint } from "../utils/finitePoint";

export interface SpatialItem {
    /** Anchor position. A non-finite `x` or `y` indexes the item nowhere: no finite query finds it. */
    x: number;
    y: number;
    /**
     * Optional world-space size (width/height). Defaults to 0 for point-like
     * items. Negative and NaN extents index as 0.
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

declare const spatialIndexToken: unique symbol;

function nonNegative(value: number): number {
    return value > 0 ? value : 0;
}

/**
 * Inverted infinite box for an item with a non-finite position. No finite
 * query intersects it, and it is the identity of RBush's min/max bbox merge, so it
 * never widens (or, unlike NaN, poisons) an ancestor node. Removal still finds
 * it: every node "contains" it.
 */
const NOWHERE = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity } as const;

/** Opaque handle for one indexed occurrence, even when item references repeat. */
export interface SpatialIndexToken<T> {
    readonly [spatialIndexToken]: T;
}

export class SpatialIndex<T extends SpatialItem> {
    private tree: RBush<RBushItem<T>>;
    private nextOrder = 0;
    private entries = new WeakMap<SpatialIndexToken<T>, RBushItem<T>>();

    constructor() {
        this.tree = new RBush();
    }

    /**
     * Append items to the R-Tree in registration order (faster than individual inserts).
     */
    load(items: readonly T[]): SpatialIndexToken<T>[] {
        const tokens: SpatialIndexToken<T>[] = [];
        const rbushItems: RBushItem<T>[] = items.map((item) => {
            const entry = this.createEntry(item);
            const token = {} as SpatialIndexToken<T>;
            this.entries.set(token, entry);
            tokens.push(token);
            return entry;
        });
        this.tree.load(rbushItems);
        return tokens;
    }

    /** Append one occurrence and return its handle for incremental updates. */
    insert(item: T): SpatialIndexToken<T> {
        const entry = this.createEntry(item);
        const token = {} as SpatialIndexToken<T>;
        this.entries.set(token, entry);
        this.tree.insert(entry);
        return token;
    }

    /**
     * Replace one occurrence without changing its registration order. Returns
     * false for a removed, cleared, or foreign token.
     */
    update(token: SpatialIndexToken<T>, item: T): boolean {
        const entry = this.entries.get(token);
        if (!entry) {
            return false;
        }
        const bounds = this.boundsOf(item);
        // RBush removal searches the old bounds. Never mutate the indexed node
        // before removing it, including when the caller reused the same item.
        this.tree.remove(entry);
        Object.assign(entry, bounds, { item });
        this.tree.insert(entry);
        return true;
    }

    /** Remove exactly one occurrence. Returns false for an inactive/foreign token. */
    remove(token: SpatialIndexToken<T>): boolean {
        const entry = this.entries.get(token);
        if (!entry) {
            return false;
        }
        this.tree.remove(entry);
        this.entries.delete(token);
        return true;
    }

    /**
     * Query all items within a rectangular range, in registration order.
     */
    query(minX: number, minY: number, maxX: number, maxY: number): T[] {
        const results = this.tree.search({ minX, minY, maxX, maxY });
        // RBush returns every entry of a node the query fully contains without
        // testing each one, so a nowhere entry (the only inverted box) can ride
        // along. Compact it out in place; `search` hands back a fresh array.
        let kept = 0;
        for (const entry of results) {
            if (entry.minX <= entry.maxX) {
                results[kept++] = entry;
            }
        }
        results.length = kept;
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
        this.entries = new WeakMap();
    }

    /**
     * Create SpatialIndex from array of items
     */
    static fromArray<T extends SpatialItem>(items: readonly T[]): SpatialIndex<T> {
        const index = new SpatialIndex<T>();
        index.load(items);
        return index;
    }

    private createEntry(item: T): RBushItem<T> {
        return { ...this.boundsOf(item), order: this.nextOrder++, item };
    }

    private boundsOf(item: T): Pick<RBushItem<T>, "minX" | "minY" | "maxX" | "maxY"> {
        if (!isFinitePoint(item)) {
            return { ...NOWHERE };
        }
        const size = typeof item.size === "number" ? item.size : 0;
        // Negative and NaN extents index as a point: an inverted box (min > max)
        // would never be found again, and NaN would poison the tree's bounds.
        const halfW = nonNegative(typeof item.width === "number" ? item.width : size) / 2;
        const halfH = nonNegative(typeof item.height === "number" ? item.height : size) / 2;
        return {
            minX: item.x - halfW,
            minY: item.y - halfH,
            maxX: item.x + halfW,
            maxY: item.y + halfH,
        };
    }
}
