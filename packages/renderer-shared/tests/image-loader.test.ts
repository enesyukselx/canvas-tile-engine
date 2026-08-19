import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImageLoader } from "../src/dom/ImageLoader";

/**
 * Image stub driven by a per-URL failure budget: each load attempt for a URL
 * consumes one budgeted failure before attempts start succeeding, which lets
 * tests exercise the retry path deterministically.
 */
class FakeImage {
    static instances: FakeImage[] = [];
    static failuresFor = new Map<string, number>();

    static reset() {
        FakeImage.instances = [];
        FakeImage.failuresFor.clear();
    }

    onload: (() => void) | null = null;
    onerror: ((err: unknown) => void) | null = null;
    /** Undefined until the loader assigns it, which is how opting out is asserted. */
    crossOrigin?: string;
    decoding = "";
    loading = "";
    private _src = "";

    constructor() {
        FakeImage.instances.push(this);
    }

    get src() {
        return this._src;
    }

    set src(value: string) {
        this._src = value;
        queueMicrotask(() => {
            const remaining = FakeImage.failuresFor.get(value) ?? 0;
            if (remaining > 0) {
                FakeImage.failuresFor.set(value, remaining - 1);
                this.onerror?.(new Error("network error"));
            } else {
                this.onload?.();
            }
        });
    }
}

describe("ImageLoader", () => {
    beforeEach(() => {
        vi.stubGlobal("Image", FakeImage);
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        FakeImage.reset();
    });

    it("loads an image and serves later loads from cache", async () => {
        const loader = new ImageLoader();

        const first = await loader.load("a.png");
        const second = await loader.load("a.png");

        expect(second).toBe(first);
        expect(FakeImage.instances).toHaveLength(1);
        expect(loader.has("a.png")).toBe(true);
        expect(loader.get("a.png")).toBe(first);
    });

    it("deduplicates concurrent loads of the same URL into one request", async () => {
        const loader = new ImageLoader();

        const [first, second] = await Promise.all([loader.load("a.png"), loader.load("a.png")]);

        expect(second).toBe(first);
        expect(FakeImage.instances).toHaveLength(1);
    });

    it("retries a failed load and resolves when the retry succeeds", async () => {
        FakeImage.failuresFor.set("flaky.png", 1);
        const loader = new ImageLoader();

        const img = await loader.load("flaky.png");

        expect(loader.get("flaky.png")).toBe(img);
        // One failed attempt plus one successful retry
        expect(FakeImage.instances).toHaveLength(2);
    });

    it("rejects when every retry is exhausted", async () => {
        FakeImage.failuresFor.set("broken.png", 2);
        const loader = new ImageLoader();

        await expect(loader.load("broken.png", 1)).rejects.toThrow(/Image failed to load: broken\.png/);
        expect(loader.has("broken.png")).toBe(false);
    });

    it("notifies onLoad listeners once per finished load until unsubscribed", async () => {
        const loader = new ImageLoader();
        const seen: number[] = [];
        const unsubscribe = loader.onLoad(() => seen.push(1));

        await loader.load("a.png");
        expect(seen).toHaveLength(1);

        // Cache hits resolve without loading, so listeners stay silent
        await loader.load("a.png");
        expect(seen).toHaveLength(1);

        unsubscribe();
        await loader.load("b.png");
        expect(seen).toHaveLength(1);
    });

    it("requests images with crossOrigin=anonymous by default", async () => {
        const loader = new ImageLoader();

        await loader.load("a.png");

        expect(FakeImage.instances[0].crossOrigin).toBe("anonymous");
    });

    it("honours an explicit crossOrigin value", async () => {
        const loader = new ImageLoader({ crossOrigin: "use-credentials" });

        await loader.load("a.png");

        expect(FakeImage.instances[0].crossOrigin).toBe("use-credentials");
    });

    it("never touches crossOrigin when opted out with null", async () => {
        const loader = new ImageLoader({ crossOrigin: null });

        await loader.load("a.png");

        // Assigning any string would make this a CORS request; the property must
        // stay untouched so no crossorigin attribute is reflected at all.
        expect(FakeImage.instances[0].crossOrigin).toBeUndefined();
    });

    it("treats an undefined crossOrigin option as the default", async () => {
        const loader = new ImageLoader({ crossOrigin: undefined });

        await loader.load("a.png");

        expect(FakeImage.instances[0].crossOrigin).toBe("anonymous");
    });

    it("keeps the opted-out setting across a retry", async () => {
        FakeImage.failuresFor.set("flaky.png", 1);
        const loader = new ImageLoader({ crossOrigin: null });

        await loader.load("flaky.png");

        expect(FakeImage.instances).toHaveLength(2);
        expect(FakeImage.instances.every((img) => img.crossOrigin === undefined)).toBe(true);
    });

    it("names CORS in the failure message while crossOrigin is set", async () => {
        FakeImage.failuresFor.set("broken.png", 2);
        const loader = new ImageLoader();

        await expect(loader.load("broken.png")).rejects.toThrow(/Access-Control-Allow-Origin/);
    });

    it("omits the CORS hint once opted out, since CORS is no longer a suspect", async () => {
        FakeImage.failuresFor.set("broken.png", 2);
        const loader = new ImageLoader({ crossOrigin: null });

        // One rejection, asserted twice: the failure budget is consumed per
        // attempt, so a second load() would succeed instead of throwing.
        const error = await loader.load("broken.png").catch((e: unknown) => e);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toMatch(/Image failed to load: broken\.png/);
        expect((error as Error).message).not.toMatch(/Access-Control-Allow-Origin/);
    });

    it("clear drops the cache so the next load fetches again", async () => {
        const loader = new ImageLoader();
        await loader.load("a.png");

        loader.clear();

        expect(loader.has("a.png")).toBe(false);
        await loader.load("a.png");
        expect(FakeImage.instances).toHaveLength(2);
    });
});
