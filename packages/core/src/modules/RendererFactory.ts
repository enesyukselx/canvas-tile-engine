import { CanvasTileEngineConfig } from "../types";
import { ICamera } from "./Camera";
import { Config } from "./Config";
import { CoordinateTransformer } from "./CoordinateTransformer";
import { Layer } from "./Layer";
import { ViewportState } from "./ViewportState";
import { CanvasRenderer } from "./Renderer/CanvasRenderer";
import { IRenderer } from "./Renderer/Renderer";

/**
 * Factory for creating renderer instances based on configuration.
 * Implements the Factory Pattern to decouple renderer creation from engine initialization.
 * @internal
 */
export class RendererFactory {
    /**
     * Create a renderer instance based on the specified type.
     * @param type Renderer type (currently only "canvas" is supported).
     * @param canvas Target canvas element.
     * @param camera Active camera.
     * @param coordinateTransformer World/screen coordinate transformer.
     * @param config Normalized engine configuration.
     * @param viewport Viewport state manager.
     * @param layers Layer manager for rendering.
     * @returns Configured renderer instance.
     * @throws Error if renderer type is not supported.
     */
    static createRenderer(
        type: CanvasTileEngineConfig["renderer"],
        canvas: HTMLCanvasElement,
        camera: ICamera,
        coordinateTransformer: CoordinateTransformer,
        config: Config,
        viewport: ViewportState,
        layers: Layer
    ): IRenderer {
        switch (type) {
            case "canvas":
                return new CanvasRenderer(canvas, camera, coordinateTransformer, config, viewport, layers);
            default:
                // Type guard ensures this should never happen
                throw new Error(`Unsupported renderer type: ${type}`);
        }
    }

    /**
     * Validate if a renderer type is supported.
     * @param type Renderer type to validate.
     * @returns True if the renderer type is supported.
     */
    static isSupported(type: string): type is NonNullable<CanvasTileEngineConfig["renderer"]> {
        return type === "canvas";
    }

    /**
     * Get list of supported renderer types.
     * @returns Array of supported renderer type names.
     */
    static getSupportedTypes(): ReadonlyArray<NonNullable<CanvasTileEngineConfig["renderer"]>> {
        return ["canvas"] as const;
    }
}
