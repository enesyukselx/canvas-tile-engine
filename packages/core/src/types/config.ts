/**
 * Reduced-motion preference. `"auto"` follows the platform signal (the
 * browser's `prefers-reduced-motion` media query, or React Native's
 * `AccessibilityInfo`); `true`/`false` are explicit app choices that the
 * platform can never override.
 */
export type ReducedMotionSetting = boolean | "auto";

/**
 * Semantic role for the whole surface, mapped per platform. Web: `"region"` →
 * `role="region"`, `"image"` → `role="img"`, `"application"` →
 * `role="application"`. React Native: only `"image"` has an
 * `accessibilityRole` equivalent.
 *
 * Deliberately a narrow union rather than an ARIA passthrough string:
 * widening an accepted union later is free, narrowing a shipped string is a
 * compile break. `"grid"` is excluded because it obliges `aria-rowcount` /
 * `aria-colcount` and real `gridcell` descendants, which a canvas surface
 * cannot provide.
 */
export type AccessibilityRole = "region" | "image" | "application";

export type AccessibilityConfig = {
    /**
     * Accessible name for the surface. No default — a fabricated one like
     * "Interactive map" would be wrong for a game board, a seat picker or a
     * pixel editor, and it would suppress the unlabeled-region audit signal.
     * When omitted, neither `aria-label` nor `role` is written at all.
     */
    label?: string;
    /**
     * Longer usage description, e.g. which keys do what. Web: rendered into a
     * visually hidden node referenced by `aria-describedby`. React Native:
     * `accessibilityHint`. Inert on the server renderer.
     */
    description?: string;
    /**
     * Semantic role. Defaults to `"region"` when {@link label} is set, and to
     * nothing at all when it is not. `"application"` is never the default: it
     * forfeits every screen-reader quick-navigation command.
     */
    role?: AccessibilityRole;
    /**
     * Whether the surface is a keyboard tab stop.
     *
     * The default is DERIVED, not a constant: `true` when any pointer
     * interaction is enabled (`click`, `rightClick`, `hover`, `drag`, or
     * `zoom`), otherwise `false`. A decorative minimap configured with no
     * event handlers gains no tab stop; an interactive map does. An explicit
     * `true`/`false` always wins.
     */
    focusable?: boolean;
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

/** Step sizes for keyboard camera control. */
export type KeyboardConfig = {
    /**
     * Pan step in world units — one cell per press with the default cell
     * size. Ignored when {@link panPx} is set.
     */
    pan?: number;
    /**
     * Pan step in screen pixels, independent of zoom. Takes precedence over
     * {@link pan}. Default 80, matching the step map libraries settled on.
     */
    panPx?: number;
    /** Multiplicative zoom step for `+`/`-`. Default 1.5, matching `zoomIn`/`zoomOut`. */
    zoomFactor?: number;
};

export type EventHandlers = {
    click?: boolean;
    rightClick?: boolean;
    hover?: boolean;
    drag?: boolean;
    /** Zoom behavior: `false` disables zoom, `true` is shorthand for `"pointer"`. */
    zoom?: boolean | ZoomMode;
    resize?: boolean;
    /**
     * Keyboard camera control. DOM renderers only — React Native's core
     * `View` has no key events, and the server renderer has no input loop.
     *
     * Left `undefined` (the default) it MIRRORS the pointer gates: arrows pan
     * only if `drag` is on, `+`/`-` zoom only if `zoom` is on, and
     * Enter/Space activate only if `click` is on. Keyboard therefore grants
     * no capability the app did not already grant — which is what SC 2.1.1
     * asks for — and is a genuine no-op on a deliberately static board.
     *
     * `true` forces all three on regardless; `false` forces them off. An
     * object configures the step sizes while still mirroring the gates.
     *
     * `Tab`, `Escape`, `Home`, `End`, `PageUp` and `PageDown` are never
     * captured and never will be, so the surface can never become a keyboard
     * trap (SC 2.1.2).
     */
    keyboard?: boolean | KeyboardConfig;
};
