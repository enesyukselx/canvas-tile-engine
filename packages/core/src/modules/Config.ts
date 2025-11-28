import { GridEngineConfig } from "../types";

/**
 * Normalizes and stores grid engine configuration with safe defaults.
 * @internal
 */
export class Config {
    private readonly config: Required<GridEngineConfig>;

    /**
     * Create a config store with defaults merged from the provided partial config.
     * @param config Incoming configuration values.
     */
    constructor(config: GridEngineConfig) {
        this.config = {
            renderer: "canvas",
            scale: config.scale,
            minScale: config.minScale,
            maxScale: config.maxScale,

            size: {
                width: config.size.width,
                height: config.size.height,
            },

            backgroundColor: config.backgroundColor ?? "#ffffff",

            eventHandlers: {
                click: config.eventHandlers?.click ?? false,
                hover: config.eventHandlers?.hover ?? false,
                drag: config.eventHandlers?.drag ?? false,
                zoom: config.eventHandlers?.zoom ?? false,
                resize: config.eventHandlers?.resize ?? false,
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
                grid: {
                    enabled: config.debug?.grid?.enabled ?? false,
                    color: config.debug?.grid?.color ?? "rgba(255,255,255,0.25)",
                    lineWidth: config.debug?.grid?.lineWidth ?? 1,
                },
                hud: {
                    enabled: config.debug?.hud?.enabled ?? false,
                    topLeftCoordinates: config.debug?.hud?.topLeftCoordinates ?? false,
                    coordinates: config.debug?.hud?.coordinates ?? false,
                    scale: config.debug?.hud?.scale ?? false,
                    tilesInView: config.debug?.hud?.tilesInView ?? false,
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
    }

    /**
     * Get a defensive copy of the current configuration.
     * @returns Normalized configuration snapshot e.g. `{ scale: 1, size: { width: 800, height: 600 }, ... }`.
     */
    get(): Readonly<Required<GridEngineConfig>> {
        return {
            ...this.config,
            size: { ...this.config.size },
            eventHandlers: { ...this.config.eventHandlers },
            coordinates: {
                ...this.config.coordinates,
                shownScaleRange: {
                    min: this.config.coordinates.shownScaleRange?.min ?? 0,
                    max: this.config.coordinates.shownScaleRange?.max ?? Infinity,
                },
            },
            cursor: { ...this.config.cursor },
        };
    }

    /**
     * Update canvas size in pixels.
     * @param width Canvas width.
     * @param height Canvas height.
     */
    setSize(width: number, height: number) {
        this.config.size.width = width;
        this.config.size.height = height;
    }

    /**
     * Update current scale factor.
     * @param scale New scale value.
     */
    setScale(scale: number) {
        this.config.scale = scale;
    }
}
