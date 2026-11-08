import { copyFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createCanvas, loadImage } from "@napi-rs/canvas";
import { ImageLoaderServer } from "../../src/modules/ImageLoaderServer";

// Spy on the real loadImage so tests can see what reaches it, and how often.
vi.mock("@napi-rs/canvas", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@napi-rs/canvas")>();
    return { ...actual, loadImage: vi.fn(actual.loadImage) };
});

// Any small, valid PNG on disk will do: reuse a committed snapshot baseline.
const baseline = fileURLToPath(new URL("../snapshots/__baselines__/rects.png", import.meta.url));

let dir: string;

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cte-image-loader-"));
    copyFileSync(baseline, join(dir, "https-tile.png"));
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => {
    vi.mocked(loadImage).mockClear();
});

describe("ImageLoaderServer local files", () => {
    it("loads a path relative to process.cwd()", async () => {
        const img = await new ImageLoaderServer().load(relative(process.cwd(), baseline));
        expect(img.width).toBeGreaterThan(0);
    });

    it("loads an absolute path", async () => {
        const img = await new ImageLoaderServer().load(baseline);
        expect(img.width).toBeGreaterThan(0);
    });

    it("loads a file:// URL", async () => {
        const loader = new ImageLoaderServer();
        const src = pathToFileURL(baseline).href;

        const img = await loader.load(src);

        expect(img.width).toBeGreaterThan(0);
        expect(loader.get(src)).toBe(img);
    });

    it("loads a relative file whose name starts with http", async () => {
        // loadImage treats any string starting with "http" as a URL, even
        // when it names an existing file in the working directory.
        const cwd = process.cwd();
        process.chdir(dir);
        try {
            const img = await new ImageLoaderServer().load("https-tile.png");
            expect(img.width).toBeGreaterThan(0);
        } finally {
            process.chdir(cwd);
        }
    });

    it("reports a missing relative path with its resolved path and the working directory", async () => {
        const loader = new ImageLoaderServer();
        const onLoad = vi.fn();
        loader.onLoad(onLoad);

        const error = await loader.load("missing/tile.png").catch((err: unknown) => err);

        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe(
            `Image failed to load: missing/tile.png. Reason: file not found: ${resolve("missing/tile.png")} ` +
                `(relative paths resolve against ${process.cwd()})`,
        );
        expect((error as Error).message).not.toMatch(/Invalid URL/);
        expect(loader.has("missing/tile.png")).toBe(false);
        expect(onLoad).not.toHaveBeenCalled();
        // Retrying cannot make the file appear, so loadImage is never tried.
        expect(loadImage).not.toHaveBeenCalled();
    });

    it("reports a missing file:// URL by its path", async () => {
        const missing = join(dir, "missing.png");
        const src = pathToFileURL(missing).href;

        await expect(new ImageLoaderServer().load(src)).rejects.toThrow(
            `Image failed to load: ${src}. Reason: file not found: ${missing}`,
        );
    });

    it("loads a missing file once it exists, since failures are not cached", async () => {
        const loader = new ImageLoaderServer();
        const later = join(dir, "later.png");

        await expect(loader.load(later)).rejects.toThrow(`file not found: ${later}`);
        copyFileSync(baseline, later);

        const img = await loader.load(later);
        expect(img.width).toBeGreaterThan(0);
    });
});

describe("ImageLoaderServer non-file sources", () => {
    it("hands http(s) URLs to loadImage unchanged and keeps the retry", async () => {
        vi.mocked(loadImage).mockRejectedValueOnce(new Error("offline")).mockRejectedValueOnce(new Error("offline"));
        const src = "https://tiles.example/a.png";

        await expect(new ImageLoaderServer().load(src)).rejects.toThrow(
            `Image failed to load: ${src}. Reason: offline`,
        );

        expect(vi.mocked(loadImage).mock.calls).toEqual([[src], [src]]);
    });

    it("still decodes data: URIs", async () => {
        const canvas = createCanvas(3, 2);
        const src = canvas.toDataURL("image/png");

        const img = await new ImageLoaderServer().load(src);

        expect([img.width, img.height]).toEqual([3, 2]);
    });

    it("dedupes concurrent loads of the same file:// URL", async () => {
        const loader = new ImageLoaderServer();
        const src = pathToFileURL(baseline).href;

        const [a, b] = await Promise.all([loader.load(src), loader.load(src)]);

        expect(a).toBe(b);
    });
});
