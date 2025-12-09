import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { ImageLoader } from "../../src/modules/ImageLoader";

class MockImage {
    onload: (() => void) | null = null;
    onerror: ((err: unknown) => void) | null = null;
    crossOrigin?: string;
    decoding?: string;
    loading?: string;
    src = "";

    decode = vi.fn(() => Promise.resolve());

    triggerLoad() {
        this.onload?.();
    }

    triggerError(err: unknown = new Error("fail")) {
        this.onerror?.(err);
    }
}

describe("ImageLoader", () => {
    const originalImage = globalThis.Image;
    let created: MockImage[] = [];

    beforeEach(() => {
        created = [];
        vi.stubGlobal("Image", function () {
            const img = new MockImage();
            created.push(img);
            return img;
        } as unknown as typeof Image);
        vi.spyOn(console, "warn").mockImplementation(() => {});
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        globalThis.Image = originalImage;
    });

    it("loads and caches images, notifying listeners once", async () => {
        const loader = new ImageLoader();
        const onLoad = vi.fn();
        loader.onLoad(onLoad);

        const promise = loader.load("img.png");
        expect(created.length).toBe(1);
        created[0].triggerLoad();
        const img = await promise;

        expect(loader.has("img.png")).toBe(true);
        expect(loader.get("img.png")).toBe(img);
        expect(onLoad).toHaveBeenCalledTimes(1);

        // cached path does not create new Image
        const img2 = await loader.load("img.png");
        expect(created.length).toBe(1);
        expect(img2).toBe(img);
    });

    it("reuses inflight promise for the same src", async () => {
        const loader = new ImageLoader();
        const p1 = loader.load("same.png");
        const p2 = loader.load("same.png");
        expect(created.length).toBe(1);
        created[0].triggerLoad();
        const [i1, i2] = await Promise.all([p1, p2]);
        expect(i1).toBe(i2);
    });

    it("retries once on error then resolves", async () => {
        const loader = new ImageLoader();
        const promise = loader.load("retry.png");
        expect(created.length).toBe(1);
        created[0].triggerError();
        expect(created.length).toBe(2);
        created[1].triggerLoad();
        const img = await promise;
        expect(img).toBe(created[1]);
    });

    it("skips decode branch when decode is unavailable", async () => {
        const loader = new ImageLoader();
        const promise = loader.load("nodecode.png");
        expect(created.length).toBe(1);
        // remove decode to force the false branch of `"decode" in img`
        delete (created[0] as { decode?: unknown }).decode;
        created[0].triggerLoad();
        await promise;
    });

    it("fails with message when retries exhausted (Error instance)", async () => {
        const loader = new ImageLoader();
        const promise = loader.load("fail-error.png", 0);
        expect(created.length).toBe(1);
        created[0].triggerError(new Error("oops"));
        await expect(promise).rejects.toThrow(/Reason: oops/);
    });

    it("fails with message when retries exhausted", async () => {
        const loader = new ImageLoader();
        const promise = loader.load("fail.png", 0);
        expect(created.length).toBe(1);
        created[0].triggerError("boom");
        await expect(promise).rejects.toThrow(/Reason: boom/);
        expect(created.length).toBe(1); // no retry
    });

    it("clear removes cache and listeners", async () => {
        const loader = new ImageLoader();
        const onLoad = vi.fn();
        loader.onLoad(onLoad);
        const promise = loader.load("clear.png");
        created[0].triggerLoad();
        await promise;

        loader.clear();
        expect(loader.has("clear.png")).toBe(false);

        // after clear, listener should not fire
        const p2 = loader.load("clear.png");
        created[1].triggerLoad();
        await p2;
        expect(onLoad).toHaveBeenCalledTimes(1);
    });
});
