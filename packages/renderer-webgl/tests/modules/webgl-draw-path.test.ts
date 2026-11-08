import { describe, expect, it } from "vitest";
import { CoordinateTransformer, Coords, ICamera, ItemCollection, type PathItem } from "@canvas-tile-engine/core";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import type { RGBA } from "../../src/utils/color";
import type { GLRenderer, LineInstance } from "../../src/modules/gl/GLRenderer";

// Fake GL renderer recording stencil-cover fills and line instances.
function makeRecordingGL() {
    const fills: Array<{ rings: Coords[][]; color: RGBA; evenOdd: boolean }> = [];
    const lines: LineInstance[] = [];
    const gl = {
        fillPath(rings: Coords[][], color: RGBA, evenOdd: boolean) {
            fills.push({ rings, color, evenOdd });
        },
        drawLines(items: LineInstance[]) {
            lines.push(...items);
        },
        drawShapes() {},
    } as unknown as GLRenderer;
    return { gl, fills, lines };
}

function setup() {
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<WebGLDrawContext>();
    const draw = new WebGLDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const ctx = { save() {}, restore() {} } as unknown as CanvasRenderingContext2D;
    const render = (gl: GLRenderer) =>
        layers.drawAll({ gl, ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render };
}

const square = [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
    { x: 0, y: 4 },
];

describe("WebGLDraw collection path caches", () => {
    it("keeps bounds and flattened curves with their item through removal and replacement", () => {
        const { draw, render } = setup();
        const curve = (id: string, x: number): PathItem & { id: string } => ({
            id,
            commands: [
                { type: "moveTo", x, y: 1 },
                { type: "bezierCurveTo", cp1x: x, cp1y: 4, cp2x: x + 2, cp2y: 4, x: x + 2, y: 1 },
                { type: "closePath" },
            ],
            style: { fillStyle: "#f00" },
        });
        const items = [curve("a", 0), curve("b", 3)];
        const source = new ItemCollection(items, { keyOf: (item) => item.id });
        const handle = draw.drawPath(source.items as typeof items);
        source.subscribe((changes) => draw.applyDrawChanges(handle, changes));
        const first = makeRecordingGL();
        render(first.gl);
        expect(first.fills).toHaveLength(2);

        source.batch(() => {
            source.remove("a");
            source.update("b", curve("b", 6));
        });
        const moved = makeRecordingGL();
        render(moved.gl);
        expect(moved.fills).toHaveLength(1);
        expect(moved.fills[0].rings[0][0]).toEqual({ x: 65, y: 15 });
        source.update("b", curve("b", 100));
        const offscreen = makeRecordingGL();
        render(offscreen.gl);
        expect(offscreen.fills).toHaveLength(0);
        source.insert(curve("c", 1));
        const inserted = makeRecordingGL();
        render(inserted.gl);
        expect(inserted.fills).toHaveLength(1);
        expect(inserted.fills[0].rings[0][0]).toEqual({ x: 15, y: 15 });
    });

    it("remeasures and re-flattens a removed path when its identity is inserted again", () => {
        const { draw, render } = setup();
        const path: PathItem & { id: string } = {
            id: "a",
            commands: [
                { type: "moveTo", x: 1, y: 1 },
                { type: "lineTo", x: 3, y: 3 },
                { type: "lineTo", x: 1, y: 3 },
                { type: "closePath" },
            ],
            style: { fillStyle: "#f00" },
        };
        const items = [path];
        const source = new ItemCollection(items, { keyOf: (item) => item.id });
        const handle = draw.drawPath(source.items as typeof items);
        source.subscribe((changes) => draw.applyDrawChanges(handle, changes));
        const first = makeRecordingGL();
        render(first.gl);
        expect(first.fills[0].rings[0][0]).toEqual({ x: 15, y: 15 });

        source.remove("a");
        path.commands = [
            { type: "moveTo", x: 6, y: 1 },
            { type: "lineTo", x: 8, y: 3 },
            { type: "lineTo", x: 6, y: 3 },
            { type: "closePath" },
        ];
        source.insert(path);
        const moved = makeRecordingGL();
        render(moved.gl);
        expect(moved.fills[0].rings[0][0]).toEqual({ x: 65, y: 15 });

        source.remove("a");
        path.commands = [
            { type: "moveTo", x: 100, y: 1 },
            { type: "lineTo", x: 102, y: 3 },
            { type: "lineTo", x: 100, y: 3 },
            { type: "closePath" },
        ];
        source.insert(path);
        const offscreen = makeRecordingGL();
        render(offscreen.gl);
        expect(offscreen.fills).toHaveLength(0);
    });
});

describe("WebGLDraw path items", () => {
    it("fills via stencil-cover with the item's fill rule and skips the stroke when fill-only", () => {
        const { draw, render } = setup();
        const { gl, fills, lines } = makeRecordingGL();

        draw.drawPath(
            [
                { points: square, style: { fillStyle: "#f00" } },
                { points: square, fillRule: "evenodd", style: { fillStyle: "#0f0" } },
            ],
            1,
        );
        render(gl);

        expect(fills).toHaveLength(2);
        expect(fills[0].rings).toHaveLength(1);
        expect(fills[0].rings[0]).toHaveLength(4);
        expect(fills[0].evenOdd).toBe(false);
        expect(fills[1].evenOdd).toBe(true);
        expect(lines).toHaveLength(0);
    });

    it("strokes the closing segment only when closed", () => {
        const { draw, render } = setup();
        const open = makeRecordingGL();
        draw.drawPath([{ points: square, style: { strokeStyle: "#f00" } }], 1);
        render(open.gl);
        expect(open.lines).toHaveLength(3);

        const layers2 = setup();
        const closed = makeRecordingGL();
        layers2.draw.drawPath([{ points: square, closed: true, style: { strokeStyle: "#f00" } }], 1);
        layers2.render(closed.gl);
        expect(closed.lines).toHaveLength(4);
    });

    it("strokes a hairline by default when the item has no style", () => {
        const { draw, render } = setup();
        const { gl, lines, fills } = makeRecordingGL();

        draw.drawPath([{ points: square.slice(0, 2) }], 1);
        render(gl);

        expect(fills).toHaveLength(0);
        expect(lines).toHaveLength(1);
    });

    it("densifies the outline when cornerRadius is set (arc flattening)", () => {
        const { draw, render } = setup();
        const { gl, lines } = makeRecordingGL();

        draw.drawPath([{ points: square, closed: true, style: { strokeStyle: "#f00", cornerRadius: 1 } }], 1);
        render(gl);

        // Four rounded corners flatten into many short segments
        expect(lines.length).toBeGreaterThan(8);
    });

    it("fills the rounded (flattened) outline, not the raw polygon", () => {
        const { draw, render } = setup();
        const { gl, fills } = makeRecordingGL();

        draw.drawPath([{ points: square, closed: true, style: { fillStyle: "#f00", cornerRadius: 1 } }], 1);
        render(gl);

        // The rounded ring has more vertices than the source square
        expect(fills[0].rings[0].length).toBeGreaterThan(4);
    });
});

// Position contract shared by all renderers; mirrors the fixture values in the
// canvas, skia, and server suites. One NaN or ±Infinity endpoint or `points`
// vertex skips the whole line or path (it used to drop only the segments
// around the bad vertex, and an infinite endpoint was not culled).
describe("WebGLDraw non-finite lines and paths", () => {
    it.each([NaN, Infinity, -Infinity])("emits no fill or segment for a %s coordinate", (value) => {
        const { draw, render } = setup();
        const { gl, fills, lines } = makeRecordingGL();
        const style = { fillStyle: "#f00", strokeStyle: "#00f", lineWidthPx: 2 };

        draw.drawLine(
            [
                { from: { x: 0, y: 0 }, to: { x: value, y: 2 } },
                { from: { x: 1, y: value }, to: { x: 3, y: 3 } },
            ],
            { strokeStyle: "#00f" },
        );
        draw.drawPath([
            {
                points: [
                    { x: 1, y: 1 },
                    { x: value, y: 2 },
                    { x: 5, y: 5 },
                    { x: 1, y: 5 },
                ],
                closed: true,
                style: { ...style, cornerRadius: 0.5 },
            },
            {
                points: [
                    { x: 1, y: 1 },
                    { x: 5, y: 1 },
                    { x: 5, y: value },
                ],
                style,
            },
        ]);
        render(gl);

        expect(fills).toHaveLength(0);
        expect(lines).toHaveLength(0);
    });
});

describe("WebGLDraw command paths", () => {
    it("fills multi-subpath commands as one stencil call with all rings", () => {
        const { draw, render } = setup();
        const { gl, fills } = makeRecordingGL();

        draw.drawPath(
            [
                {
                    commands: [
                        { type: "moveTo", x: 0, y: 0 },
                        { type: "lineTo", x: 8, y: 0 },
                        { type: "lineTo", x: 8, y: 8 },
                        { type: "closePath" },
                        { type: "moveTo", x: 2, y: 2 },
                        { type: "lineTo", x: 4, y: 2 },
                        { type: "lineTo", x: 4, y: 4 },
                        { type: "closePath" },
                    ],
                    fillRule: "evenodd",
                    style: { fillStyle: "#f00" },
                },
            ],
            1,
        );
        render(gl);

        expect(fills).toHaveLength(1);
        expect(fills[0].rings).toHaveLength(2);
        expect(fills[0].evenOdd).toBe(true);
    });

    it("strokes flattened curves as dense segments, closing closed subpaths only", () => {
        const { draw, render } = setup();
        const { gl, lines } = makeRecordingGL();

        draw.drawPath(
            [
                {
                    commands: [
                        { type: "moveTo", x: 0, y: 0 },
                        { type: "bezierCurveTo", cp1x: 0, cp1y: 4, cp2x: 8, cp2y: 4, x: 8, y: 0 },
                    ],
                    style: { strokeStyle: "#f00" },
                },
            ],
            1,
        );
        render(gl);

        // A flattened cubic is many short segments, not one chord
        expect(lines.length).toBeGreaterThan(8);
    });

    it("re-flattens when the camera scale drifts beyond the 2x bucket", () => {
        const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera & { scale: number };
        const transformer = new CoordinateTransformer(camera);
        const layers = new Layer<WebGLDrawContext>();
        const draw = new WebGLDraw(layers, transformer, camera);
        const config = { size: { width: 2000, height: 2000 }, scale: 10 } as never;
        const ctx = { save() {}, restore() {} } as unknown as CanvasRenderingContext2D;
        const render = (gl: GLRenderer) =>
            layers.drawAll({ gl, ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });

        draw.drawPath(
            [
                {
                    commands: [{ type: "arc", x: 10, y: 10, radius: 5, startAngle: 0, endAngle: 360 }],
                    style: { strokeStyle: "#f00" },
                },
            ],
            1,
        );

        const low = makeRecordingGL();
        render(low.gl);
        const lowCount = low.lines.length;

        // Within the bucket: same flattening reused
        camera.scale = 15;
        const mid = makeRecordingGL();
        render(mid.gl);
        expect(mid.lines.length).toBe(lowCount);

        // Beyond 2x: re-flattened at the finer scale -> denser outline
        camera.scale = 100;
        const high = makeRecordingGL();
        render(high.gl);
        expect(high.lines.length).toBeGreaterThan(lowCount * 2);
    });
});

describe("smuggled decoration geometry", () => {
    it("resolves stroke width and corner radius from the registration-time item style", () => {
        const { draw, render } = setup();
        const { gl, lines } = makeRecordingGL();

        // Non-literal returns bypass TS excess-property checks; geometry
        // values must come from the layers hit testing reads.
        const smuggled = { strokeStyle: "#0f0", lineWidthPx: 12, cornerRadiusPx: 30 };
        draw.drawPath([{ points: square, closed: true, style: { strokeStyle: "#f00", lineWidthPx: 4 } }], 1, {
            styleOf: () => smuggled,
        });
        render(gl);

        // 4 sharp edges (no smuggled rounding densifying the outline), all
        // at the item width.
        expect(lines).toHaveLength(4);
        for (const line of lines) {
            expect(line.width).toBe(4);
        }
    });
});
