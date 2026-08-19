import { IImageLoader } from "@canvas-tile-engine/core";

const DEFAULT_IMAGE_LOAD_RETRY_COUNT = 1;

/**
 * Value for the `crossOrigin` attribute of a loaded image, or `null` to omit
 * the attribute entirely and issue a plain (non-CORS) image request.
 */
export type ImageCrossOrigin = "anonymous" | "use-credentials" | null;

const DEFAULT_CROSS_ORIGIN: ImageCrossOrigin = "anonymous";

export interface ImageLoaderOptions {
    /**
     * `crossOrigin` attribute applied to every image element this loader
     * creates. Default `"anonymous"`.
     *
     * Setting the attribute turns the request into a CORS request, so a host
     * that does not send `Access-Control-Allow-Origin` fails the load outright.
     * Pass `null` to drop the attribute: such hosts then load fine, at the cost
     * of tainting the canvas.
     *
     * WebGL needs CORS-clean images — uploading a tainted image as a texture
     * throws — so `null` is only safe on the Canvas2D renderer.
     */
    crossOrigin?: ImageCrossOrigin;
}

/**
 * DOM-based image loader with in-memory caching to avoid duplicate network requests.
 * Implements IImageLoader for HTMLImageElement.
 */
export class ImageLoader implements IImageLoader<HTMLImageElement> {
    private cache = new Map<string, HTMLImageElement>();
    private inflight = new Map<string, Promise<HTMLImageElement>>();
    private listeners = new Set<() => void>();
    private readonly crossOrigin: ImageCrossOrigin;

    /**
     * @param options See {@link ImageLoaderOptions}.
     */
    constructor(options: ImageLoaderOptions = {}) {
        this.crossOrigin = options.crossOrigin === undefined ? DEFAULT_CROSS_ORIGIN : options.crossOrigin;
    }

    /**
     * Register a callback fired when a new image finishes loading.
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
     * @param src Image URL.
     * @param retry How many times to retry on error (default: 1).
     * @returns Promise resolving to the loaded image element.
     */
    async load(src: string, retry: number = DEFAULT_IMAGE_LOAD_RETRY_COUNT): Promise<HTMLImageElement> {
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
            // Opting out leaves the property untouched so no `crossorigin`
            // attribute is ever reflected and the request stays a plain image load.
            if (this.crossOrigin !== null) {
                img.crossOrigin = this.crossOrigin;
            }
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
                    // A missing Access-Control-Allow-Origin header surfaces as a
                    // plain onerror, so name it rather than blaming the asset.
                    const corsHint =
                        this.crossOrigin === null
                            ? ""
                            : ` Images are requested with crossOrigin="${this.crossOrigin}", so this also fails when the host does not send an Access-Control-Allow-Origin header; pass crossOrigin: null to the renderer to load it without CORS (Canvas2D only).`;
                    reject(new Error(`Image failed to load: ${src}. Reason: ${reason}.${corsHint}`));
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
