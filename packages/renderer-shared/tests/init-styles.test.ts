import { describe, expect, it } from "vitest";
import { initStyles } from "../src/dom/initStyles";

function createElements() {
    const wrapper = { style: {} as Record<string, string> } as unknown as HTMLDivElement;
    const canvas = { style: {} as Record<string, string> } as unknown as HTMLCanvasElement;
    return { wrapper, canvas };
}

describe("initStyles", () => {
    it("sizes the wrapper from config when not responsive", () => {
        const { wrapper, canvas } = createElements();

        initStyles(wrapper, canvas, undefined, 800, 600);

        expect(wrapper.style).toEqual({
            position: "relative",
            overflow: "hidden",
            width: "800px",
            height: "600px",
        });
    });

    it("leaves wrapper size to CSS in responsive mode", () => {
        const { wrapper, canvas } = createElements();

        initStyles(wrapper, canvas, "preserve-scale", 800, 600);

        expect(wrapper.style).toEqual({
            position: "relative",
            overflow: "hidden",
        });
    });

    it("absolutely positions the canvas at the wrapper origin in both modes", () => {
        for (const responsive of [undefined, "preserve-viewport" as const]) {
            const { wrapper, canvas } = createElements();
            initStyles(wrapper, canvas, responsive, 800, 600);
            expect(canvas.style).toEqual({ position: "absolute", top: "0", left: "0" });
        }
    });
});
