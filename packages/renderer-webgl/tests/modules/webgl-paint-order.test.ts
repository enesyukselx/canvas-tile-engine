import { describe, expect, it } from "vitest";
import { CoordinateTransformer, type Coords, type ICamera, type PathItem, type Rect } from "@canvas-tile-engine/core";
import { Layer } from "@canvas-tile-engine/renderer-shared/scene";
import { WebGLDraw, type WebGLDrawContext } from "../../src/modules/WebGLDraw";
import { GLRenderer } from "../../src/modules/gl/GLRenderer";

type Command = {
    kind: "shapes" | "lines" | "stencil" | "cover";
    colors: number[][];
    vertices: number;
};

// Exercise the real GLRenderer down to its GPU submissions. Shader compilation
// is stubbed, but each drawArrays records the uploaded colors and stencil state.
// These are command-order tests, not a physical GPU pixel comparison.
function setup() {
    const commands: Command[] = [];
    let data = new Float32Array();
    let stencil = false;
    let colorWrites = true;
    const stencilTest = 0x0b90;
    const overrides: Record<string, unknown> = {
        STENCIL_TEST: stencilTest,
        getExtension: () => null,
        enable(cap: number) {
            if (cap === stencilTest) {
                stencil = true;
            }
        },
        disable(cap: number) {
            if (cap === stencilTest) {
                stencil = false;
            }
        },
        colorMask(enabled: boolean) {
            colorWrites = enabled;
        },
        bufferData(_target: number, uploaded: Float32Array) {
            data = new Float32Array(uploaded);
        },
        drawArrays(_mode: number, _first: number, vertices: number) {
            const stride = data.length / vertices;
            const kind = stencil ? (colorWrites ? "cover" : "stencil") : stride === 14 ? "shapes" : "lines";
            const colors: number[][] = [];
            for (let vertex = 0; vertex < vertices; vertex += 6) {
                const offset = vertex * stride + stride - 4;
                colors.push(Array.from(data.slice(offset, offset + 4)));
            }
            commands.push({ kind, colors, vertices });
        },
    };
    const functions: Record<string, unknown> = {};
    const context = new Proxy(functions, {
        get(target, prop: string) {
            if (prop in overrides) {
                return overrides[prop];
            }
            return (target[prop] ??= () => ({}));
        },
    }) as unknown as WebGLRenderingContext;
    const gl = new GLRenderer(context);
    gl.setSize(100, 100, 100, 100);
    const camera = { x: 0, y: 0, scale: 10 } as unknown as ICamera;
    const transformer = new CoordinateTransformer(camera);
    const layers = new Layer<WebGLDrawContext>();
    const draw = new WebGLDraw(layers, transformer, camera);
    const config = { size: { width: 100, height: 100 }, scale: 10 } as never;
    const ctx = { save() {}, restore() {} } as unknown as CanvasRenderingContext2D;
    const render = () => layers.drawAll({ gl, ctx, camera, transformer, config, topLeft: { x: 0, y: 0 } });
    return { draw, render, commands };
}

const red = [1, 0, 0, 1];
const green = [0, 1, 0, 1];
const blue = [0, 0, 1, 1];
const translucentBlue = [0, 0, 1, 0.5];

function paintOrder(commands: Command[]) {
    return commands.filter(({ kind }) => kind !== "stencil").map(({ kind, colors }) => [kind, colors[0]]);
}

describe.each(["rect", "circle", "static rect", "static circle"] as const)("WebGL %s paint order", (primitive) => {
    function register(draw: WebGLDraw, items: Rect[]) {
        switch (primitive) {
            case "rect":
                return draw.drawRect(items);
            case "circle":
                return draw.drawCircle(items);
            case "static rect":
                return draw.drawStaticRect(items, "paint-order");
            case "static circle":
                return draw.drawStaticCircle(items, "paint-order");
        }
    }

    it.each(["#00f", "rgba(0, 0, 255, 0.5)"])("paints an earlier stroke before a covering %s fill", (fillStyle) => {
        const { draw, render, commands } = setup();
        register(draw, [
            { x: 4, y: 4, size: 2, style: { fillStyle: "#0f0", strokeStyle: "#f00", lineWidthPx: 2 } },
            { x: 4, y: 4, size: 6, style: { fillStyle } },
        ]);
        render();

        expect(paintOrder(commands)).toEqual([
            ["shapes", green],
            ["lines", red],
            ["shapes", fillStyle === "#00f" ? blue : translucentBlue],
        ]);
    });

    it("keeps both fill/stroke pairs in item order, including dashed outlines", () => {
        const { draw, render, commands } = setup();
        register(draw, [
            { x: 4, y: 4, size: 2, style: { fillStyle: "#0f0", strokeStyle: "#f00", lineDashPx: [4, 2] } },
            { x: 4, y: 4, size: 4, style: { fillStyle: "rgba(0, 0, 255, 0.5)", strokeStyle: "#0f0" } },
        ]);
        render();

        expect(paintOrder(commands)).toEqual([
            ["shapes", green],
            ["lines", red],
            ["shapes", translucentBlue],
            ["lines", green],
        ]);
    });

    it("batches only adjacent compatible paints without changing per-instance color order", () => {
        const { draw, render, commands } = setup();
        register(draw, [
            { x: 4, y: 4, size: 2, style: { fillStyle: "#f00" } },
            { x: 4, y: 4, size: 3, style: { fillStyle: "rgba(0, 0, 255, 0.5)", strokeStyle: "#0f0" } },
            { x: 4, y: 4, size: 4, style: { strokeStyle: "#f00" } },
            { x: 4, y: 4, size: 5, style: { fillStyle: "#00f" } },
            { x: 4, y: 4, size: 6, style: { fillStyle: "#0f0" } },
        ]);
        render();

        expect(commands.map(({ kind }) => kind)).toEqual(["shapes", "lines", "shapes"]);
        expect(commands[0].colors).toEqual([red, translucentBlue]);
        const segments = primitive.includes("circle") ? 48 : 4;
        expect(commands[1].colors).toEqual([
            ...Array.from({ length: segments }, () => green),
            ...Array.from({ length: segments }, () => red),
        ]);
        expect(commands[2].colors).toEqual([blue, green]);
    });

    it.each(["fillStyle", "strokeStyle"] as const)("keeps a %s-only array in one GPU draw", (styleKey) => {
        const { draw, render, commands } = setup();
        register(
            draw,
            Array.from({ length: 100 }, () => ({ x: 4, y: 4, style: { [styleKey]: "rgba(0, 0, 255, 0.5)" } })),
        );
        render();

        expect(commands).toHaveLength(1);
        expect(commands[0].kind).toBe(styleKey === "fillStyle" ? "shapes" : "lines");
        const segments = styleKey === "fillStyle" ? 1 : primitive.includes("circle") ? 48 : 4;
        expect(commands[0].vertices).toBe(100 * segments * 6);
        expect(commands[0].colors.every((color) => color.every((value, i) => value === translucentBlue[i]))).toBe(true);
    });
});

