import { describe, expect, it } from "vitest";
import { LruCache } from "../src/cache/lru";

describe("LruCache", () => {
    it("returns stored values and undefined for unknown keys", () => {
        const cache = new LruCache<string, number>(4);
        cache.set("a", 1);

        expect(cache.get("a")).toBe(1);
        expect(cache.get("b")).toBeUndefined();
    });

    it("overwrites an existing key without growing", () => {
        const cache = new LruCache<string, number>(4);
        cache.set("a", 1);
        cache.set("a", 2);

        expect(cache.get("a")).toBe(2);
        expect(cache.size).toBe(1);
    });

    it("never exceeds its limit", () => {
        const cache = new LruCache<number, number>(3);
        for (let i = 0; i < 100; i++) {
            cache.set(i, i);
        }

        expect(cache.size).toBe(3);
        expect(cache.get(99)).toBe(99);
        expect(cache.get(96)).toBeUndefined();
    });

    it("evicts the least recently used key", () => {
        const cache = new LruCache<string, number>(3);
        cache.set("a", 1);
        cache.set("b", 2);
        cache.set("c", 3);
        cache.set("d", 4);

        expect(cache.get("a")).toBeUndefined();
        expect(cache.get("b")).toBe(2);
    });

    it("promotes a key on read so the next eviction skips it", () => {
        const cache = new LruCache<string, number>(3);
        cache.set("a", 1);
        cache.set("b", 2);
        cache.set("c", 3);

        cache.get("a"); // "b" is now the oldest
        cache.set("d", 4);

        expect(cache.get("a")).toBe(1);
        expect(cache.get("b")).toBeUndefined();
    });

    // Reading the newest key skips the re-insert; it must stay newest anyway.
    it("keeps its order when the newest key is read repeatedly", () => {
        const cache = new LruCache<string, number>(2);
        cache.set("a", 1);
        cache.set("b", 2);
        cache.get("b");
        cache.get("b");
        cache.set("c", 3);

        expect(cache.get("a")).toBeUndefined();
        expect(cache.get("b")).toBe(2);
        expect(cache.get("c")).toBe(3);
    });

    // The static-palette case: entries touched every frame outlive the stream
    // of one-off keys a per-frame `styleOf` produces.
    it("keeps a key that is read on every insert", () => {
        const cache = new LruCache<string, number>(3);
        cache.set("palette", 1);
        for (let i = 0; i < 100; i++) {
            expect(cache.get("palette")).toBe(1);
            cache.set(`dynamic-${i}`, i);
        }

        expect(cache.get("palette")).toBe(1);
    });

    it("clamps a nonsensical limit to one entry", () => {
        const cache = new LruCache<string, number>(0);
        cache.set("a", 1);
        cache.set("b", 2);

        expect(cache.size).toBe(1);
        expect(cache.get("b")).toBe(2);
    });

    it("empties on clear", () => {
        const cache = new LruCache<string, number>(4);
        cache.set("a", 1);
        cache.clear();

        expect(cache.size).toBe(0);
        expect(cache.get("a")).toBeUndefined();
    });
});
