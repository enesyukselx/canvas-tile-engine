/**
 * Global constants for the canvas grid engine.
 * Centralizes magic numbers and configuration values.
 */

export const DEFAULT_VALUES = {
    /** Default animation duration in milliseconds */
    ANIMATION_DURATION_MS: 500,

    /** Pixel offset for centering cells (0.5 = center of pixel) */
    CELL_CENTER_OFFSET: 0.5,

    /** Default retry count for image loading */
    IMAGE_LOAD_RETRY_COUNT: 1,

    /** Maximum wheel delta value for zoom (prevents extreme zooming) */
    MAX_WHEEL_DELTA: 100,

    /** Minimum wheel delta value for zoom */
    MIN_WHEEL_DELTA: -100,

    /** Zoom sensitivity factor */
    ZOOM_SENSITIVITY: 0.001,
} as const;

export const SCALE_LIMITS = {
    /** Default minimum scale multiplier */
    MIN_SCALE_MULTIPLIER: 0.5,

    /** Default maximum scale multiplier */
    MAX_SCALE_MULTIPLIER: 2,
} as const;

export const SIZE_LIMITS = {
    /** Default minimum canvas width in pixels */
    MIN_WIDTH: 100,

    /** Default minimum canvas height in pixels */
    MIN_HEIGHT: 100,

    /** Default maximum width (infinity means no limit) */
    MAX_WIDTH: Infinity,

    /** Default maximum height (infinity means no limit) */
    MAX_HEIGHT: Infinity,
} as const;

export const RENDER_DEFAULTS = {
    /** Default background color */
    BACKGROUND_COLOR: "#ffffff",

    /** Default renderer type */
    RENDERER_TYPE: "canvas" as const,
} as const;

export const DEBUG_DEFAULTS = {
    /** Debug grid color */
    GRID_COLOR: "rgba(255,255,255,0.25)",

    /** Debug grid line width */
    GRID_LINE_WIDTH: 1,
} as const;

export const COORDINATE_OVERLAY = {
    /** Coordinate overlay border width in pixels */
    BORDER_WIDTH: 20,

    /** Coordinate text opacity */
    TEXT_OPACITY: 0.8,

    /** Border overlay opacity */
    BORDER_OPACITY: 0.1,

    /** Minimum font size for coordinate labels */
    MIN_FONT_SIZE: 8,

    /** Maximum font size for coordinate labels */
    MAX_FONT_SIZE: 12,

    /** Font size scale factor relative to camera scale */
    FONT_SIZE_SCALE_FACTOR: 0.25,
} as const;

export const DEBUG_HUD = {
    /** Debug HUD panel width in pixels */
    PANEL_WIDTH: 160,

    /** Debug HUD padding in pixels */
    PADDING: 8,

    /** Debug HUD line height in pixels */
    LINE_HEIGHT: 16,
} as const;

export const VISIBILITY_BUFFER = {
    /** Buffer zone for visibility culling (tiles) */
    TILE_BUFFER: 1,
} as const;
