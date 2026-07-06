import { IImageLoader } from "@canvas-tile-engine/core";
import { Skia, type SkImage } from "@shopify/react-native-skia";

const DEFAULT_IMAGE_LOAD_RETRY_COUNT = 1;

/**
 * Skia-based image loader with in-memory caching. Decodes images from a URI into
 * `SkImage` handles ready to be drawn by the renderer.
 * Implements {@link IImageLoader} for `SkImage`.
 */
export class SkiaImageLoader implements IImageLoader<SkImage> {
    private cache = new Map<string, SkImage>();
    private inflight = new Map<string, Promise<SkImage>>();
    private listeners = new Set<() => void>();

    onLoad(cb: () => void): () => void {
        this.listeners.add(cb);
        return () => this.listeners.delete(cb);
    }

    private notifyLoaded() {
        for (const cb of this.listeners) {
            cb();
        }
    }

    async load(src: string, retry: number = DEFAULT_IMAGE_LOAD_RETRY_COUNT): Promise<SkImage> {
        const cached = this.cache.get(src);
        if (cached) return cached;

        const inflight = this.inflight.get(src);
        if (inflight) return inflight;

        const task = this.decode(src, retry);
        this.inflight.set(src, task);
        return task;
    }

    private async decode(src: string, retry: number): Promise<SkImage> {
        try {
            const data = await Skia.Data.fromURI(src);
            const image = Skia.Image.MakeImageFromEncoded(data);
            if (!image) {
                throw new Error("Skia could not decode the image data");
            }

            this.cache.set(src, image);
            this.inflight.delete(src);
            this.notifyLoaded();
            return image;
        } catch (err) {
            this.inflight.delete(src);
            if (retry > 0) {
                console.warn(`Retrying image: ${src}`);
                return this.load(src, retry - 1);
            }
            console.error(`Image failed to load: ${src}`, err);
            const reason = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
            throw new Error(`Image failed to load: ${src}. Reason: ${reason}`);
        }
    }

    get(src: string): SkImage | undefined {
        return this.cache.get(src);
    }

    has(src: string): boolean {
        return this.cache.has(src);
    }

    clear() {
        this.cache.clear();
        this.inflight.clear();
        this.listeners.clear();
    }
}
