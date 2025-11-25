import type { CanvasGridMapConfig } from "../types";

export class ConfigManager {
    private config: Required<CanvasGridMapConfig>;

    constructor(config: CanvasGridMapConfig) {
        this.config = {
            scale: config.scale,
            minScale: config.minScale,
            maxScale: config.maxScale,
            size: {
                width: config.size.width,
                height: config.size.height,
            },
            backgroundColor: config.backgroundColor ?? "#ffffff",
            events: {
                click: config.events.click ?? false,
                hover: config.events.hover ?? false,
                drag: config.events.drag ?? false,
                zoom: config.events.zoom ?? false,
                resize: config.events.resize ?? false,
            },
            showCoordinates: config.showCoordinates ?? false,
            minScaleShowCoordinates: config.minScaleShowCoordinates ?? 0,
            cursor: {
                default: config.cursor?.default ?? "default",
                move: config.cursor?.move ?? "move",
            },
        };
    }

    get(): Required<CanvasGridMapConfig> {
        return this.config;
    }

    setSize(width: number, height: number) {
        this.config.size.width = width;
        this.config.size.height = height;
    }

    setScale(scale: number) {
        this.config.scale = scale;
    }
}
