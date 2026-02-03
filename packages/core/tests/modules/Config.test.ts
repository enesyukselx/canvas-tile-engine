import { describe, expect, it } from "vitest";
import { Config } from "../../src/modules/Config";
import { SCALE_LIMITS, SIZE_LIMITS, RENDER_DEFAULTS } from "../../src/constants";

describe("Config", () => {
    const minimalConfig = {
        scale: 1,
        size: { width: 800, height: 600 },
    };

    describe("constructor", () => {
        it("creates config with minimal required fields", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.scale).toBe(1);
            expect(result.size.width).toBe(800);
            expect(result.size.height).toBe(600);
        });

        it("applies default minScale based on scale", () => {
            const config = new Config({ scale: 2, size: { width: 800, height: 600 } });
            const result = config.get();
            expect(result.minScale).toBe(2 * SCALE_LIMITS.MIN_SCALE_MULTIPLIER);
        });

        it("applies default maxScale based on scale", () => {
            const config = new Config({ scale: 2, size: { width: 800, height: 600 } });
            const result = config.get();
            expect(result.maxScale).toBe(2 * SCALE_LIMITS.MAX_SCALE_MULTIPLIER);
        });

        it("uses provided minScale and maxScale", () => {
            const config = new Config({
                scale: 1,
                minScale: 0.1,
                maxScale: 10,
                size: { width: 800, height: 600 },
            });
            const result = config.get();
            expect(result.minScale).toBe(0.1);
            expect(result.maxScale).toBe(10);
        });

        it("applies default size limits", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.size.minWidth).toBe(SIZE_LIMITS.MIN_WIDTH);
            expect(result.size.minHeight).toBe(SIZE_LIMITS.MIN_HEIGHT);
            expect(result.size.maxWidth).toBe(SIZE_LIMITS.MAX_WIDTH);
            expect(result.size.maxHeight).toBe(SIZE_LIMITS.MAX_HEIGHT);
        });

        it("uses provided size limits", () => {
            const config = new Config({
                scale: 1,
                size: {
                    width: 800,
                    height: 600,
                    minWidth: 200,
                    minHeight: 150,
                    maxWidth: 1920,
                    maxHeight: 1080,
                },
            });
            const result = config.get();
            expect(result.size.minWidth).toBe(200);
            expect(result.size.minHeight).toBe(150);
            expect(result.size.maxWidth).toBe(1920);
            expect(result.size.maxHeight).toBe(1080);
        });

        it("applies default backgroundColor", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.backgroundColor).toBe(RENDER_DEFAULTS.BACKGROUND_COLOR);
        });

        it("uses provided backgroundColor", () => {
            const config = new Config({
                ...minimalConfig,
                backgroundColor: "#000000",
            });
            const result = config.get();
            expect(result.backgroundColor).toBe("#000000");
        });

        it("applies default gridAligned as false", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.gridAligned).toBe(false);
        });

        it("uses provided gridAligned", () => {
            const config = new Config({
                ...minimalConfig,
                gridAligned: true,
            });
            const result = config.get();
            expect(result.gridAligned).toBe(true);
        });

        it("applies default responsive as false", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.responsive).toBe(false);
        });

        it("uses provided responsive mode", () => {
            const config = new Config({
                ...minimalConfig,
                responsive: "preserve-scale",
            });
            const result = config.get();
            expect(result.responsive).toBe("preserve-scale");
        });

        it("applies default event handlers as false", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.eventHandlers.click).toBe(false);
            expect(result.eventHandlers.rightClick).toBe(false);
            expect(result.eventHandlers.hover).toBe(false);
            expect(result.eventHandlers.drag).toBe(false);
            expect(result.eventHandlers.zoom).toBe(false);
            expect(result.eventHandlers.resize).toBe(false);
        });

        it("uses provided event handlers", () => {
            const config = new Config({
                ...minimalConfig,
                eventHandlers: {
                    click: true,
                    drag: true,
                    zoom: true,
                },
            });
            const result = config.get();
            expect(result.eventHandlers.click).toBe(true);
            expect(result.eventHandlers.drag).toBe(true);
            expect(result.eventHandlers.zoom).toBe(true);
            expect(result.eventHandlers.hover).toBe(false);
        });

        it("applies default bounds as infinity", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.bounds.minX).toBe(-Infinity);
            expect(result.bounds.maxX).toBe(Infinity);
            expect(result.bounds.minY).toBe(-Infinity);
            expect(result.bounds.maxY).toBe(Infinity);
        });

        it("uses provided bounds", () => {
            const config = new Config({
                ...minimalConfig,
                bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
            });
            const result = config.get();
            expect(result.bounds.minX).toBe(0);
            expect(result.bounds.maxX).toBe(100);
            expect(result.bounds.minY).toBe(0);
            expect(result.bounds.maxY).toBe(100);
        });

        it("applies default coordinates settings", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.coordinates.enabled).toBe(false);
            expect(result.coordinates.shownScaleRange?.min).toBe(0);
            expect(result.coordinates.shownScaleRange?.max).toBe(Infinity);
        });

        it("uses provided coordinates settings", () => {
            const config = new Config({
                ...minimalConfig,
                coordinates: {
                    enabled: true,
                    shownScaleRange: { min: 0.5, max: 2 },
                },
            });
            const result = config.get();
            expect(result.coordinates.enabled).toBe(true);
            expect(result.coordinates.shownScaleRange?.min).toBe(0.5);
            expect(result.coordinates.shownScaleRange?.max).toBe(2);
        });

        it("applies default cursor settings", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.cursor.default).toBe("default");
            expect(result.cursor.move).toBe("move");
        });

        it("uses provided cursor settings", () => {
            const config = new Config({
                ...minimalConfig,
                cursor: {
                    default: "crosshair",
                    move: "grab",
                },
            });
            const result = config.get();
            expect(result.cursor.default).toBe("crosshair");
            expect(result.cursor.move).toBe("grab");
        });

        it("applies default debug settings", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(result.debug.enabled).toBe(false);
            expect(result.debug.hud?.enabled).toBe(false);
        });

        it("uses provided debug settings", () => {
            const config = new Config({
                ...minimalConfig,
                debug: {
                    enabled: true,
                    hud: {
                        enabled: true,
                        fps: true,
                        scale: true,
                    },
                },
            });
            const result = config.get();
            expect(result.debug.enabled).toBe(true);
            expect(result.debug.hud?.enabled).toBe(true);
            expect(result.debug.hud?.fps).toBe(true);
            expect(result.debug.hud?.scale).toBe(true);
        });
    });

    describe("get", () => {
        it("returns a defensive copy", () => {
            const config = new Config(minimalConfig);
            const result1 = config.get();
            const result2 = config.get();
            expect(result1).not.toBe(result2);
            expect(result1.size).not.toBe(result2.size);
            expect(result1.eventHandlers).not.toBe(result2.eventHandlers);
        });

        it("prevents mutation of returned config", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            (result as { scale: number }).scale = 999;
            expect(config.get().scale).toBe(1);
        });
    });

    describe("updateEventHandlers", () => {
        it("updates specified event handlers", () => {
            const config = new Config(minimalConfig);
            config.updateEventHandlers({ click: true, hover: true });
            const result = config.get();
            expect(result.eventHandlers.click).toBe(true);
            expect(result.eventHandlers.hover).toBe(true);
        });

        it("preserves unspecified event handlers", () => {
            const config = new Config({
                ...minimalConfig,
                eventHandlers: { drag: true, zoom: true },
            });
            config.updateEventHandlers({ click: true });
            const result = config.get();
            expect(result.eventHandlers.click).toBe(true);
            expect(result.eventHandlers.drag).toBe(true);
            expect(result.eventHandlers.zoom).toBe(true);
        });

        it("can disable event handlers", () => {
            const config = new Config({
                ...minimalConfig,
                eventHandlers: { click: true, drag: true },
            });
            config.updateEventHandlers({ click: false });
            const result = config.get();
            expect(result.eventHandlers.click).toBe(false);
            expect(result.eventHandlers.drag).toBe(true);
        });
    });

    describe("updateBounds", () => {
        it("updates bounds", () => {
            const config = new Config(minimalConfig);
            config.updateBounds({ minX: 10, maxX: 200, minY: 20, maxY: 300 });
            const result = config.get();
            expect(result.bounds.minX).toBe(10);
            expect(result.bounds.maxX).toBe(200);
            expect(result.bounds.minY).toBe(20);
            expect(result.bounds.maxY).toBe(300);
        });

        it("allows infinity bounds", () => {
            const config = new Config({
                ...minimalConfig,
                bounds: { minX: 0, maxX: 100, minY: 0, maxY: 100 },
            });
            config.updateBounds({
                minX: -Infinity,
                maxX: Infinity,
                minY: -Infinity,
                maxY: Infinity,
            });
            const result = config.get();
            expect(result.bounds.minX).toBe(-Infinity);
            expect(result.bounds.maxX).toBe(Infinity);
        });

        it("throws on invalid bounds (minX > maxX)", () => {
            const config = new Config(minimalConfig);
            expect(() => {
                config.updateBounds({ minX: 100, maxX: 0, minY: 0, maxY: 100 });
            }).toThrow();
        });

        it("throws on invalid bounds (minY > maxY)", () => {
            const config = new Config(minimalConfig);
            expect(() => {
                config.updateBounds({ minX: 0, maxX: 100, minY: 100, maxY: 0 });
            }).toThrow();
        });
    });
});
