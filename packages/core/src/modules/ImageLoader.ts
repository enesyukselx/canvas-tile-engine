/**
 * Simple image loader with in-memory caching to avoid duplicate network requests.
 */
export class ImageLoader {
    private cache = new Map<string, HTMLImageElement>();

    /**
     * Load an image, reusing cache when possible.
     * @param src Image URL.
     * @returns Promise resolving to the loaded image element.
     */
    load(src: string): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            // Return cached image if available
            if (this.cache.has(src)) {
                resolve(this.cache.get(src)!);
                return;
            }

            const img = new Image();
            img.src = src;

            img.onload = () => {
                this.cache.set(src, img);
                resolve(img);
            };

            img.onerror = (err) => {
                console.error(`Image failed to load: ${src}`, err);
                reject(err);
            };
        });
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
}
