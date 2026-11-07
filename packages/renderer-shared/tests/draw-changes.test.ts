import { describe, expect, it, vi } from "vitest";
import type { DrawHandle, ItemCollectionChange } from "@canvas-tile-engine/core";
import { DrawChanges } from "../src/scene/DrawChanges";

describe("DrawChanges lifetime", () => {
    it("stops removed and cleared registrations while preserving other layers", () => {
        const changes: ItemCollectionChange<{ x: number }>[] = [{ type: "insert", key: "a", index: 0, item: { x: 1 } }];
        const makeHandle = (layer: number): DrawHandle => ({ id: Symbol(), layer });
        const a = makeHandle(1);
        const b = makeHandle(1);
        const c = makeHandle(2);
        const applyA = vi.fn();
        const applyB = vi.fn();
        const applyC = vi.fn();
        const registry = new DrawChanges();
        registry.add(a, applyA);
        registry.add(b, applyB);
        registry.add(c, applyC);
        registry.apply(a, changes);
        registry.remove(a);
        registry.apply(a, changes);
        registry.clear(1);
        registry.apply(b, changes);
        registry.apply(c, changes);
        registry.clear();
        registry.apply(c, changes);
        expect(applyA).toHaveBeenCalledExactlyOnceWith(changes);
        expect(applyB).not.toHaveBeenCalled();
        expect(applyC).toHaveBeenCalledExactlyOnceWith(changes);
    });
});
