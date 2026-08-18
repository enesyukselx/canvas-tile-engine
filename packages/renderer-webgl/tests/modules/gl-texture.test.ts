import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GLRenderer } from "../../src/modules/gl/GLRenderer";

/**
 * WebGL refuses to upload an origin-tainted image: `texImage2D` throws a
 * SecurityError. That happens for any image fetched without CORS, which is
 * exactly what the renderers' `crossOrigin: null` opt-out produces, so the
 * upload path has to degrade to "skip this image" rather than throw mid-frame.
 */
function securityError() {
    return Object.assign(new Error("The canvas has been tainted by cross-origin data."), {
        name: "SecurityError",
    });
}

/**
 * Permissive WebGL stub: every unknown member resolves to a function returning a
 * fresh object, which is enough for shader compilation and linking (both are
 * only checked for truthiness) without hand-stubbing the whole GL surface.
 */
function makeFakeGL(taintedSources: Set<unknown> = new Set()) {
    const calls = { texImage2D: 0, deleteTexture: 0 };

    const overrides: Record<string, unknown> = {
        createTexture: () => ({}),
        deleteTexture: () => {
            calls.deleteTexture++;
        },
        texImage2D: (...args: unknown[]) => {
            calls.texImage2D++;
            // Signature is (target, level, internalFormat, format, type, source)
            if (taintedSources.has(args[5])) {
                throw securityError();
            }
        },
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
    });

    return { gl: gl as unknown as WebGLRenderingContext, calls };
}

const image = (width = 10, height = 10) => ({ width, height }) as unknown as TexImageSource;

describe("GLRenderer texture upload", () => {
    beforeEach(() => {
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("uploads and caches a CORS-clean image", () => {
        const { gl, calls } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        const src = image();

        const first = renderer.getTexture(src);
        const second = renderer.getTexture(src);

        expect(first).not.toBeNull();
        expect(second).toBe(first);
        // Second call is served from cache
        expect(calls.texImage2D).toBe(1);
    });

    it("skips a tainted image instead of throwing, and frees its texture", () => {
        const src = image();
        const { gl, calls } = makeFakeGL(new Set([src]));
        const renderer = new GLRenderer(gl);

        expect(() => renderer.getTexture(src)).not.toThrow();
        expect(renderer.getTexture(src)).toBeNull();
        // The half-built texture must not leak
        expect(calls.deleteTexture).toBe(1);
    });

    it("attempts a tainted upload only once, however many frames draw it", () => {
        const src = image();
        const { gl, calls } = makeFakeGL(new Set([src]));
        const renderer = new GLRenderer(gl);

        renderer.getTexture(src);
        renderer.getTexture(src);
        renderer.getTexture(src);

        // Tainting never resolves on its own; re-throwing every frame would be
        // pure overhead and would flood the console.
        expect(calls.texImage2D).toBe(1);
        expect(console.error).toHaveBeenCalledTimes(1);
    });

    it("explains the CORS cause when it refuses an image", () => {
        const src = image();
        const { gl } = makeFakeGL(new Set([src]));
        const renderer = new GLRenderer(gl);

        renderer.getTexture(src);

        expect(console.error).toHaveBeenCalledWith(
            expect.stringContaining("Access-Control-Allow-Origin"),
            src,
            expect.anything(),
        );
    });

    it("keeps drawing the other images in the frame", () => {
        const tainted = image();
        const clean = image();
        const { gl } = makeFakeGL(new Set([tainted]));
        const renderer = new GLRenderer(gl);

        expect(renderer.getTexture(tainted)).toBeNull();
        expect(renderer.getTexture(clean)).not.toBeNull();
    });

    it("retries a tainted source after invalidateTexture", () => {
        const src = image();
        const tainted = new Set<unknown>([src]);
        const { gl, calls } = makeFakeGL(tainted);
        const renderer = new GLRenderer(gl);

        expect(renderer.getTexture(src)).toBeNull();
        expect(calls.texImage2D).toBe(1);

        // Source swapped for a CORS-clean one behind the same object identity
        tainted.delete(src);
        renderer.invalidateTexture(src);

        expect(renderer.getTexture(src)).not.toBeNull();
        expect(calls.texImage2D).toBe(2);
    });

    it("returns null for a source that has not loaded yet", () => {
        const { gl, calls } = makeFakeGL();
        const renderer = new GLRenderer(gl);

        expect(renderer.getTexture(image(0, 0))).toBeNull();
        expect(calls.texImage2D).toBe(0);
    });
});
