import { describe, expect, it } from "vitest";
import { validateConfig, validateBounds, validateCoords, validateScale } from "../../src/utils/validateConfig";
import { CanvasTileEngineConfig } from "../../src/types";

const validConfig: CanvasTileEngineConfig = {
    scale: 50,
    size: { width: 500, height: 500 },
};

describe("validateConfig", () => {
    describe("scale validation", () => {
        it("accepts valid positive scale", () => {
            expect(() => validateConfig(validConfig)).not.toThrow();
        });

        it("throws on negative scale", () => {
            expect(() => validateConfig({ ...validConfig, scale: -5 })).toThrow("scale must be positive, got -5");
        });

        it("throws on zero scale", () => {
            expect(() => validateConfig({ ...validConfig, scale: 0 })).toThrow("scale must be positive, got 0");
        });

        it("throws on NaN scale", () => {
            expect(() => validateConfig({ ...validConfig, scale: NaN })).toThrow("scale must be a finite number");
        });

        it("throws on Infinity scale", () => {
            expect(() => validateConfig({ ...validConfig, scale: Infinity })).toThrow("scale must be a finite number");
        });
    });

    describe("minScale/maxScale validation", () => {
        it("accepts valid minScale and maxScale", () => {
            expect(() => validateConfig({ ...validConfig, minScale: 10, maxScale: 100 })).not.toThrow();
        });

        it("throws when minScale > maxScale", () => {
            expect(() => validateConfig({ ...validConfig, minScale: 100, maxScale: 10 })).toThrow(
                "minScale (100) cannot be greater than maxScale (10)"
            );
        });

        it("throws on negative minScale", () => {
            expect(() => validateConfig({ ...validConfig, minScale: -5 })).toThrow("minScale must be positive");
        });

        it("throws on negative maxScale", () => {
            expect(() => validateConfig({ ...validConfig, maxScale: -5 })).toThrow("maxScale must be positive");
        });

        it("throws on NaN minScale", () => {
            expect(() => validateConfig({ ...validConfig, minScale: NaN })).toThrow("minScale must be a finite number");
        });

        it("throws on NaN maxScale", () => {
            expect(() => validateConfig({ ...validConfig, maxScale: NaN })).toThrow("maxScale must be a finite number");
        });
    });

    describe("size validation", () => {
        it("throws when size is missing", () => {
            expect(() => validateConfig({ scale: 50 } as CanvasTileEngineConfig)).toThrow(
                "size is required and must be an object"
            );
        });

        it("throws on zero width", () => {
            expect(() => validateConfig({ ...validConfig, size: { width: 0, height: 500 } })).toThrow(
                "size.width must be positive"
            );
        });

        it("throws on zero height", () => {
            expect(() => validateConfig({ ...validConfig, size: { width: 500, height: 0 } })).toThrow(
                "size.height must be positive"
            );
        });

        it("throws on negative width", () => {
            expect(() => validateConfig({ ...validConfig, size: { width: -100, height: 500 } })).toThrow(
                "size.width must be positive"
            );
        });

        it("throws on NaN width", () => {
            expect(() => validateConfig({ ...validConfig, size: { width: NaN, height: 500 } })).toThrow(
                "size.width must be a finite number"
            );
        });

        it("throws on NaN height", () => {
            expect(() => validateConfig({ ...validConfig, size: { width: 500, height: NaN } })).toThrow(
                "size.height must be a finite number"
            );
        });

        it("throws on negative minWidth", () => {
            expect(() =>
                validateConfig({ ...validConfig, size: { width: 500, height: 500, minWidth: -5 } })
            ).toThrow("size.minWidth must be positive");
        });

        it("throws on negative maxWidth", () => {
            expect(() =>
                validateConfig({ ...validConfig, size: { width: 500, height: 500, maxWidth: -5 } })
            ).toThrow("size.maxWidth must be positive");
        });

        it("throws on negative minHeight", () => {
            expect(() =>
                validateConfig({ ...validConfig, size: { width: 500, height: 500, minHeight: -5 } })
            ).toThrow("size.minHeight must be positive");
        });

        it("throws on negative maxHeight", () => {
            expect(() =>
                validateConfig({ ...validConfig, size: { width: 500, height: 500, maxHeight: -5 } })
            ).toThrow("size.maxHeight must be positive");
        });

        it("accepts valid minWidth <= maxWidth", () => {
            expect(() =>
                validateConfig({ ...validConfig, size: { width: 500, height: 500, minWidth: 200, maxWidth: 800 } })
            ).not.toThrow();
        });

        it("throws when minWidth > maxWidth", () => {
            expect(() =>
                validateConfig({ ...validConfig, size: { width: 500, height: 500, minWidth: 800, maxWidth: 400 } })
            ).toThrow("size.minWidth (800) cannot be greater than size.maxWidth (400)");
        });

        it("accepts valid minHeight <= maxHeight", () => {
            expect(() =>
                validateConfig({ ...validConfig, size: { width: 500, height: 500, minHeight: 200, maxHeight: 800 } })
            ).not.toThrow();
        });

        it("throws when minHeight > maxHeight", () => {
            expect(() =>
                validateConfig({ ...validConfig, size: { width: 500, height: 500, minHeight: 800, maxHeight: 400 } })
            ).toThrow("size.minHeight (800) cannot be greater than size.maxHeight (400)");
        });
    });

    describe("bounds validation", () => {
        it("accepts valid bounds", () => {
            expect(() =>
                validateConfig({ ...validConfig, bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 } })
            ).not.toThrow();
        });

        it("accepts Infinity bounds", () => {
            expect(() =>
                validateConfig({
                    ...validConfig,
                    bounds: { minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity },
                })
            ).not.toThrow();
        });

        it("throws when minX/maxX are not numbers", () => {
            expect(() =>
                validateConfig({
                    ...validConfig,
                    bounds: { minX: "0" as unknown as number, maxX: 100, minY: 0, maxY: 100 },
                })
            ).toThrow("bounds.minX and bounds.maxX must be numbers");
        });

        it("throws when minY/maxY are not numbers", () => {
            expect(() =>
                validateConfig({
                    ...validConfig,
                    bounds: { minX: 0, maxX: 100, minY: null as unknown as number, maxY: 100 },
                })
            ).toThrow("bounds.minY and bounds.maxY must be numbers");
        });

        it("throws when minX >= maxX (finite)", () => {
            expect(() =>
                validateConfig({ ...validConfig, bounds: { minX: 100, maxX: 50, minY: 0, maxY: 100 } })
            ).toThrow("bounds.minX (100) must be less than bounds.maxX (50)");
        });

        it("throws when minY >= maxY (finite)", () => {
            expect(() =>
                validateConfig({ ...validConfig, bounds: { minX: 0, maxX: 100, minY: 100, maxY: 50 } })
            ).toThrow("bounds.minY (100) must be less than bounds.maxY (50)");
        });
    });
});

