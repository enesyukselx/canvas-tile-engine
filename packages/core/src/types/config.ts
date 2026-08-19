/**
 * Reduced-motion preference. `"auto"` follows the platform signal (the
 * browser's `prefers-reduced-motion` media query, or React Native's
 * `AccessibilityInfo`); `true`/`false` are explicit app choices that the
 * platform can never override.
 */
export type ReducedMotionSetting = boolean | "auto";

export type AccessibilityConfig = {
    /**
     * Collapse engine-driven camera animation to instant. Default `"auto"`.
     *
     * When in effect this **overrides an explicitly passed `durationMs`** —
     * `goCenter(x, y, 800)` lands instantly. That is deliberate: a duration
     * the app hard-codes is exactly what the preference exists to suppress,
     * so the escape hatch is `reducedMotion: false` (or
     * `engine.setReducedMotion(false)`), never a per-call duration.
     *
     * Scope is the engine's own camera animation: `goCenter`, `goScale`,
     * `fitBounds` and `resize`. `SpriteAnimator` and anything the app draws
     * itself are out of scope — call `animator.stop()` yourself if you need
     * WCAG SC 2.2.2.
     *
     * This field reports the preference **as configured**, so a persisted
     * snapshot never turns "follow the OS" into a permanent choice. For the
     * value actually in effect, call `engine.getReducedMotion()`.
     */
    reducedMotion?: ReducedMotionSetting;
};

/**
 * The motion policy the animation paths consult. `Config` implements it; the
 * interface exists so `AnimationController` depends on the two methods it
 * needs rather than on the whole config store.
 */
export interface MotionPolicy {
    /** The reduced-motion value actually in effect, preference resolved against the platform signal. */
    getReducedMotion(): boolean;
    /** `durationMs`, or `0` when reduced motion is in effect. */
    effectiveDuration(durationMs: number): number;
}

export type CanvasTileEngineConfig = {
    scale: number;
    maxScale?: number;
    minScale?: number;
    backgroundColor?: string;
    /**
     * When true, the initial center snaps to the nearest grid-aligned value
     * for pixel-perfect alignment: half-integers (x.5) for even tile counts,
     * integers for odd. Integers are cell centers (cell k spans
     * [k-0.5, k+0.5]); exact ties snap down so a center computed as N/2 for
     * a 0-based N-cell board lands on the true board center (N-1)/2.
     */
    gridAligned?: boolean;
    size: {
        width: number;
        height: number;
        minWidth?: number;
        minHeight?: number;
        maxWidth?: number;
        maxHeight?: number;
    };
    responsive?: "preserve-scale" | "preserve-viewport" | false;
    eventHandlers?: EventHandlers;
    bounds?: {
        minX: number;
        maxX: number;
        minY: number;
        maxY: number;
    };
    coordinates?: {
        enabled?: boolean;
        shownScaleRange?: { min: number; max: number };
    };
    accessibility?: AccessibilityConfig;
    debug?: {
        enabled?: boolean;
        hud?: {
            enabled?: boolean;
            topLeftCoordinates?: boolean;
            coordinates?: boolean;
            scale?: boolean;
            tilesInView?: boolean;
            fps?: boolean;
        };
        eventHandlers?: {
            click?: boolean;
            hover?: boolean;
            drag?: boolean;
            zoom?: boolean;
            resize?: boolean;
        };
    };
};

/**
 * Anchor point for zoom interactions (wheel and pinch):
 * - `"pointer"` — zoom toward the mouse cursor / pinch midpoint.
 * - `"center"` — zoom toward the center of the canvas.
 */
export type ZoomMode = "pointer" | "center";

export type EventHandlers = {
    click?: boolean;
    rightClick?: boolean;
    hover?: boolean;
    drag?: boolean;
    /** Zoom behavior: `false` disables zoom, `true` is shorthand for `"pointer"`. */
    zoom?: boolean | ZoomMode;
    resize?: boolean;
};
