import { CanvasTileEngineConfig, EventHandlers, MotionPolicy, ReducedMotionSetting, ZoomMode } from "../types";
import { SCALE_LIMITS, SIZE_LIMITS, RENDER_DEFAULTS } from "../constants";
import { validateConfig, validateBounds, validateScaleLimits, validateReducedMotion } from "../utils/validateConfig";

/** Normalize the zoom setting so consumers only see a mode or `false` (`true` means `"pointer"`). */
function normalizeZoom(zoom: boolean | ZoomMode | undefined): ZoomMode | false {
    if (zoom === true) {
        return "pointer";
    }
    return zoom || false;
}

/**
 * Fill every optional config field with its default and deep-freeze the result.
 *
 * The single source of truth for what the engine's defaults actually are:
 * {@link Config} builds its snapshot with it, and the React bindings answer
 * `getConfig()` with it before an engine exists, so a pre-mount snapshot can
 * never report a value the engine contradicts the moment it attaches.
 *
 * Normalization only — nothing here is validated. The engine validates the
 * config it is handed before normalizing it, so calling this directly with
 * values `new CanvasTileEngine(...)` would reject returns them normalized
 * rather than throwing.
 * @param config Incoming configuration values.
 * @returns Deeply frozen snapshot with every optional field resolved e.g. `{ scale: 1, minScale: 0.5, ... }`.
 */
export function normalizeConfig(config: CanvasTileEngineConfig): Readonly<Required<CanvasTileEngineConfig>> {
    return Object.freeze({
        scale: config.scale,
        minScale: config.minScale ?? config.scale * SCALE_LIMITS.MIN_SCALE_MULTIPLIER,
        maxScale: config.maxScale ?? config.scale * SCALE_LIMITS.MAX_SCALE_MULTIPLIER,
        gridAligned: config.gridAligned ?? false,

        size: Object.freeze({
            width: config.size.width,
            height: config.size.height,
            maxHeight: config.size.maxHeight ?? SIZE_LIMITS.MAX_HEIGHT,
            maxWidth: config.size.maxWidth ?? SIZE_LIMITS.MAX_WIDTH,
            minHeight: config.size.minHeight ?? SIZE_LIMITS.MIN_HEIGHT,
            minWidth: config.size.minWidth ?? SIZE_LIMITS.MIN_WIDTH,
        }),

        responsive: config.responsive ?? false,

        backgroundColor: config.backgroundColor ?? RENDER_DEFAULTS.BACKGROUND_COLOR,

        eventHandlers: Object.freeze({
            click: config.eventHandlers?.click ?? false,
            rightClick: config.eventHandlers?.rightClick ?? false,
            hover: config.eventHandlers?.hover ?? false,
            drag: config.eventHandlers?.drag ?? false,
            zoom: normalizeZoom(config.eventHandlers?.zoom),
            resize: config.eventHandlers?.resize ?? false,
        }),

        // Nested objects are copied before freezing, never adopted: freezing
        // what the caller passed in would silently make their own config
        // object immutable (`updateBounds` already avoids that).
        bounds: Object.freeze({
            ...(config.bounds ?? {
                minX: -Infinity,
                maxX: Infinity,
                minY: -Infinity,
                maxY: Infinity,
            }),
        }),

        coordinates: Object.freeze({
            enabled: config.coordinates?.enabled ?? false,
            shownScaleRange: Object.freeze({ ...(config.coordinates?.shownScaleRange ?? { min: 0, max: Infinity }) }),
        }),

        accessibility: Object.freeze({ reducedMotion: config.accessibility?.reducedMotion ?? "auto" }),

        debug: Object.freeze({
            enabled: config.debug?.enabled ?? false,
            hud: Object.freeze({
                enabled: config.debug?.hud?.enabled ?? false,
                topLeftCoordinates: config.debug?.hud?.topLeftCoordinates ?? false,
                coordinates: config.debug?.hud?.coordinates ?? false,
                scale: config.debug?.hud?.scale ?? false,
                tilesInView: config.debug?.hud?.tilesInView ?? false,
                fps: config.debug?.hud?.fps ?? false,
            }),
            eventHandlers: Object.freeze({
                click: config.debug?.eventHandlers?.click ?? true,
                hover: config.debug?.eventHandlers?.hover ?? true,
                drag: config.debug?.eventHandlers?.drag ?? true,
                zoom: config.debug?.eventHandlers?.zoom ?? true,
                resize: config.debug?.eventHandlers?.resize ?? true,
            }),
        }),
    });
}

/**
 * Normalizes and stores grid engine configuration with safe defaults.
 */
export class Config implements MotionPolicy {
    private config: Required<CanvasTileEngineConfig>;

