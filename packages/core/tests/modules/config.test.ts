import { describe, expect, it } from "vitest";
import { Config } from "../../src/modules/Config";
import type { CanvasTileEngineConfig } from "../../src/types";

const baseConfig: CanvasTileEngineConfig = {
    renderer: "canvas",
    scale: 2,
    size: { width: 100, height: 80 },
};

const makeConfig = (overrides: Partial<CanvasTileEngineConfig> = {}): CanvasTileEngineConfig => ({
    ...baseConfig,
    ...overrides,
    size: { ...baseConfig.size, ...(overrides.size ?? {}) },
    eventHandlers: overrides.eventHandlers,
    bounds: overrides.bounds,
    coordinates: overrides.coordinates,
    cursor: overrides.cursor,
    debug: overrides.debug,
    backgroundColor: overrides.backgroundColor,
});

describe("Config", () => {
    it("merges defaults and freezes nested structures", () => {
        const config = new Config(makeConfig());
        const snapshot = config.get();

        expect(snapshot.scale).toBe(2);
        expect(snapshot.minScale).toBeCloseTo(1); // 2 * 0.5
        expect(snapshot.maxScale).toBeCloseTo(4); // 2 * 2
        expect(snapshot.backgroundColor).toBe("#ffffff");
        expect(snapshot.bounds).toEqual({ minX: -Infinity, maxX: Infinity, minY: -Infinity, maxY: Infinity });
        expect(Object.isFrozen(snapshot.size)).toBe(false); // get() returns copy

        // mutating returned snapshot does not affect internal config
        snapshot.size.width = 999;
        const snapshot2 = config.get();
        expect(snapshot2.size.width).toBe(100);
    });

    it("respects provided overrides for limits and debug", () => {
        const config = new Config(
            makeConfig({
                minScale: 0.1,
                maxScale: 10,
                size: { ...baseConfig.size, minWidth: 10, minHeight: 20, maxWidth: 500, maxHeight: 400 },
                debug: { enabled: true, hud: { enabled: true, fps: true } },
                coordinates: { enabled: true, shownScaleRange: { min: 1, max: 5 } },
            })
        );

        const snapshot = config.get();
        expect(snapshot.minScale).toBe(0.1);
        expect(snapshot.maxScale).toBe(10);
        expect(snapshot.size).toMatchObject({
            minWidth: 10,
            minHeight: 20,
            maxWidth: 500,
            maxHeight: 400,
        });
        expect(snapshot.debug.enabled).toBe(true);
        expect(snapshot.debug.hud?.enabled).toBe(true);
        expect(snapshot.debug.hud?.fps).toBe(true);
        expect(snapshot.coordinates.enabled).toBe(true);
        expect(snapshot.coordinates.shownScaleRange).toEqual({ min: 1, max: 5 });
    });

    it("fills shownScaleRange defaults when missing", () => {
        const config = new Config(makeConfig({ coordinates: { enabled: true } }));
        const snapshot = config.get();
        expect(snapshot.coordinates.shownScaleRange).toEqual({ min: 0, max: Infinity });
    });

    it("keeps provided shownScaleRange values and defaults missing parts", () => {
        // @ts-expect-error testing partial shownScaleRange (min provided, max missing)
        const config = new Config(makeConfig({ coordinates: { enabled: true, shownScaleRange: { min: 2 } } }));
        const snapshot = config.get();
        expect(snapshot.coordinates.shownScaleRange).toEqual({ min: 2, max: Infinity });
    });

    it("defaults shownScaleRange min when only max is provided", () => {
        // @ts-expect-error testing partial shownScaleRange (max provided, min missing)
        const config = new Config(makeConfig({ coordinates: { enabled: true, shownScaleRange: { max: 10 } } }));
        const snapshot = config.get();
        expect(snapshot.coordinates.shownScaleRange).toEqual({ min: 0, max: 10 });
    });

    it("updates event handlers immutably", () => {
        const config = new Config(makeConfig());
        const first = config.get().eventHandlers;
        config.updateEventHandlers({ click: true });
        const updated = config.get().eventHandlers;
        expect(updated.click).toBe(true);
        expect(first).not.toBe(updated);
    });

    it("updates bounds immutably", () => {
        const config = new Config(makeConfig());
        const first = config.get().bounds;
        const nextBounds = { minX: 0, maxX: 10, minY: -5, maxY: 5 };
        config.updateBounds(nextBounds);
        const updated = config.get().bounds;
        expect(updated).toEqual(nextBounds);
        expect(first).not.toBe(updated);
    });
});
