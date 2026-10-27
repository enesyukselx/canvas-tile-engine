import { describe, expect, it, vi } from "vitest";
// Through the package entry, so the test also pins the public export.
import { CanvasTileEngine, ConfigValidationError, fitScale } from "../../src";
import type { CanvasTileEngineConfig, IRenderer, ReducedMotionSetting } from "../../src/types";

type Mount = Record<string, never>;

function createMockRenderer(): IRenderer<Mount> {
    return {
        init: vi.fn(),
        setupEvents: vi.fn(),
        render: vi.fn(),
        resize: vi.fn(),
        resizeWithAnimation: vi.fn(),
        destroy: vi.fn(),
        getDrawAPI: vi.fn(),
        getImageLoader: vi.fn(),
    } as unknown as IRenderer<Mount>;
}

const config: CanvasTileEngineConfig = {
    scale: 1,
    minScale: 0.5,
    maxScale: 2,
    size: { width: 800, height: 600 },
};

function createEngine(overrides: Partial<CanvasTileEngineConfig> = {}) {
    return new CanvasTileEngine<Mount>({}, { ...config, ...overrides }, createMockRenderer());
}

function thrownBy(run: () => unknown): unknown {
    try {
        run();
    } catch (error) {
        return error;
    }
    throw new Error("expected the call to throw");
}

const PREFIX = "[CanvasTileEngine] Invalid config: ";

describe("ConfigValidationError", () => {
    it("is a named Error subclass", () => {
        const error = new ConfigValidationError("boom");
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("ConfigValidationError");
        expect(error.message).toBe("boom");
        expect(String(error)).toBe("ConfigValidationError: boom");
        expect(error.stack?.split("\n")[0]).toBe("ConfigValidationError: boom");
    });

    it("keeps name on the prototype, non-enumerable like the built-in errors", () => {
        const error = new ConfigValidationError("boom");
        expect(Object.keys(error)).toEqual([]);
        expect(Object.hasOwn(error, "name")).toBe(false);
        expect(Object.getOwnPropertyDescriptor(ConfigValidationError.prototype, "name")).toEqual({
            value: "ConfigValidationError",
            writable: true,
            enumerable: false,
            configurable: true,
        });
    });

    // Every message is the exact text these sites threw as a plain Error.
    it.each<[string, () => unknown, string]>([
        ["constructor: scale", () => createEngine({ scale: 0 }), "scale must be positive, got 0"],
        [
            "constructor: bounds",
            () => createEngine({ bounds: { minX: 1, maxX: 0, minY: 0, maxY: 1 } }),
            "bounds.minX (1) must be less than bounds.maxX (0)",
        ],
        ["setScale", () => createEngine().setScale(NaN), "scale must be a finite number, got NaN"],
        ["goScale", () => createEngine().goScale(-1), "scale must be positive, got -1"],
        [
            "setScaleLimits",
            () => createEngine().setScaleLimits(4, 2),
            "minScale (4) cannot be greater than maxScale (2)",
        ],
        [
            "setBounds",
            () => createEngine().setBounds({ minX: 5, maxX: 5, minY: 0, maxY: 1 }),
            "bounds.minX (5) must be less than bounds.maxX (5)",
        ],
        [
            "setCenter",
            () => createEngine().setCenter({ x: NaN, y: 0 }),
            "x coordinate must be a finite number, got NaN",
        ],
        ["goCenter", () => createEngine().goCenter(0, Infinity), "y coordinate must be a finite number, got Infinity"],
        [
            "fitBounds",
            () => createEngine().fitBounds({ minX: 10, maxX: 0, minY: 0, maxY: 10 }),
            "fitBounds bounds.minX (10) must be less than bounds.maxX (0)",
        ],
        [
            "fitScale",
            () => fitScale({ minX: 0, maxX: 10, minY: 0, maxY: 10 }, { width: 0, height: 10 }),
            "fitScale size.width must be a positive finite number, got 0",
        ],
        [
            "setAccessibility",
            () => createEngine().setAccessibility({ focusable: "yes" as unknown as boolean }),
            "accessibility.focusable must be a boolean, got yes",
        ],
        [
            "setReducedMotion",
            () => createEngine().setReducedMotion("sometimes" as ReducedMotionSetting),
            'accessibility.reducedMotion must be true, false, or "auto", got sometimes',
        ],
    ])("%s throws a ConfigValidationError with the documented message", (_, run, message) => {
        const error = thrownBy(run);
        expect(error).toBeInstanceOf(ConfigValidationError);
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).name).toBe("ConfigValidationError");
        expect((error as Error).message).toBe(PREFIX + message);
    });

    it("leaves the drawGridLines cellSize check a RangeError", () => {
        const error = thrownBy(() => createEngine().drawGridLines(0));
        expect(error).toBeInstanceOf(RangeError);
        expect(error).not.toBeInstanceOf(ConfigValidationError);
    });
});
