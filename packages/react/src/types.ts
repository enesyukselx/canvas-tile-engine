import type {
    CanvasTileEngineConfig,
    Coords,
    DrawObject,
    EventHandlers,
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
    onWheelCallback,
    onZoomCallback,
    onDrawCallback,
    Rect,
    Line,
    LineStyle,
    Circle,
    PathItem,
    PathStyle,
    PathCommand,
    Text,
    ImageItem,
    IRenderer,
    DrawHandle,
    WheelInfo,
    StyleOf,
    ShapeDecorationStyle,
    TextDecorationStyle,
    LineDecorationStyle,
    PathDecorationStyle,
    RectDrawOptions,
    CircleDrawOptions,
    TextDrawOptions,
    LineDrawOptions,
    PathDrawOptions,
} from "@canvas-tile-engine/core";
import type { CanvasTileEngineBaseProps } from "@canvas-tile-engine/react-shared";
import type { EngineHandle } from "./hooks/useCanvasTileEngine";

export type {
    CanvasTileEngineConfig,
    Coords,
    DrawObject,
    EventHandlers,
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
    onWheelCallback,
    onZoomCallback,
    onDrawCallback,
    Rect,
    Line,
    LineStyle,
    Circle,
    Text,
    PathItem,
    PathStyle,
    PathCommand,
    ImageItem,
    IRenderer,
    DrawHandle,
    WheelInfo,
    StyleOf,
    ShapeDecorationStyle,
    TextDecorationStyle,
    LineDecorationStyle,
    PathDecorationStyle,
    RectDrawOptions,
    CircleDrawOptions,
    TextDrawOptions,
    LineDrawOptions,
    PathDrawOptions,
};

/**
 * Props for CanvasTileEngine component
 */
export interface CanvasTileEngineProps extends CanvasTileEngineBaseProps<EngineHandle> {
    /**
     * Renderer instance to use.
     *
     * Read once when the engine mounts — passing a different renderer later is
     * ignored. Remount the component (e.g. with a `key`) to switch renderers.
     * @example
     * ```tsx
     * import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
     * <CanvasTileEngine config={config} engine={engine} renderer={new RendererCanvas()} />
     * ```
     */
    renderer: IRenderer;

    /**
     * Engine configuration.
     *
     * Read once when the engine mounts — later changes to this prop are
     * ignored. Use runtime APIs for dynamic updates (`engine.setBounds`,
     * `engine.setEventHandlers`, `engine.resize`, ...) or remount the
     * component (e.g. with a `key`) to apply a whole new config.
     */
    config: CanvasTileEngineConfig;

    /** Additional class name for the wrapper div */
    className?: string;

    /** Additional styles for the wrapper div */
    style?: React.CSSProperties;
}
