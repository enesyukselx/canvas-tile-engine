import { CanvasTileEngineConfig, EventHandlers } from "../types";
import { SCALE_LIMITS, SIZE_LIMITS, RENDER_DEFAULTS } from "../constants";
import { validateConfig, validateBounds } from "../utils/validateConfig";

/**
 * Normalizes and stores grid engine configuration with safe defaults.
 */
export class Config {
    private config: Required<CanvasTileEngineConfig>;

    /**
     * Create a config store with defaults merged from the provided partial config.
     * @param config Incoming configuration values.
     * @throws {ConfigValidationError} If any config value is invalid.
     */
    constructor(config: CanvasTileEngineConfig) {
        validateConfig(config);

        const base: Required<CanvasTileEngineConfig> = {
            renderer: RENDER_DEFAULTS.RENDERER_TYPE,
            scale: config.scale,
            minScale: config.minScale ?? config.scale * SCALE_LIMITS.MIN_SCALE_MULTIPLIER,
            maxScale: config.maxScale ?? config.scale * SCALE_LIMITS.MAX_SCALE_MULTIPLIER,
            gridAligned: config.gridAligned ?? false,

            size: {
                width: config.size.width,
                height: config.size.height,
                maxHeight: config.size.maxHeight ?? SIZE_LIMITS.MAX_HEIGHT,
                maxWidth: config.size.maxWidth ?? SIZE_LIMITS.MAX_WIDTH,
                minHeight: config.size.minHeight ?? SIZE_LIMITS.MIN_HEIGHT,
                minWidth: config.size.minWidth ?? SIZE_LIMITS.MIN_WIDTH,
            },

            responsive: config.responsive ?? false,

            backgroundColor: config.backgroundColor ?? RENDER_DEFAULTS.BACKGROUND_COLOR,

            eventHandlers: {
                click: config.eventHandlers?.click ?? false,
                rightClick: config.eventHandlers?.rightClick ?? false,
                hover: config.eventHandlers?.hover ?? false,
                drag: config.eventHandlers?.drag ?? false,
                zoom: config.eventHandlers?.zoom ?? false,
                resize: config.eventHandlers?.resize ?? false,
            },

            bounds: config.bounds ?? {
                minX: -Infinity,
                maxX: Infinity,
                minY: -Infinity,
                maxY: Infinity,
            },

            coordinates: {
                enabled: config.coordinates?.enabled ?? false,
                shownScaleRange: config.coordinates?.shownScaleRange ?? { min: 0, max: Infinity },
            },

            cursor: {
                default: config.cursor?.default ?? "default",
                move: config.cursor?.move ?? "move",
            },

            debug: {
                enabled: config.debug?.enabled ?? false,
                hud: {
                    enabled: config.debug?.hud?.enabled ?? false,
                    topLeftCoordinates: config.debug?.hud?.topLeftCoordinates ?? false,
                    coordinates: config.debug?.hud?.coordinates ?? false,
                    scale: config.debug?.hud?.scale ?? false,
                    tilesInView: config.debug?.hud?.tilesInView ?? false,
                    fps: config.debug?.hud?.fps ?? false,
                },
                eventHandlers: {
                    click: config.debug?.eventHandlers?.click ?? true,
                    hover: config.debug?.eventHandlers?.hover ?? true,
                    drag: config.debug?.eventHandlers?.drag ?? true,
                    zoom: config.debug?.eventHandlers?.zoom ?? true,
                    resize: config.debug?.eventHandlers?.resize ?? true,
                },
            },
        };
        this.config = {
            ...base,
            size: Object.freeze(base.size),
            eventHandlers: Object.freeze(base.eventHandlers),
            bounds: Object.freeze(base.bounds),
            coordinates: Object.freeze({
                ...base.coordinates,
                shownScaleRange: Object.freeze(base.coordinates.shownScaleRange),
            }),
            cursor: Object.freeze(base.cursor),
            debug: Object.freeze({
                enabled: base.debug.enabled,
                hud: Object.freeze(base.debug.hud),
                eventHandlers: Object.freeze(base.debug.eventHandlers),
            }),
        };
    }

    /**
     * Get a defensive copy of the current configuration.
     * @returns Normalized configuration snapshot e.g. `{ scale: 1, size: { width: 800, height: 600 }, ... }`.
     */
    get(): Readonly<Required<CanvasTileEngineConfig>> {
        const cfg = this.config;
        return {
            ...cfg,
            size: { ...cfg.size },
            responsive: cfg.responsive,
            eventHandlers: { ...cfg.eventHandlers },
            bounds: { ...cfg.bounds },
            coordinates: {
                ...cfg.coordinates,
                shownScaleRange: {
                    min: cfg.coordinates.shownScaleRange?.min ?? 0,
                    max: cfg.coordinates.shownScaleRange?.max ?? Infinity,
                },
            },
            cursor: { ...cfg.cursor },
            debug: {
                ...cfg.debug,
                hud: { ...cfg.debug.hud },
                eventHandlers: { ...cfg.debug.eventHandlers },
            },
        };
    }

    /**
     * Update event handlers at runtime.
     * @param handlers Partial event handlers to update.
     */
    updateEventHandlers(handlers: Partial<EventHandlers>) {
        this.config = {
            ...this.config,
            eventHandlers: Object.freeze({
                ...this.config.eventHandlers,
                ...handlers,
            }),
        };
    }

    /**
     * Update map bounds at runtime.
     * @param bounds New boundary limits. Use Infinity/-Infinity to remove limits on specific axes.
     * @throws {ConfigValidationError} If bounds are invalid.
     */
    updateBounds(bounds: { minX: number; maxX: number; minY: number; maxY: number }) {
        validateBounds(bounds);

        this.config = {
            ...this.config,
            bounds: Object.freeze(bounds),
        };
    }
}
