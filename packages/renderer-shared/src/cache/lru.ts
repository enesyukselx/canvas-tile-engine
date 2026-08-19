/**
 * Fixed-capacity least-recently-used map.
 *
 * `Map` already iterates in insertion order, so "least recently used" is just
 * the first key: reads and writes re-insert their key at the end, and an insert
 * past `limit` drops from the front. That keeps a static palette resident (it is
 * touched every frame) even while dynamic one-off keys stream through.
 *
 * Picking `limit` is the caller's call, and it is not a soft knob. A per-frame
 * scan that touches more distinct keys than the bound is LRU's worst case: each
 * lookup asks for the entry the previous frame's overflow just evicted, so the
 * hit rate goes to zero rather than degrading gradually. Size the bound above
 * the largest working set worth keeping resident, and weigh it against what a
 * miss actually costs — see the `COLOR_CACHE_LIMIT` in `renderer-webgl` and
 * `renderer-skia`, which differ for exactly that reason.
 *
 * Values must not be `undefined` — a `get` miss and a stored `undefined` are
 * indistinguishable.
 * @internal
 */
export class LruCache<K, V> {
    private entries = new Map<K, V>();
    private limit: number;
    /** The key currently at the end of `entries`; see `get`. */
    private newest: K | undefined;

    constructor(limit: number) {
        this.limit = Math.max(1, Math.floor(limit));
    }

    get size(): number {
        return this.entries.size;
    }

    get(key: K): V | undefined {
        const value = this.entries.get(key);
        if (value === undefined) {
            return undefined;
        }

        // Re-insert so the hottest keys sit at the end and outlive eviction —
        // but skip it when the key is already last. Reads run per item per
        // frame, and a run of same-styled items all hit that shortcut.
        if (key !== this.newest) {
            this.entries.delete(key);
            this.entries.set(key, value);
            this.newest = key;
        }
        return value;
    }

    set(key: K, value: V): void {
        this.entries.delete(key);
        this.entries.set(key, value);
        this.newest = key;

        // Eviction takes from the front, so it never reaches the key just set.
        while (this.entries.size > this.limit) {
            const oldest = this.entries.keys().next();
            if (oldest.done) {
                break;
            }
            this.entries.delete(oldest.value);
        }
    }

    clear(): void {
        this.entries.clear();
        this.newest = undefined;
    }
}
