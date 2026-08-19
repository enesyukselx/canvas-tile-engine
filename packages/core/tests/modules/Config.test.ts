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
            expect(result.eventHandlers.zoom).toBe("pointer");
            expect(result.eventHandlers.hover).toBe(false);
        });

        it('normalizes zoom: true to "pointer"', () => {
            const config = new Config({
                ...minimalConfig,
                eventHandlers: { zoom: true },
            });
            expect(config.get().eventHandlers.zoom).toBe("pointer");
        });

        it("keeps explicit zoom modes as-is", () => {
            const pointerConfig = new Config({
                ...minimalConfig,
                eventHandlers: { zoom: "pointer" },
            });
            expect(pointerConfig.get().eventHandlers.zoom).toBe("pointer");

            const centerConfig = new Config({
                ...minimalConfig,
                eventHandlers: { zoom: "center" },
            });
            expect(centerConfig.get().eventHandlers.zoom).toBe("center");
        });

        it("throws on invalid zoom mode", () => {
            expect(
                () =>
                    new Config({
                        ...minimalConfig,
                        eventHandlers: { zoom: "corner" as unknown as boolean },
                    }),
            ).toThrow(/eventHandlers.zoom/);
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
        it("returns the same snapshot reference until an update happens", () => {
            const config = new Config(minimalConfig);
            const result1 = config.get();
            const result2 = config.get();
            expect(result1).toBe(result2);
        });

        it("prevents mutation of returned config", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            // Frozen snapshot: assignment throws in strict mode
            expect(() => {
                (result as { scale: number }).scale = 999;
            }).toThrow(TypeError);
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
            expect(result.eventHandlers.zoom).toBe("pointer");
        });

        it("normalizes zoom when updated at runtime", () => {
            const config = new Config(minimalConfig);
            config.updateEventHandlers({ zoom: true });
            expect(config.get().eventHandlers.zoom).toBe("pointer");

            config.updateEventHandlers({ zoom: "center" });
            expect(config.get().eventHandlers.zoom).toBe("center");

            config.updateEventHandlers({ zoom: false });
            expect(config.get().eventHandlers.zoom).toBe(false);
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

    describe("updateScaleLimits", () => {
        it("updates minScale and maxScale", () => {
            const config = new Config(minimalConfig);
            config.updateScaleLimits(0.25, 8);
            const result = config.get();
            expect(result.minScale).toBe(0.25);
            expect(result.maxScale).toBe(8);
        });

        it("throws on invalid limits (minScale > maxScale)", () => {
            const config = new Config(minimalConfig);
            expect(() => {
                config.updateScaleLimits(4, 2);
            }).toThrow();
        });

        it("throws on non-positive limits", () => {
            const config = new Config(minimalConfig);
            expect(() => {
                config.updateScaleLimits(0, 2);
            }).toThrow();
        });
    });

    describe("immutable snapshots", () => {
        it("returns a frozen snapshot from get()", () => {
            const config = new Config(minimalConfig);
            const result = config.get();
            expect(Object.isFrozen(result)).toBe(true);
            expect(Object.isFrozen(result.size)).toBe(true);
            expect(Object.isFrozen(result.eventHandlers)).toBe(true);
            expect(Object.isFrozen(result.bounds)).toBe(true);
        });

        it("keeps previously returned snapshots unchanged after updates", () => {
            const config = new Config(minimalConfig);
            const before = config.get();
            config.updateEventHandlers({ drag: true });
            const after = config.get();

            expect(before.eventHandlers.drag).toBe(false);
            expect(after.eventHandlers.drag).toBe(true);
            expect(after).not.toBe(before);
        });

        it("does not freeze the caller's bounds object on updateBounds", () => {
            const config = new Config(minimalConfig);
            const bounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
            config.updateBounds(bounds);
            expect(Object.isFrozen(bounds)).toBe(false);
            bounds.maxX = 200; // caller can keep using its own object
            expect(config.get().bounds.maxX).toBe(100);
        });
    });

    describe("reduced motion", () => {
        it('defaults the preference to "auto", which resolves to false with no platform signal', () => {
            const config = new Config(minimalConfig);

            expect(config.get().accessibility.reducedMotion).toBe("auto");
            expect(config.getReducedMotion()).toBe(false);
            expect(config.effectiveDuration(500)).toBe(500);
        });

        it("collapses every duration once reduced motion is in effect", () => {
            const config = new Config({ ...minimalConfig, accessibility: { reducedMotion: true } });

            expect(config.getReducedMotion()).toBe(true);
            expect(config.effectiveDuration(500)).toBe(0);
            expect(config.effectiveDuration(0)).toBe(0);
        });

        it('resolves "auto" from the platform signal', () => {
            const config = new Config(minimalConfig);

            config._setPlatformReducedMotion(true);
            expect(config.getReducedMotion()).toBe(true);

            config._setPlatformReducedMotion(false);
            expect(config.getReducedMotion()).toBe(false);
        });

        // The load-bearing pair: a platform subscription must never be able to
        // override what the app explicitly asked for.
        it("keeps an explicit false even when the platform says reduce", () => {
            const config = new Config({ ...minimalConfig, accessibility: { reducedMotion: false } });

            config._setPlatformReducedMotion(true);

            expect(config.getReducedMotion()).toBe(false);
            expect(config.effectiveDuration(500)).toBe(500);
        });

        it("keeps an explicit true even when the platform says do not reduce", () => {
            const config = new Config({ ...minimalConfig, accessibility: { reducedMotion: true } });

            config._setPlatformReducedMotion(false);

            expect(config.getReducedMotion()).toBe(true);
        });

        // A persisted getConfig() snapshot must not turn "follow the OS" into
        // a permanent choice when it is replayed into a new engine.
        it("reports the preference as configured, not the resolved value", () => {
            const config = new Config(minimalConfig);

            config._setPlatformReducedMotion(true);

            expect(config.getReducedMotion()).toBe(true);
            expect(config.get().accessibility.reducedMotion).toBe("auto");
        });

        it("updateReducedMotion replaces the preference and the snapshot", () => {
            const config = new Config(minimalConfig);
            const before = config.get();

            config.updateReducedMotion(true);

            expect(config.getReducedMotion()).toBe(true);
            expect(config.get().accessibility.reducedMotion).toBe(true);
            expect(before.accessibility.reducedMotion).toBe("auto"); // old reference keeps its value
            expect(config.get()).not.toBe(before);
        });

        it("_setPlatformReducedMotion does not replace the snapshot", () => {
            const config = new Config(minimalConfig);
            const before = config.get();

            config._setPlatformReducedMotion(true);

            expect(config.get()).toBe(before);
        });

        it("freezes the accessibility snapshot and reads behavior from the private slot", () => {
            const config = new Config(minimalConfig);
            const snapshot = config.get();

            expect(Object.isFrozen(snapshot.accessibility)).toBe(true);
            // Modules are strict mode, so writing through the snapshot throws
            // rather than silently succeeding — and resolution is unaffected.
            expect(() => {
                (snapshot.accessibility as { reducedMotion: unknown }).reducedMotion = true;
            }).toThrow();
            expect(config.getReducedMotion()).toBe(false);
        });

        it("rejects an invalid preference from the constructor and the setter alike", () => {
            expect(
                () => new Config({ ...minimalConfig, accessibility: { reducedMotion: "reduce" as never } }),
            ).toThrow();

            const config = new Config(minimalConfig);
            expect(() => config.updateReducedMotion("reduce" as never)).toThrow();
            expect(() => config.updateReducedMotion(1 as never)).toThrow();
            expect(config.get().accessibility.reducedMotion).toBe("auto"); // unchanged after a rejected set
        });
    });

    describe("accessibility surface", () => {
        it("derives focusable from the pointer handlers, not a constant", () => {
            // Every eventHandler defaults to false, so a bare config is a
            // decorative surface and must not take a tab stop.
            expect(new Config(minimalConfig).get().accessibility.focusable).toBe(false);

            for (const handlers of [{ click: true }, { rightClick: true }, { hover: true }, { drag: true }]) {
                const config = new Config({ ...minimalConfig, eventHandlers: handlers });
                expect(config.get().accessibility.focusable).toBe(true);
            }

            expect(new Config({ ...minimalConfig, eventHandlers: { zoom: true } }).get().accessibility.focusable).toBe(
                true,
            );
            // resize is not a pointer interaction.
            expect(
                new Config({ ...minimalConfig, eventHandlers: { resize: true } }).get().accessibility.focusable,
            ).toBe(false);
        });

        it("lets an explicit focusable win over the derived default", () => {
            const forcedOn = new Config({ ...minimalConfig, accessibility: { focusable: true } });
            expect(forcedOn.get().accessibility.focusable).toBe(true);

            const forcedOff = new Config({
                ...minimalConfig,
                eventHandlers: { drag: true },
                accessibility: { focusable: false },
            });
            expect(forcedOff.get().accessibility.focusable).toBe(false);
        });

        it("moves the tab stop when interaction is toggled at runtime", () => {
            const config = new Config(minimalConfig);
            expect(config.get().accessibility.focusable).toBe(false);

            config.updateEventHandlers({ drag: true });
            expect(config.get().accessibility.focusable).toBe(true);

            config.updateEventHandlers({ drag: false });
            expect(config.get().accessibility.focusable).toBe(false);
        });

        it("keeps an explicit focusable across a handler change", () => {
            const config = new Config({ ...minimalConfig, accessibility: { focusable: false } });

            config.updateEventHandlers({ drag: true });

            expect(config.get().accessibility.focusable).toBe(false);
        });

        it("writes no name and no role by default", () => {
            const accessibility = new Config(minimalConfig).get().accessibility;

            expect(accessibility.label).toBeUndefined();
            expect(accessibility.role).toBeUndefined();
            expect(accessibility.description).toBeUndefined();
        });

        it('defaults role to "region" only alongside a label', () => {
            const named = new Config({ ...minimalConfig, accessibility: { label: "Seating chart" } });
            expect(named.get().accessibility.role).toBe("region");

            const unnamed = new Config({ ...minimalConfig, accessibility: { description: "Arrow keys pan" } });
            expect(unnamed.get().accessibility.role).toBeUndefined();
        });

        it("honors an explicit role with or without a label", () => {
            expect(new Config({ ...minimalConfig, accessibility: { role: "image" } }).get().accessibility.role).toBe(
                "image",
            );
            expect(
                new Config({ ...minimalConfig, accessibility: { label: "Board", role: "application" } }).get()
                    .accessibility.role,
            ).toBe("application");
        });

        it("merges an updateAccessibility patch instead of replacing it", () => {
            const config = new Config({ ...minimalConfig, accessibility: { label: "Board", focusable: true } });

            config.updateAccessibility({ description: "Arrow keys pan" });

            const accessibility = config.get().accessibility;
            expect(accessibility.label).toBe("Board");
            expect(accessibility.focusable).toBe(true);
            expect(accessibility.description).toBe("Arrow keys pan");
            expect(accessibility.role).toBe("region");
        });

        it("re-derives role when a label arrives at runtime", () => {
            const config = new Config(minimalConfig);
            expect(config.get().accessibility.role).toBeUndefined();

            config.updateAccessibility({ label: "Board" });

            expect(config.get().accessibility.role).toBe("region");
        });

        it("notifies subscribers on accessibility and handler changes", () => {
            const config = new Config(minimalConfig);
            let calls = 0;
            const unsubscribe = config.onAccessibilityChange(() => calls++);

            config.updateAccessibility({ label: "Board" });
            expect(calls).toBe(1);

            // focusable is derived from the handlers, so this changes the
            // attributes too and must notify.
            config.updateEventHandlers({ drag: true });
            expect(calls).toBe(2);

            unsubscribe();
            config.updateAccessibility({ label: "Other" });
            expect(calls).toBe(2);
        });

        it("rejects invalid accessibility values from the constructor and the updater alike", () => {
            expect(() => new Config({ ...minimalConfig, accessibility: { role: "grid" as never } })).toThrow(/role/);
            expect(() => new Config({ ...minimalConfig, accessibility: { label: 5 as never } })).toThrow(/label/);
            expect(() => new Config({ ...minimalConfig, accessibility: { focusable: "yes" as never } })).toThrow(
                /focusable/,
            );

            const config = new Config(minimalConfig);
            expect(() => config.updateAccessibility({ role: "grid" as never })).toThrow(/role/);
            expect(config.get().accessibility.role).toBeUndefined(); // unchanged after a rejected patch
        });
    });
});
