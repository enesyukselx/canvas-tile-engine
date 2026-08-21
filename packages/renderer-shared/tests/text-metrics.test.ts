import { describe, expect, it, vi } from "vitest";
import { fontShorthand, TextMetricsCache } from "../src/scene/textMetrics";

describe("fontShorthand", () => {
    it("omits an unset weight, like the draw path", () => {
        // The CSS shorthand resets every property it does not list, so an
        // unconditional "normal" would measure a different font than is drawn
        expect(fontShorthand({ fontPx: 12 })).toBe("12px sans-serif");
        expect(fontShorthand({ fontPx: 12, fontFamily: "monospace" })).toBe("12px monospace");
    });

    it("includes the weight when set", () => {
        expect(fontShorthand({ fontPx: 12, fontWeight: "bold" })).toBe("bold 12px sans-serif");
        expect(fontShorthand({ fontPx: 14, fontFamily: "monospace", fontWeight: 700 })).toBe("700 14px monospace");
    });
});

describe("TextMetricsCache", () => {
    const metrics = (width: number) => ({ width, ascent: 8, descent: 2 });

    it("measures once per distinct string", () => {
        const measure = vi.fn((text: string) => metrics(text.length));
        const cache = new TextMetricsCache(measure);

        expect(cache.get("abc", { fontPx: 12 }).width).toBe(3);
        expect(cache.get("abc", { fontPx: 12 }).width).toBe(3);

        expect(measure).toHaveBeenCalledOnce();
    });

    it("keeps weights apart", () => {
        // A bold string is wider; a key without the weight would hand back the
        // regular measurement for both
        const measure = vi.fn((text: string, style: { fontWeight?: number | string }) =>
            metrics(style.fontWeight === "bold" ? 99 : 1),
        );
        const cache = new TextMetricsCache(measure);

        expect(cache.get("a", { fontPx: 12 }).width).toBe(1);
        expect(cache.get("a", { fontPx: 12, fontWeight: "bold" }).width).toBe(99);
        expect(measure).toHaveBeenCalledTimes(2);
    });

    it("keeps sizes and families apart", () => {
        const measure = vi.fn(() => metrics(1));
        const cache = new TextMetricsCache(measure);

        cache.get("a", { fontPx: 12 });
        cache.get("a", { fontPx: 13 });
        cache.get("a", { fontPx: 12, fontFamily: "monospace" });

        expect(measure).toHaveBeenCalledTimes(3);
    });

    it("re-measures after a clear, for fonts that arrive late", () => {
        let width = 1;
        const measure = vi.fn(() => metrics(width));
        const cache = new TextMetricsCache(measure);

        expect(cache.get("a", { fontPx: 12 }).width).toBe(1);
        width = 42; // the webfont finished loading
        expect(cache.get("a", { fontPx: 12 }).width).toBe(1);

        cache.clear();
        expect(cache.get("a", { fontPx: 12 }).width).toBe(42);
    });
});