describe.each(["points", "commands"] as const)("WebGL %s path paint order", (form) => {
    function square(size: number, style?: PathItem["style"]): PathItem {
        const points: Coords[] = [
            { x: 4 - size, y: 4 - size },
            { x: 4 + size, y: 4 - size },
            { x: 4 + size, y: 4 + size },
            { x: 4 - size, y: 4 + size },
        ];
        return form === "points"
            ? { points, closed: true, style }
            : {
                  commands: [
                      { type: "moveTo", ...points[0] },
                      ...points.slice(1).map((point) => ({ type: "lineTo" as const, ...point })),
                      { type: "closePath" },
                  ],
                  style,
              };
    }

    it.each(["nonzero", "evenodd"] as const)("completes each fill and stroke before the next %s fill", (fillRule) => {
        const { draw, render, commands } = setup();
        draw.drawPath([
            square(1, { fillStyle: "#0f0", strokeStyle: "#f00", lineDashPx: [4, 2] }),
            { ...square(3, { fillStyle: "rgba(0, 0, 255, 0.5)", strokeStyle: "#0f0" }), fillRule },
        ]);
        render();

        expect(commands.map(({ kind }) => kind)).toEqual(["stencil", "cover", "lines", "stencil", "cover", "lines"]);
        expect(paintOrder(commands)).toEqual([
            ["cover", green],
            ["lines", red],
            ["cover", translucentBlue],
            ["lines", green],
        ]);
    });

    it("flushes adjacent stroke-only paths before a covering fill and leaves stencil fills separate", () => {
        const { draw, render, commands } = setup();
        draw.drawPath([
            square(1, { strokeStyle: "#f00" }),
            square(2, { strokeStyle: "#0f0" }),
            square(3, { fillStyle: "#00f" }),
            square(3, { fillStyle: "rgba(0, 0, 255, 0.5)" }),
        ]);
        render();

        expect(commands.map(({ kind }) => kind)).toEqual(["lines", "stencil", "cover", "stencil", "cover"]);
        expect(commands[0].colors).toEqual([red, red, red, red, green, green, green, green]);
        expect(paintOrder(commands)).toEqual([
            ["lines", red],
            ["cover", blue],
            ["cover", translucentBlue],
        ]);
    });

    it("keeps default hairlines before the next fill", () => {
        const { draw, render, commands } = setup();
        draw.drawPath([square(1), square(3, { fillStyle: "#00f" })]);
        render();

        expect(paintOrder(commands)).toEqual([
            ["lines", [0, 0, 0, 1]],
            ["cover", blue],
        ]);
    });
});

describe("WebGL live paint order", () => {
    it.each(["drawRect", "drawCircle"] as const)(
        "rebuilds %s batches from visible decorated items each frame",
        (method) => {
            const { draw, render, commands } = setup();
            let showStroke = true;
            let stroke = "#f00";
            const items: Rect[] = [
                { x: 4, y: 4, style: { fillStyle: "#0f0" } },
                { x: 4, y: 4, style: { strokeStyle: "#0f0" } },
                { x: 4, y: 4, size: 3, style: { fillStyle: "#00f" } },
            ];
            draw[method](items, 1, {
                visibleOf: (item) => item !== items[1] || showStroke,
                styleOf: (item) => (item === items[1] ? { strokeStyle: stroke } : undefined),
            });
            render();
            expect(paintOrder(commands)).toEqual([
                ["shapes", green],
                ["lines", red],
                ["shapes", blue],
            ]);

            commands.length = 0;
            showStroke = false;
            render();
            expect(commands).toHaveLength(1);
            expect(commands[0].colors).toEqual([green, blue]);

            commands.length = 0;
            showStroke = true;
            stroke = "#00f";
            render();
            expect(paintOrder(commands)).toEqual([
                ["shapes", green],
                ["lines", blue],
                ["shapes", blue],
            ]);
        },
    );
});