describe("validateBounds", () => {
    it("accepts valid bounds", () => {
        expect(() => validateBounds({ minX: 0, maxX: 100, minY: 0, maxY: 100 })).not.toThrow();
    });

    it("accepts Infinity bounds", () => {
        expect(() =>
            validateBounds({ minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity })
        ).not.toThrow();
    });

    it("throws when minX/maxX are not numbers", () => {
        expect(() =>
            validateBounds({ minX: "0" as unknown as number, maxX: 100, minY: 0, maxY: 100 })
        ).toThrow("bounds.minX and bounds.maxX must be numbers");
    });

    it("throws when minY/maxY are not numbers", () => {
        expect(() =>
            validateBounds({ minX: 0, maxX: 100, minY: undefined as unknown as number, maxY: 100 })
        ).toThrow("bounds.minY and bounds.maxY must be numbers");
    });

    it("throws when minX >= maxX", () => {
        expect(() => validateBounds({ minX: 100, maxX: 50, minY: 0, maxY: 100 })).toThrow(
            "bounds.minX (100) must be less than bounds.maxX (50)"
        );
    });

    it("throws when minY >= maxY", () => {
        expect(() => validateBounds({ minX: 0, maxX: 100, minY: 100, maxY: 50 })).toThrow(
            "bounds.minY (100) must be less than bounds.maxY (50)"
        );
    });
});

describe("validateCoords", () => {
    it("accepts valid coordinates", () => {
        expect(() => validateCoords(0, 0)).not.toThrow();
        expect(() => validateCoords(-100, 200)).not.toThrow();
        expect(() => validateCoords(0.5, 0.5)).not.toThrow();
    });

    it("throws on NaN x", () => {
        expect(() => validateCoords(NaN, 0)).toThrow("x coordinate must be a finite number");
    });

    it("throws on NaN y", () => {
        expect(() => validateCoords(0, NaN)).toThrow("y coordinate must be a finite number");
    });

    it("throws on Infinity x", () => {
        expect(() => validateCoords(Infinity, 0)).toThrow("x coordinate must be a finite number");
    });

    it("throws on Infinity y", () => {
        expect(() => validateCoords(0, -Infinity)).toThrow("y coordinate must be a finite number");
    });
});

describe("validateScale", () => {
    it("accepts valid positive scale", () => {
        expect(() => validateScale(1)).not.toThrow();
        expect(() => validateScale(50)).not.toThrow();
        expect(() => validateScale(0.5)).not.toThrow();
    });

    it("throws on zero scale", () => {
        expect(() => validateScale(0)).toThrow("scale must be positive, got 0");
    });

    it("throws on negative scale", () => {
        expect(() => validateScale(-5)).toThrow("scale must be positive, got -5");
    });

    it("throws on NaN scale", () => {
        expect(() => validateScale(NaN)).toThrow("scale must be a finite number");
    });

    it("throws on Infinity scale", () => {
        expect(() => validateScale(Infinity)).toThrow("scale must be a finite number");
    });
});
