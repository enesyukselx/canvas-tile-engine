import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import type { Text, TextDecorationStyle } from "@canvas-tile-engine/core";
import { registerFont, renderToBuffer } from "../../src";
import { FIXTURES_DIR, expectSamePixels } from "./helpers";

registerFont(join(FIXTURES_DIR, "Roboto-Regular.ttf"), "TextColorTest");

const config = { scale: 30, size: { width: 240, height: 240 }, backgroundColor: "#ffffff" };
const fontFamily = "TextColorTest";

describe("text color pixels", () => {
    it.each([undefined, { fontFamily }])("draws visible black text on white with style %j", async (style) => {
        const text: Text = { x: 0, y: 0, text: "HELLO", fontPx: 20, style };
        const actual = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawText(text);
            },
        });
        const expected = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawText({ ...text, style: { ...style, fillStyle: "#000000" } });
            },
        });

        const pixels = PNG.sync.read(actual).data;
        let blackPixels = 0;
        for (let i = 0; i < pixels.length; i += 4) {
            if (pixels[i] === 0 && pixels[i + 1] === 0 && pixels[i + 2] === 0 && pixels[i + 3] === 255) {
                blackPixels++;
            }
        }
        expect(blackPixels).toBeGreaterThan(0);
        expectSamePixels(actual, expected, "text-default-black");
    });

    it("keeps uncolored text black after colored text and resolves styleOf field by field", async () => {
        const items: Text[] = [
            { x: 0, y: -2, text: "red", fontPx: 20, style: { fontFamily, fillStyle: "#ff0000" } },
            { x: 0, y: -1, text: "default", fontPx: 20, style: { fontFamily } },
            { x: 0, y: 0, text: "override", fontPx: 20, style: { fontFamily, fillStyle: "#ff0000" } },
            { x: 0, y: 1, text: "font-only", fontPx: 20, style: { fontFamily, fillStyle: "#ff0000" } },
            { x: 0, y: 2, text: "reset", fontPx: 20, style: { fontFamily, fillStyle: "#ff0000" } },
        ];
        const styleOf = (item: Text): TextDecorationStyle | undefined => {
            if (item.text === "override") {
                return { fillStyle: "#0000ff" };
            }
            if (item.text === "font-only") {
                return { fontWeight: "normal" };
            }
            if (item.text === "reset") {
                return { fillStyle: undefined };
            }
            return undefined;
        };
        const actual = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawText(items, 2, { styleOf });
            },
        });
        const expectedColors = ["#ff0000", "#000000", "#0000ff", "#ff0000", "#000000"];
        const expected = await renderToBuffer({
            config,
            draw: (engine) => {
                engine.drawText(
                    items.map((item, index) => ({
                        ...item,
                        style: { ...item.style, ...styleOf(item), fillStyle: expectedColors[index] },
                    })),
                );
            },
        });

        expectSamePixels(actual, expected, "text-color-styleof");
    });
});
