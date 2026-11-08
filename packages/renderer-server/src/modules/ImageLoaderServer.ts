import { access } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { IImageLoader } from "@canvas-tile-engine/core";
import { loadImage, type Image } from "@napi-rs/canvas";

const DEFAULT_IMAGE_LOAD_RETRY_COUNT = 1;

const FILE_URL = /^file:/i;
// Any other URL scheme (`http(s):`, `data:`, ...) goes to `loadImage` as is.
// Two or more letters, so a Windows drive letter (`C:\tiles\a.png`) is a path.
const URL_SCHEME = /^\s*[a-z][a-z\d+.-]+:/i;

/**
 * Resolve a filesystem path or `file:` URL to an absolute path that exists.
 * `loadImage` cannot be trusted with these: it fetches a `file:` URL over
 * http and reports a missing relative path as "Invalid URL".
 * @returns The absolute path, or `undefined` when `src` is not a local file.
 * @throws When the file does not exist or the `file:` URL is malformed.
 */
async function resolveLocalFile(src: string): Promise<string | undefined> {
    const isFileUrl = FILE_URL.test(src);
    if (!isFileUrl && URL_SCHEME.test(src)) {
        return undefined;
    }
    const path = isFileUrl ? fileURLToPath(src) : src;
    const absolute = resolve(path);
    try {
        await access(absolute);
    } catch (err) {
        if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            throw err;
        }
        const hint = isAbsolute(path) ? "" : ` (relative paths resolve against ${process.cwd()})`;
        throw new Error(`file not found: ${absolute}${hint}`);
    }
    return absolute;
}

/**
 * Server-side image loader with in-memory caching, backed by
 * `@napi-rs/canvas` `loadImage`. Implements {@link IImageLoader} for the
 * native {@link Image} handle.
 *
 * Accepts a filesystem path (relative paths resolve against
 * `process.cwd()`), a `file://` URL, an `http(s)` URL, or a `data:` URI.
 */
export class ImageLoaderServer implements IImageLoader<Image> {
    private cache = new Map<string, Image>();
    private inflight = new Map<string, Promise<Image>>();
    private listeners = new Set<() => void>();

    /**
     * Register a callback fired when a new image finishes loading.
     * @returns Unsubscribe function.
     */
    onLoad(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notifyLoaded() {
        for (const cb of this.listeners) {
            cb();
        }
    }

    /**
     * Load an image, reusing cache when possible.
     * @param src Image source (path, URL, or data URI).
     * @param retry How many times to retry on error (default: 1). A missing
     * file fails at once, without retrying.
     * @returns Promise resolving to the loaded native image.
     */
    async load(src: string, retry: number = DEFAULT_IMAGE_LOAD_RETRY_COUNT): Promise<Image> {
        const cached = this.cache.get(src);
        if (cached) {
            return cached;
        }

        const pending = this.inflight.get(src);
        if (pending) {
            return pending;
        }

        const task = (async () => {
            let lastError: unknown;
            let source: string | undefined;
            try {
                source = (await resolveLocalFile(src)) ?? src;
            } catch (err) {
                // A missing file or malformed `file:` URL cannot succeed on retry.
                lastError = err;
            }
            for (let attempt = 0; source !== undefined && attempt <= retry; attempt++) {
                try {
                    const img = await loadImage(source);
                    this.cache.set(src, img);
                    this.inflight.delete(src);
                    this.notifyLoaded();
                    return img;
                } catch (err) {
                    lastError = err;
                }
            }
            this.inflight.delete(src);
            const reason =
                lastError instanceof Error
                    ? lastError.message
                    : typeof lastError === "string"
                      ? lastError
                      : JSON.stringify(lastError);
            throw new Error(`Image failed to load: ${src}. Reason: ${reason}`);
        })();

        this.inflight.set(src, task);
        return task;
    }

    /**
     * Get a cached image without loading.
     * @param src Image source key.
     */
    get(src: string): Image | undefined {
        return this.cache.get(src);
    }

    /**
     * Check if an image is already cached.
     * @param src Image source key.
     */
    has(src: string): boolean {
        return this.cache.has(src);
    }

    /**
     * Clear all cached and inflight images/listeners to free memory.
     */
    clear() {
        this.cache.clear();
        this.inflight.clear();
        this.listeners.clear();
    }
}
