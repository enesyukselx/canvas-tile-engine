import { Config } from "@canvas-tile-engine/core";

/** The media query that carries the OS reduced-motion setting on the web. */
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Feeds the browser's `prefers-reduced-motion` setting into the engine's
 * config, which resolves it only while the app's preference is `"auto"`.
 *
 * This lives in the DOM layer rather than in core on purpose: core must never
 * probe for the signal itself. `typeof window !== "undefined"` is TRUE on
 * React Native, where `window.matchMedia` does not exist, so the probe idiom
 * core uses for `devicePixelRatio` would throw there — and jsdom implements no
 * `matchMedia` at all. React Native pushes its own signal from the binding's
 * `AccessibilityInfo` subscription.
 * @internal
 */
export class ReducedMotionWatcher {
    private mediaQuery?: MediaQueryList;
    private handleChange?: (event: MediaQueryListEvent) => void;

    constructor(private config: Config) {}

    /**
     * Start watching and push the current value. Safe to call when the
     * environment has no `matchMedia`: the preference then stays unresolved
     * and `"auto"` continues to mean "animate".
     */
    start() {
        if (this.mediaQuery) {
            return;
        }
        if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
            return;
        }

        const mediaQuery = window.matchMedia(REDUCED_MOTION_QUERY);
        this.mediaQuery = mediaQuery;

        // Attach before the first push so a flip landing between the two is
        // delivered rather than lost.
        if (typeof mediaQuery.addEventListener === "function") {
            this.handleChange = (event: MediaQueryListEvent) => {
                this.config._setPlatformReducedMotion(event.matches);
            };
            mediaQuery.addEventListener("change", this.handleChange);
        }

        this.config._setPlatformReducedMotion(mediaQuery.matches);
    }

    /**
     * Stop watching. Clears both refs so a renderer that tears down and calls
     * `setupEvents()` again attaches exactly one listener.
     */
    stop() {
        if (this.mediaQuery && this.handleChange) {
            this.mediaQuery.removeEventListener("change", this.handleChange);
        }
        this.mediaQuery = undefined;
        this.handleChange = undefined;
    }
}
