import type { DrawHandle, ItemCollectionChange } from "@canvas-tile-engine/core";

/** Per-registration cache updates, owned and disposed with a renderer's draws. */
export class DrawChanges {
    private entries = new Map<
        symbol,
        { layer: number; apply: (changes: readonly ItemCollectionChange<unknown>[]) => void }
    >();

    add<T>(handle: DrawHandle, apply: (changes: readonly ItemCollectionChange<T>[]) => void): void {
        // The engine forwards only the changes belonging to this registration.
        this.entries.set(handle.id, {
            layer: handle.layer,
            apply: apply as (changes: readonly ItemCollectionChange<unknown>[]) => void,
        });
    }

    apply(handle: DrawHandle, changes: readonly ItemCollectionChange<unknown>[]): void {
        this.entries.get(handle.id)?.apply(changes);
    }

    remove(handle: DrawHandle): void {
        this.entries.delete(handle.id);
    }

    clear(layer?: number): void {
        if (layer === undefined) {
            this.entries.clear();
            return;
        }
        for (const [id, entry] of this.entries) {
            if (entry.layer === layer) {
                this.entries.delete(id);
            }
        }
    }
}
