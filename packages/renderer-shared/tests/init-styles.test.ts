// @vitest-environment jsdom
//
// initStyles writes into real CSSStyleDeclarations, which normalize and reject
// values a plain object happily records. The package stays on environment
// "node" so the platform-free modules keep proving they never touch the DOM;
// tests like this one opt in per file.
import { describe, expect, it } from "vitest";
import { initStyles } from "../src/dom/initStyles";

function createElements() {
    return {
        wrapper: document.createElement("div"),
        canvas: document.createElement("canvas"),
    };
}

describe("initStyles", () => {
    it("sizes the wrapper from config when not responsive", () => {
        const { wrapper, canvas } = createElements();

        initStyles(wrapper, canvas, undefined, 800, 600);

        expect(wrapper.style.position).toBe("relative");
        expect(wrapper.style.overflow).toBe("hidden");
        expect(wrapper.style.width).toBe("800px");
        expect(wrapper.style.height).toBe("600px");
    });

    it("leaves wrapper size to CSS in responsive mode", () => {
        const { wrapper, canvas } = createElements();

        initStyles(wrapper, canvas, "preserve-scale", 800, 600);

        expect(wrapper.style.position).toBe("relative");
        expect(wrapper.style.overflow).toBe("hidden");
        expect(wrapper.style.width).toBe("");
        expect(wrapper.style.height).toBe("");
    });

    it("absolutely positions the canvas at the wrapper origin in both modes", () => {
        for (const responsive of [undefined, "preserve-viewport" as const]) {
            const { wrapper, canvas } = createElements();

            initStyles(wrapper, canvas, responsive, 800, 600);

            expect(canvas.style.position).toBe("absolute");
            // A real CSSStyleDeclaration normalizes a bare "0" to "0px"; the
            // previous fake recorded the raw string, so it asserted a value no
            // browser ever produces.
            expect(canvas.style.top).toBe("0px");
            expect(canvas.style.left).toBe("0px");
        }
    });

    it("leaves the wrapper unsized when a non-responsive call omits width/height", () => {
        const { wrapper, canvas } = createElements();

        // Both size params are optional, so this composes "undefinedpx". A
        // plain object would store that string verbatim and the wrapper would
        // silently carry an invalid declaration; a real DOM rejects it, which
        // is the behavior this pins.
        initStyles(wrapper, canvas, undefined);

        expect(wrapper.style.width).toBe("");
        expect(wrapper.style.height).toBe("");
        expect(wrapper.style.position).toBe("relative");
        expect(wrapper.style.overflow).toBe("hidden");
    });
});
