import { describe, expect, it } from "vitest";
import { GLRenderer } from "../../src/modules/gl/GLRenderer";

/**
 * Permissive WebGL stub recording the scissor calls. Unknown members resolve to
 * functions returning a fresh object, which satisfies shader compile/link.
 */
function makeFakeGL() {
    const calls: Array<{ op: string; args: number[] }> = [];
    const overrides: Record<string, unknown> = {
        SCISSOR_TEST: 0xc11,
        enable: (cap: number) => void calls.push({ op: "enable", args: [cap] }),
        disable: (cap: number) => void calls.push({ op: "disable", args: [cap] }),
        scissor: (...args: number[]) => void calls.push({ op: "scissor", args }),
        createTexture: () => ({}),
    };

    const target: Record<string, unknown> = {};
    const gl = new Proxy(target, {
        get(_t, prop: string) {
            if (prop in overrides) {
                return overrides[prop];
            }
            if (!(prop in target)) {
                target[prop] = () => ({});
            }
            return target[prop];
        },
    }) as unknown as WebGLRenderingContext;

    return { gl, calls };
}

describe("GLRenderer scissor", () => {
    it("flips y and scales to device pixels", () => {
        const { gl, calls } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        // 400x300 CSS at dpr 2
        renderer.setSize(800, 600, 400, 300);

        renderer.setScissor(10, 20, 100, 50);

        const scissor = calls.find((c) => c.op === "scissor")!;
        // x scales; y is measured from the bottom: 300 - (20 + 50) = 230
        expect(scissor.args).toEqual([20, 460, 200, 100]);
        expect(calls.some((c) => c.op === "enable" && c.args[0] === 0xc11)).toBe(true);
    });

    it("passes CSS pixels straight through at dpr 1", () => {
        const { gl, calls } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        renderer.setSize(400, 300, 400, 300);

        renderer.setScissor(10, 20, 100, 50);

        expect(calls.find((c) => c.op === "scissor")!.args).toEqual([10, 230, 100, 50]);
    });

    it("never asks for a negative extent", () => {
        const { gl, calls } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        renderer.setSize(400, 300, 400, 300);

        renderer.setScissor(10, 20, -100, -50);

        const scissor = calls.find((c) => c.op === "scissor")!;
        expect(scissor.args[2]).toBe(0);
        expect(scissor.args[3]).toBe(0);
    });

    it("releases the scissor test", () => {
        const { gl, calls } = makeFakeGL();
        const renderer = new GLRenderer(gl);

        renderer.clearScissor();

        expect(calls.some((c) => c.op === "disable" && c.args[0] === 0xc11)).toBe(true);
    });
});
