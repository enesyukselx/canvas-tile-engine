import type { ReactNode } from "react";
import type {
    CanvasTileEngineConfig,
    Coords,
    onClickCallback,
    onRightClickCallback,
    onHoverCallback,
    onMouseDownCallback,
    onMouseUpCallback,
    onMouseLeaveCallback,
    onWheelCallback,
    onZoomCallback,
    onDrawCallback,
} from "@canvas-tile-engine/core";

/**
 * Platform-agnostic props shared by the web and React Native
 * `CanvasTileEngine` components. The platform packages extend this with their
 * renderer and styling props (`renderer`/`className`/`style`).
 */
export interface CanvasTileEngineBaseProps<THandle> {
    /** Engine handle from useCanvasTileEngine hook (required) */
    engine: THandle;

    /**
     * Engine configuration.
     *
     * Read once when the engine is created — later changes to this prop are
     * ignored. Use runtime APIs for dynamic updates (`engine.setBounds`,
     * `engine.setEventHandlers`, ...) or remount the component (e.g. with a
     * `key`) to apply a whole new config.
     */
    config: CanvasTileEngineConfig;

    /** Initial center coordinates. Read once on creation; use `engine.setCenter`/`engine.goCenter` to move later. */
    center?: Coords;

    /** Draw components (Rect, Circle, Image, GridLines, etc.) */
    children?: ReactNode;

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
     * Callback when a tile is clicked (mouse click or touch tap).
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
     * Callback when a tile is right-clicked (or long-pressed on touch).
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
     * Callback when hovering over tiles (where the platform supports it).
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
     * Callback when the pointer/touch leaves the canvas.
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
     * Callback after each draw frame, on top of all layers. Same signature as
     * `DrawFunction` children: platform context, top-left world coords, live
     * config, and coordinate transform helpers.
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

    /**
     * Callback for wheel (desktop) and pinch (touch) zoom gestures. Requires
     * `eventHandlers.zoom`. Reports the input gesture with its position; for
     * pinch the coordinates describe the pinch midpoint.
     * @example
     * ```tsx
     * onWheel={(coords, mouse, client, wheel) => {
     *     console.log(`${wheel.source} zoom ${wheel.direction} at`, coords.snapped);
     * }}
     * ```
     */
    onWheel?: onWheelCallback;
}
