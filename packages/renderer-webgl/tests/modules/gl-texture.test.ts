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
    /** Every texture handed to deleteTexture, in order. */
    const deleted: unknown[] = [];
    /** Every GL member read, so a test can assert that nothing touched the context. */
    const log: string[] = [];

    const overrides: Record<string, unknown> = {
        createTexture: () => ({}),
        deleteTexture: (texture: unknown) => {
            calls.deleteTexture++;
            deleted.push(texture);
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
            log.push(prop);
            if (prop in overrides) {
                return overrides[prop];
            }
            if (!(prop in target)) {
                target[prop] = () => ({});
            }
            return target[prop];
        },
    });

    return { gl: gl as unknown as WebGLRenderingContext, calls, deleted, log };
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

/**
 * Deterministic stand-in for FinalizationRegistry. The real one runs cleanups
 * whenever the collector gets to them, so tests call `collect(target)` to
 * simulate a source being garbage-collected, and `fire(held)` to run a
 * cleanup that was already queued when its registration was dropped. Unlike
 * the real registry it holds targets strongly, which is harmless in a stub.
 */
interface Cell {
    target: object;
    held: unknown;
    token: object | undefined;
}

const registries: FakeFinalizationRegistry[] = [];

class FakeFinalizationRegistry {
    cells: Cell[] = [];

    constructor(readonly cleanup: (held: unknown) => void) {
        registries.push(this);
    }

    register(target: object, held: unknown, token?: object) {
        this.cells.push({ target, held, token });
    }

    unregister(token: object): boolean {
        const before = this.cells.length;
        this.cells = this.cells.filter((cell) => cell.token !== token);
        return this.cells.length !== before;
    }

    collect(target: object) {
        const dead = this.cells.filter((cell) => cell.target === target);
        this.cells = this.cells.filter((cell) => cell.target !== target);
        for (const cell of dead) {
            this.cleanup(cell.held);
        }
    }
}

/** Simulate the collector reclaiming `target`. */
const collect = (target: object) => registries.forEach((registry) => registry.collect(target));
/** Run a cleanup directly, as if it had been queued before its registration was dropped. */
const fire = (held: unknown) => registries.forEach((registry) => registry.cleanup(held));
/** Live registrations across every registry. */
const registrations = () => registries.flatMap((registry) => registry.cells);

/** A source whose dimensions a test can change, like a resized canvas. */
const resizable = () => ({ width: 10, height: 10 });

describe("GLRenderer texture lifetime", () => {
    beforeEach(() => {
        registries.length = 0;
        vi.stubGlobal("FinalizationRegistry", FakeFinalizationRegistry);
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it("deletes a cached texture once its source is garbage-collected", () => {
        const { gl, calls, deleted } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        const dropped = image();
        const kept = image();

        const texture = renderer.getTexture(dropped);
        const keptTexture = renderer.getTexture(kept);
        expect(deleted).toHaveLength(0);

        collect(dropped);

        expect(deleted).toHaveLength(1);
        expect(deleted[0]).toBe(texture);
        // Other sources stay cached
        expect(renderer.getTexture(kept)).toBe(keptTexture);
        expect(calls.texImage2D).toBe(2);
    });

    it("unregisters on invalidateTexture, so a later cleanup cannot delete twice", () => {
        const { gl, deleted } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        const src = image();

        const texture = renderer.getTexture(src);
        expect(registrations()).toHaveLength(1);
        const [{ held }] = registrations();

        renderer.invalidateTexture(src);

        expect(deleted).toHaveLength(1);
        expect(deleted[0]).toBe(texture);
        expect(registrations()).toHaveLength(0);

        // Neither a cleanup already in flight nor a later collection repeats it
        fire(held);
        collect(src);
        expect(deleted).toHaveLength(1);
    });

    it("releases a re-uploaded source's new texture, not the invalidated one", () => {
        const { gl, deleted } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        const src = image();

        renderer.getTexture(src);
        expect(registrations()).toHaveLength(1);
        const [{ held: staleHeld }] = registrations();
        renderer.invalidateTexture(src);
        const replacement = renderer.getTexture(src);
        expect(registrations()).toHaveLength(1);

        fire(staleHeld);
        expect(deleted).toHaveLength(1);

        collect(src);
        expect(deleted).toHaveLength(2);
        expect(deleted[1]).toBe(replacement);
    });

    it("re-uploads a resized source into the same texture under one registration", () => {
        const { gl, calls, deleted } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        const src = resizable();

        const texture = renderer.getTexture(src as unknown as TexImageSource);
        src.width = 20;

        expect(renderer.getTexture(src as unknown as TexImageSource)).toBe(texture);
        expect(calls.texImage2D).toBe(2);
        expect(registrations()).toHaveLength(1);
        expect(deleted).toHaveLength(0);

        collect(src);
        expect(deleted).toHaveLength(1);
        expect(deleted[0]).toBe(texture);
    });

    it("releases a texture whose re-upload fails exactly once", () => {
        const tainted = new Set<unknown>();
        const { gl, deleted } = makeFakeGL(tainted);
        const renderer = new GLRenderer(gl);
        const src = resizable();

        const texture = renderer.getTexture(src as unknown as TexImageSource);
        expect(registrations()).toHaveLength(1);
        const [{ held }] = registrations();

        src.width = 20;
        tainted.add(src);
        expect(renderer.getTexture(src as unknown as TexImageSource)).toBeNull();

        expect(deleted).toHaveLength(1);
        expect(deleted[0]).toBe(texture);
        expect(registrations()).toHaveLength(0);

        fire(held);
        collect(src);
        expect(deleted).toHaveLength(1);
    });

    it("deletes every live texture on dispose, and later cleanups touch no GL", () => {
        const { gl, deleted, log } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        const a = image();
        const b = image();
        const invalidated = image();

        const textureA = renderer.getTexture(a);
        const textureB = renderer.getTexture(b);
        renderer.getTexture(invalidated);
        renderer.invalidateTexture(invalidated);
        const helds = registrations().map((cell) => cell.held);
        expect(helds).toHaveLength(2);

        renderer.dispose();

        // Both live textures go; the invalidated one was freed already and is not freed again
        expect(deleted).toHaveLength(3);
        expect(deleted.slice(1)).toContain(textureA);
        expect(deleted.slice(1)).toContain(textureB);
        expect(registrations()).toHaveLength(0);

        const before = log.length;
        helds.forEach(fire);
        collect(a);
        collect(b);
        expect(log).toHaveLength(before);
    });

    it("does not hold its sources strongly", () => {
        const { gl } = makeFakeGL();
        const renderer = new GLRenderer(gl);
        const src = image();

        renderer.getTexture(src);

        expect(Reflect.get(renderer, "textures")).toBeInstanceOf(WeakMap);
        // No iterable container on the renderer may reach the source...
        for (const value of Object.values(renderer)) {
            const contents =
                value instanceof Map
                    ? [...value.keys(), ...value.values()]
                    : value instanceof Set || Array.isArray(value)
                      ? [...value]
                      : [];
            expect(contents).not.toContain(src);
        }
        // ...and neither may the registry's held value, which it keeps strongly
        expect(registrations()).toHaveLength(1);
        for (const { held } of registrations()) {
            expect(held).not.toBe(src);
            expect(Object.values(held as object)).not.toContain(src);
        }
    });
});
