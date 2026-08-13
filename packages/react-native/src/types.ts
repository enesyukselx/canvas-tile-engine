import type { ViewStyle } from "react-native";
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
import type { RendererSkia } from "@canvas-tile-engine/renderer-skia";
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
 * Props for the React Native CanvasTileEngine component.
 *
 * Mirrors `@canvas-tile-engine/react`; the differences are that `renderer` is a
 * `RendererSkia`, `style` is a React Native `ViewStyle` (no `className`), and
 * `onDraw` receives an `SkCanvas` instead of a 2D context.
 */
export interface CanvasTileEngineProps extends CanvasTileEngineBaseProps<EngineHandle> {
    /**
     * Renderer instance to use.
     *
     * Read once when the engine is created (on first layout) — passing a
     * different renderer later is ignored. Remount the component (e.g. with a
     * `key`) to switch renderers.
     * @example
     * ```tsx
     * import { RendererSkia } from "@canvas-tile-engine/renderer-skia";
     * <CanvasTileEngine config={config} engine={engine} renderer={new RendererSkia()} />
     * ```
     */
    renderer: RendererSkia;

    /**
     * Engine configuration. `size` is overridden by the measured layout size.
     *
     * Read once when the engine is created (on first layout) — later changes
     * to this prop are ignored. Use runtime APIs for dynamic updates
     * (`engine.setBounds`, `engine.setEventHandlers`, ...) or remount the
     * component (e.g. with a `key`) to apply a whole new config.
     */
    config: CanvasTileEngineConfig;

    /** Additional styles for the wrapper View */
    style?: ViewStyle;

    /**
     * Callback for pinch zoom gestures (the touch counterpart of the web
     * wheel event). Requires `eventHandlers.zoom`. Reports the input gesture
     * with its position; the coordinates describe the pinch midpoint.
     */
    onWheel?: onWheelCallback;
}
