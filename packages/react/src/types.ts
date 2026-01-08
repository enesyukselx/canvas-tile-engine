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
    onZoomCallback,
    onDrawCallback,
    Rect,
    Line,
    Circle,
    Path,
    Text,
    ImageItem,
    IRenderer,
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
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
    onZoomCallback,
    onDrawCallback,
    Rect,
    Line,
    Circle,
    Text,
    Path,
    ImageItem,
    IRenderer,
};

/**
 * Props for CanvasTileEngine component
 */
export interface CanvasTileEngineProps {
    /** Engine handle from useCanvasTileEngine hook (required) */
    engine: EngineHandle;

    /**
     * Renderer instance to use.
     * @example
     * ```tsx
     * import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
     * <CanvasTileEngine config={config} engine={engine} renderer={new RendererCanvas()} />
     * ```
     */
    renderer: IRenderer;

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

    /**
     * Callback when center coordinates change (pan or zoom).
     * @param coords - Center world coordinates: `{ x, y }`
     * @example
     * ```tsx
     * onCoordsChange={(coords) => {
     *     console.log(`Center: ${coords.x}, ${coords.y}`);
     * }}
     * ```
     */
    onCoordsChange?: (coords: Coords) => void;

    /**
     * Callback when a tile is clicked (mouse or touch tap).
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```tsx
     * onClick={(coords) => {
     *     console.log(`Clicked tile: ${coords.snapped.x}, ${coords.snapped.y}`);
     * }}
     * ```
     */
    onClick?: onClickCallback;

    /**
     * Callback when a tile is right-clicked.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```tsx
     * onRightClick={(coords) => {
     *     showContextMenu(coords.snapped.x, coords.snapped.y);
     * }}
     * ```
     */
    onRightClick?: onRightClickCallback;

    /**
     * Callback when hovering over tiles.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```tsx
     * onHover={(coords) => {
     *     setHoveredTile({ x: coords.snapped.x, y: coords.snapped.y });
     * }}
     * ```
     */
    onHover?: onHoverCallback;

    /**
     * Callback on mouse/touch down.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```tsx
     * onMouseDown={(coords) => {
     *     startPainting(coords.snapped.x, coords.snapped.y);
     * }}
     * ```
     */
    onMouseDown?: onMouseDownCallback;

    /**
     * Callback on mouse/touch up.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```tsx
     * onMouseUp={() => {
     *     stopPainting();
     * }}
     * ```
     */
    onMouseUp?: onMouseUpCallback;

    /**
     * Callback when mouse/touch leaves the canvas.
     * @param coords - World coordinates: `raw` (exact), `snapped` (floored to tile)
     * @param mouse - Canvas-relative position: `raw` (exact), `snapped` (tile-aligned)
     * @param client - Viewport position: `raw` (exact), `snapped` (tile-aligned)
     * @example
     * ```tsx
     * onMouseLeave={() => {
     *     clearHoveredTile();
     * }}
     * ```
     */
    onMouseLeave?: onMouseLeaveCallback;

    /**
     * Callback after each draw frame. Use for custom canvas drawing.
     * @param ctx - The canvas 2D rendering context
     * @param info - Frame info: `scale`, `width`, `height`, `coords` (center)
     * @example
     * ```tsx
     * onDraw={(ctx, info) => {
     *     ctx.fillStyle = "red";
     *     ctx.fillText(`Scale: ${info.scale}`, 10, 20);
     * }}
     * ```
     */
    onDraw?: onDrawCallback;

    /**
     * Callback on canvas resize.
     * @example
     * ```tsx
     * onResize={() => {
     *     console.log("Canvas resized");
     * }}
     * ```
     */
    onResize?: () => void;

    /**
     * Callback when zoom level changes (wheel or pinch).
     * @param scale - The new scale value
     * @example
     * ```tsx
     * onZoom={(scale) => {
     *     console.log(`Zoom level: ${scale}`);
     * }}
     * ```
     */
    onZoom?: onZoomCallback;
}
