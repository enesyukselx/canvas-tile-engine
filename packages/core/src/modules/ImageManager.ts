export class ImageManager {
    private cache = new Map<string, HTMLImageElement>();

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

    get(src: string): HTMLImageElement | undefined {
        return this.cache.get(src);
    }

    has(src: string): boolean {
        return this.cache.has(src);
    }
}
