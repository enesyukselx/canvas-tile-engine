/**
 * Parses arbitrary CSS color strings into normalized RGBA components.
 *
 * WebGL needs colors as four floats in the [0, 1] range, but the public draw
 * API accepts the same CSS color strings as the Canvas2D renderer ("#rrggbb",
 * "rgba(...)", named colors, etc.). To support all of them without shipping a
 * full color parser, we lean on the platform: a 1x1 offscreen 2D canvas
 * normalizes any valid CSS color, and we read the painted pixel back.
 * @internal
 */
export type RGBA = [number, number, number, number];

const WHITE: RGBA = [1, 1, 1, 1];

export class ColorParser {
    private cache = new Map<string, RGBA>();
    private ctx: CanvasRenderingContext2D | null = null;

    constructor() {
        if (typeof document !== "undefined") {
            const canvas = document.createElement("canvas");
            canvas.width = 1;
            canvas.height = 1;
            this.ctx = canvas.getContext("2d", { willReadFrequently: true });
        }
    }

    /**
     * Convert a CSS color string into normalized RGBA floats.
     * Falls back to opaque white for unparseable input.
     */
    parse(color: string | undefined): RGBA {
        if (!color) return WHITE;

        const cached = this.cache.get(color);
        if (cached) return cached;

        const rgba = this.compute(color);
        this.cache.set(color, rgba);
        return rgba;
    }

    private compute(color: string): RGBA {
        if (!this.ctx) {
            return WHITE;
        }

        try {
            this.ctx.clearRect(0, 0, 1, 1);
            this.ctx.fillStyle = "#000";
            this.ctx.fillStyle = color;
            this.ctx.fillRect(0, 0, 1, 1);
            const data = this.ctx.getImageData(0, 0, 1, 1).data;
            return [data[0] / 255, data[1] / 255, data[2] / 255, data[3] / 255];
        } catch {
            return WHITE;
        }
    }

    clear() {
        this.cache.clear();
    }
}
