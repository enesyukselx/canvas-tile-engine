import { IImageLoader } from "@canvas-tile-engine/core";
import { loadImage, type Image } from "@napi-rs/canvas";

const DEFAULT_IMAGE_LOAD_RETRY_COUNT = 1;

/**
 * Server-side image loader with in-memory caching, backed by
 * `@napi-rs/canvas` `loadImage`. Implements {@link IImageLoader} for the
 * native {@link Image} handle.
 *
 * Accepts anything `loadImage` accepts: a file path, `file://`/`http(s)` URL,
 * or a `data:` URI.
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
     * @param retry How many times to retry on error (default: 1).
     * @returns Promise resolving to the loaded native image.
     */
    async load(src: string, retry: number = DEFAULT_IMAGE_LOAD_RETRY_COUNT): Promise<Image> {
        const cached = this.cache.get(src);
        if (cached) return cached;

        const pending = this.inflight.get(src);
        if (pending) return pending;

        const task = (async () => {
            let lastError: unknown;
            for (let attempt = 0; attempt <= retry; attempt++) {
                try {
                    const img = await loadImage(src);
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
