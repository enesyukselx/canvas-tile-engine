import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { ViewportState } from "../../src/modules/ViewportState";

describe("ViewportState", () => {
    describe("constructor", () => {
        it("initializes with given dimensions", () => {
            const viewport = new ViewportState(800, 600);
            expect(viewport.getSize()).toEqual({ width: 800, height: 600 });
        });

        it("initializes dpr from window.devicePixelRatio", () => {
            const viewport = new ViewportState(800, 600);
            // In test environment, window may not exist or dpr defaults to 1
            expect(viewport.dpr).toBeGreaterThanOrEqual(1);
        });

        it("defaults dpr to 1 when window is undefined", () => {
            const originalWindow = globalThis.window;
            // @ts-expect-error - intentionally setting to undefined for test
            globalThis.window = undefined;
            const viewport = new ViewportState(800, 600);
            expect(viewport.dpr).toBe(1);
            globalThis.window = originalWindow;
        });

        it("defaults dpr to 1 when devicePixelRatio is undefined", () => {
            const originalWindow = globalThis.window;
            globalThis.window = {} as Window & typeof globalThis;
            const viewport = new ViewportState(800, 600);
            expect(viewport.dpr).toBe(1);
            globalThis.window = originalWindow;
        });
    });

    describe("getSize", () => {
        it("returns current width and height", () => {
            const viewport = new ViewportState(1024, 768);
            const size = viewport.getSize();
            expect(size.width).toBe(1024);
            expect(size.height).toBe(768);
        });
    });

    describe("setSize", () => {
        it("updates dimensions", () => {
            const viewport = new ViewportState(800, 600);
            viewport.setSize(1920, 1080);
            expect(viewport.getSize()).toEqual({ width: 1920, height: 1080 });
        });

        it("allows zero dimensions", () => {
            const viewport = new ViewportState(800, 600);
            viewport.setSize(0, 0);
            expect(viewport.getSize()).toEqual({ width: 0, height: 0 });
        });
    });

    describe("dpr", () => {
        it("returns device pixel ratio", () => {
            const viewport = new ViewportState(800, 600);
            expect(typeof viewport.dpr).toBe("number");
            expect(viewport.dpr).toBeGreaterThan(0);
        });
    });

    describe("updateDpr", () => {
        let originalWindow: typeof globalThis.window;

        beforeEach(() => {
            originalWindow = globalThis.window;
        });

        afterEach(() => {
            globalThis.window = originalWindow;
        });

        it("updates dpr from window.devicePixelRatio", () => {
            const viewport = new ViewportState(800, 600);
            // Mock window with different DPR
            globalThis.window = { devicePixelRatio: 2.5 } as Window & typeof globalThis;
            viewport.updateDpr();
            expect(viewport.dpr).toBe(2.5);
        });

        it("defaults to 1 when window is undefined", () => {
            const viewport = new ViewportState(800, 600);
            // @ts-expect-error - intentionally setting to undefined for test
            globalThis.window = undefined;
            viewport.updateDpr();
            expect(viewport.dpr).toBe(1);
        });

        it("defaults to 1 when devicePixelRatio is undefined", () => {
            const viewport = new ViewportState(800, 600);
            globalThis.window = {} as Window & typeof globalThis;
            viewport.updateDpr();
            expect(viewport.dpr).toBe(1);
        });
    });
});
