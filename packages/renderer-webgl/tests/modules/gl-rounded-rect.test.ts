import { describe, expect, it } from "vitest";
import { GLRenderer } from "../../src/modules/gl/GLRenderer";
import {
    SHAPE_FRAGMENT_SHADER_AA_300,
    SHAPE_FRAGMENT_SHADER_HARD,
    shapeFragmentShaderAA,
} from "../../src/modules/gl/shaders";

function recordingGL() {
    const buffers: Float32Array[] = [];
    const calls: unknown[][] = [];
    const gl = new Proxy(
        {},
        {
            get(_target, key) {
                if (typeof key === "string" && /^[A-Z_]+$/.test(key)) {
                    return key;
                }
                if (key === "bufferData") {
                    return (_target: unknown, data: Float32Array) => buffers.push(data);
                }
                if (key === "getAttribLocation") {
                    return () => 0;
                }
                return (...args: unknown[]) => {
                    calls.push([key, ...args]);
                    return {};
                };
            },
        },
    ) as WebGLRenderingContext;
    return { renderer: new GLRenderer(gl), buffers, calls };
}

describe("rounded rectangle GPU commands", () => {
    it("uploads asymmetric radii without the half-short-edge clamp", () => {
        const { renderer, buffers } = recordingGL();
        renderer.drawShapes([
            { cx: 50, cy: 10, halfW: 50, halfH: 10, radius: [20, 20, 0, 0], rotation: 0, color: [1, 0, 0, 1] },
        ]);
        expect(buffers).toHaveLength(1);
        expect(buffers[0]).toHaveLength(6 * 16);
        for (let i = 0; i < 6; i++) {
            expect(Array.from(buffers[0].slice(i * 16 + 6, i * 16 + 10))).toEqual([0, 20, 0, 20]);
        }
    });

    it("uses shared join offsets in the uploaded stroke triangles", () => {
        const { renderer, buffers } = recordingGL();
        renderer.drawLines([
            { x1: 0, y1: 0, x2: 10, y2: 0, width: 2, color: [1, 0, 0, 0.5], endOffset: { x: -1, y: 1 } },
            { x1: 10, y1: 0, x2: 10, y2: 10, width: 2, color: [1, 0, 0, 0.5], startOffset: { x: -1, y: 1 } },
        ]);
        const vertices = Array.from({ length: 12 }, (_, i) => Array.from(buffers[0].slice(i * 8, i * 8 + 2)));
        expect(vertices[2]).toEqual([9, 1]);
        expect(vertices[4]).toEqual([11, -1]);
        expect(vertices[6]).toEqual(vertices[2]);
        expect(vertices[7]).toEqual(vertices[4]);
    });

    it("isolates translucent contour overlap while preserving adjacent line order and stencil state", () => {
        const { renderer, calls } = recordingGL();
        const a = {},
            b = {};
        const line = {
            x1: 0,
            y1: 0,
            x2: 10,
            y2: 10,
            width: 10,
            color: [1, 0, 0, 0.5] as [number, number, number, number],
        };
        calls.length = 0;
        renderer.drawLines([
            line,
            { ...line, strokeGroup: a },
            { ...line, strokeGroup: a },
            { ...line, strokeGroup: b },
            { ...line, strokeGroup: {}, color: [1, 0, 0, 1] },
            line,
        ]);
        expect(
            calls.filter(([name]) =>
                ["drawArrays", "enable", "disable", "stencilFunc", "stencilOp", "clear"].includes(String(name)),
            ),
        ).toEqual([
            ["drawArrays", "TRIANGLES", 0, 6],
            ["enable", "STENCIL_TEST"],
            ["stencilFunc", "EQUAL", 0, 0xff],
            ["stencilOp", "KEEP", "KEEP", "INCR"],
            ["drawArrays", "TRIANGLES", 6, 12],
            ["clear", "STENCIL_BUFFER_BIT"],
            ["disable", "STENCIL_TEST"],
            ["enable", "STENCIL_TEST"],
            ["stencilFunc", "EQUAL", 0, 0xff],
            ["stencilOp", "KEEP", "KEEP", "INCR"],
            ["drawArrays", "TRIANGLES", 18, 6],
            ["clear", "STENCIL_BUFFER_BIT"],
            ["disable", "STENCIL_TEST"],
            ["drawArrays", "TRIANGLES", 24, 12],
        ]);
        calls.length = 0;
        renderer.fillPath(
            [
                [
                    { x: 0, y: 0 },
                    { x: 20, y: 0 },
                    { x: 10, y: 20 },
                ],
            ],
            [0, 1, 0, 0.5],
            false,
        );
        expect(calls).toContainEqual(["colorMask", true, true, true, true]);
        expect(calls).toContainEqual(["stencilOp", "ZERO", "ZERO", "ZERO"]);
        expect(calls[calls.length - 1]).toEqual(["disable", "STENCIL_TEST"]);
    });

    it.each([shapeFragmentShaderAA(), SHAPE_FRAGMENT_SHADER_HARD, SHAPE_FRAGMENT_SHADER_AA_300])(
        "checks actual corner regions in every shader variant",
        (shader) => {
            expect(shader).toContain("fromCorner.x < radius && fromCorner.y < radius");
            expect(shader).toContain("cornerDistance(b - p, r.x, dist)");
            expect(shader).toContain("cornerDistance(b + p, r.w, dist)");
            expect(shader).not.toContain("min(v_radius");
            expect(shader).not.toContain("p.x > 0.0");
        },
    );
});
