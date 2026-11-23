import { describe, expect, it } from "vitest";
import { CoordinateTransformer, type ICamera, type PathCommand } from "@canvas-tile-engine/core";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { SkiaDraw } from "../../src/modules/SkiaDraw";
import type { SkiaDrawContext } from "../../src/types";
import { makeRecordingCanvas } from "../mocks/react-native-skia";

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<SkiaDrawContext>();
    const draw = new SkiaDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const { canvas, ops } = makeRecordingCanvas();
    const render = () => layers.drawAll({ ctx: canvas as never, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render, ops };
}

// Same empty-path contract as Canvas2D and WebGL. Before, Skia dropped just
// the arc for a negative radius (painting the rest of the outline) and the
// whole path for a non-finite value.
describe("SkiaDraw command paths that cannot be drawn", () => {
    it.each([
        ["a negative arc radius", { radius: -2 }],
        ["a NaN arc center", { x: NaN }],
        ["an infinite arc angle", { endAngle: Infinity }],
    ])("skips a path with %s without building it", (_case, arc) => {
        const { draw, render, ops } = setup();
        const commands: PathCommand[] = [
            { type: "moveTo", x: 0, y: 0 },
            { type: "lineTo", x: 4, y: 0 },
            { type: "arc", x: 2, y: 2, radius: 2, startAngle: 0, endAngle: 90, ...arc },
        ];
        draw.drawPath([{ commands, style: { strokeStyle: "#0f0", lineWidthPx: 2 } }], 1);

        expect(() => render()).not.toThrow();
        expect(ops.filter((op) => op.op === "path")).toEqual([]);
    });
});