    /**
     * The app's reduced-motion preference, and the platform's signal, kept in
     * two slots on purpose: the platform is consulted only while the
     * preference is `"auto"`, so a `prefers-reduced-motion` listener or a
     * React Native `AccessibilityInfo` subscription can never clobber an
     * explicit app choice.
     *
     * Class-field initializer so the platform slot exists before a renderer's
     * watcher can push into it during engine construction.
     */
    private motionPreference: ReducedMotionSetting = "auto";
    private platformReducedMotion = false;

    /**
     * Create a config store with defaults merged from the provided partial config.
     * @param config Incoming configuration values.
     * @throws {ConfigValidationError} If any config value is invalid.
     */
    constructor(config: CanvasTileEngineConfig) {
        validateConfig(config);

        this.config = normalizeConfig(config);
        // Read back off the snapshot so the default lives in one place. The
        // `?? "auto"` is a type-level formality: `Required<>` is shallow, so
        // the snapshot's own `reducedMotion` stays optional and cannot type
        // the preference slot, but normalizeConfig always resolved it.
        this.motionPreference = this.config.accessibility.reducedMotion ?? "auto";
    }

    /**
     * Get the current configuration as an immutable snapshot.
     *
     * The returned object is deeply frozen and shared — do not mutate it.
     * Runtime updates (`updateEventHandlers`, `updateBounds`) replace the
     * snapshot with a new frozen object, so previously returned references
     * keep their old values. Returning the frozen instance avoids the deep
     * copy this method used to make on every call (it runs on every pointer
     * event and every rendered frame).
     * @returns Normalized configuration snapshot e.g. `{ scale: 1, size: { width: 800, height: 600 }, ... }`.
     */
    get(): Readonly<Required<CanvasTileEngineConfig>> {
        return this.config;
    }

    /**
     * Update event handlers at runtime.
     * @param handlers Partial event handlers to update.
     */
    updateEventHandlers(handlers: Partial<EventHandlers>) {
        const merged = {
            ...this.config.eventHandlers,
            ...handlers,
        };
        if ("zoom" in handlers) {
            merged.zoom = normalizeZoom(handlers.zoom);
        }
        this.config = Object.freeze({
            ...this.config,
            eventHandlers: Object.freeze(merged),
        });
    }

    /**
     * Update scale limits at runtime.
     * @param minScale New minimum scale.
     * @param maxScale New maximum scale.
     * @throws {ConfigValidationError} If limits are invalid.
     */
    updateScaleLimits(minScale: number, maxScale: number) {
        validateScaleLimits(minScale, maxScale);

        this.config = Object.freeze({
            ...this.config,
            minScale,
            maxScale,
        });
    }

    /**
     * Update map bounds at runtime.
     * @param bounds New boundary limits. Use Infinity/-Infinity to remove limits on specific axes.
     * @throws {ConfigValidationError} If bounds are invalid.
     */
    updateBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
        validateBounds(bounds);

        this.config = Object.freeze({
            ...this.config,
            bounds: Object.freeze({ ...bounds }),
        });
    }

    /**
     * The reduced-motion value actually in effect. `"auto"` defers to the
     * platform signal, which is `false` until something pushes one — so a
     * platform with no signal (Node, a custom renderer) animates normally.
     */
    getReducedMotion(): boolean {
        return this.motionPreference === "auto" ? this.platformReducedMotion : this.motionPreference;
    }

    /**
     * The duration an animation should actually run for. Reduced motion
     * collapses every duration to 0, including one the caller passed
     * explicitly.
     */
    effectiveDuration(durationMs: number): number {
        return this.getReducedMotion() ? 0 : durationMs;
    }

    /**
     * Replace the app's reduced-motion preference at runtime.
     *
     * The snapshot keeps reporting the preference as configured, never the
     * resolved value, so persisting and replaying `getConfig()` cannot turn
     * `"auto"` into a permanent choice.
     * @throws {ConfigValidationError} If the value is not `true`, `false` or `"auto"`.
     */
    updateReducedMotion(value: ReducedMotionSetting) {
        validateReducedMotion(value);

        this.motionPreference = value;
        this.config = Object.freeze({
            ...this.config,
            accessibility: Object.freeze({ ...this.config.accessibility, reducedMotion: value }),
        });
    }

    /**
     * Record the platform's reduced-motion signal. Consulted only while the
     * preference is `"auto"`, so this can never override an explicit app
     * choice.
     *
     * Deliberately does not rebuild the snapshot: this can fire during engine
     * construction and on every OS setting change, and the snapshot reports
     * the preference, not the resolution.
     * Called by the DOM renderers' `prefers-reduced-motion` watcher and by
     * the React Native binding's `AccessibilityInfo` subscription.
     *
     * Deliberately carries no internal-tag annotation: core builds with
     * `stripInternal: true`, which would delete this method from the
     * published .d.ts — and every caller lives in another package. Even
     * naming the tag inside this comment would strip it. The underscore is
     * the marker instead. Not part of the supported API; application code
     * should use {@link updateReducedMotion}.
     */
    _setPlatformReducedMotion(value: boolean) {
        this.platformReducedMotion = value;
    }
}
