import { DEFAULT_VALUES } from "../constants";

/**
 * Simple image loader with in-memory caching to avoid duplicate network requests.
 */
export class ImageLoader {
    private cache = new Map<string, HTMLImageElement>();
    private inflight = new Map<string, Promise<HTMLImageElement>>();
    private listeners = new Set<() => void>();

    /**
     * Register a callback fired when a new image finishes loading.
     */
    onLoad(cb: () => void) {
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
     * @param src Image URL.
     * @param retry How many times to retry on error (default: 1).
     * @returns Promise resolving to the loaded image element.
     */
    async load(src: string, retry: number = DEFAULT_VALUES.IMAGE_LOAD_RETRY_COUNT): Promise<HTMLImageElement> {
        // Cached
        if (this.cache.has(src)) {
            return this.cache.get(src)!;
        }

        // Inflight
        if (this.inflight.has(src)) {
            return this.inflight.get(src)!;
        }

        const task = new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.decoding = "async";
            img.loading = "eager";

            img.onload = async () => {
                try {
                    // Wait for decode to finish if supported
                    if ("decode" in img) {
                        await (img as HTMLImageElement & { decode?: () => Promise<void> }).decode?.();
                    }
                } catch {
                    // ignore decode errors; draw will still attempt
                }

                this.cache.set(src, img);
                this.inflight.delete(src);
                this.notifyLoaded();
                resolve(img);
            };

            img.onerror = (err) => {
                this.inflight.delete(src);
                if (retry > 0) {
                    console.warn(`Retrying image: ${src}`);
                    resolve(this.load(src, retry - 1));
                } else {
                    console.error(`Image failed to load: ${src}`, err);
                    const reason =
                        err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
                    reject(new Error(`Image failed to load: ${src}. Reason: ${reason}`));
                }
            };

            img.src = src;
        });

        this.inflight.set(src, task);
        return task;
    }

    /**
     * Get a cached image without loading.
     * @param src Image URL key.
     */
    get(src: string): HTMLImageElement | undefined {
        return this.cache.get(src);
    }

    /**
     * Check if an image is already cached.
     * @param src Image URL key.
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
