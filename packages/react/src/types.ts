import type {
    CanvasTileEngineConfig,
    Coords,
    DrawObject,
    EventHandlers,
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onZoomCallback,
    onDrawCallback,
    Rect,
    Line,
    Circle,
    Path,
    Text,
    ImageItem,
} from "@canvas-tile-engine/core";
import type { EngineHandle } from "./hooks/useCanvasTileEngine";

export type {
    CanvasTileEngineConfig,
    Coords,
    DrawObject,
    EventHandlers,
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onZoomCallback,
    onDrawCallback,
    Rect,
    Line,
    Circle,
    Text,
    Path,
    ImageItem,
};

/**
 * Props for CanvasTileEngine component
 */
export interface CanvasTileEngineProps {
    /** Engine handle from useCanvasTileEngine hook (required) */
    engine: EngineHandle;

    /** Engine configuration */
    config: CanvasTileEngineConfig;

    /** Initial center coordinates */
    center?: Coords;

    /** Additional class name for the wrapper div */
    className?: string;

    /** Additional styles for the wrapper div */
    style?: React.CSSProperties;

    /** Draw components (Rect, Circle, Image, GridLines, etc.) */
    children?: React.ReactNode;

    /** Callback when center coordinates change */
    onCoordsChange?: (coords: Coords) => void;

    /** Callback when a tile is clicked */
    onClick?: onClickCallback;

    /** Callback when a tile is right-clicked */
    onRightClick?: onRightClickCallback;

    /** Callback when hovering over tiles */
    onHover?: onHoverCallback;

    /** Callback on mouse down */
    onMouseDown?: () => void;

    /** Callback on mouse up */
    onMouseUp?: () => void;

    /** Callback on mouse leave */
    onMouseLeave?: () => void;

    /** Callback after each draw frame */
    onDraw?: onDrawCallback;

    /** Callback on canvas resize */
    onResize?: () => void;

    /** Callback when zoom level changes */
    onZoom?: onZoomCallback;
}
