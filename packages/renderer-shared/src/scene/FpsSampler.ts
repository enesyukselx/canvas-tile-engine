const FPS_SAMPLE_SIZE = 10;

/**
 * Rolling-average frame rate counter, driven by its own `requestAnimationFrame`
 * loop so the reading keeps updating while the scene is idle.
 *
 * Free of drawing APIs, but not of platform globals: it needs
 * `requestAnimationFrame`, which the browser and React Native provide and plain
 * Node does not — `renderer-server` must never start one. Every renderer's
 * debug HUD owns one of these and
 * reads {@link fps} while painting.
 * @internal
 */
export class FpsSampler {
    private frameTimes: number[] = [];
    private lastFrameTime = 0;
    private currentFps = 0;
    private running = false;
    private onUpdate: (() => void) | null = null;

    /** Latest reading, rounded to whole frames per second. */
    get fps(): number {
        return this.currentFps;
    }

    /**
     * Set the callback fired whenever the reading changes (renderers use it to
     * repaint the HUD). Pass `null` to clear.
     */
    setUpdateCallback(callback: (() => void) | null) {
        this.onUpdate = callback;
    }

    /** Start sampling. No-op while already running. */
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.lastFrameTime = performance.now();
        requestAnimationFrame(() => this.tick());
    }
    }

    /** Stop sampling. The last reading stays readable. */
    stop() {
        this.running = false;
    }

    /** Stop sampling and release the update callback. */
    destroy() {
        this.stop();
        this.onUpdate = null;
    }

    private tick() {
        if (!this.running) {
            return;
        }

        const now = performance.now();
        const delta = now - this.lastFrameTime;
        this.lastFrameTime = now;

        this.frameTimes.push(delta);
        if (this.frameTimes.length > FPS_SAMPLE_SIZE) {
            this.frameTimes.shift();
        }

        const avgDelta = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;
        const newFps = Math.round(1000 / avgDelta);

        // Only notify when the displayed number would actually change
        if (newFps !== this.currentFps) {
            this.currentFps = newFps;
            this.onUpdate?.();
        }

        requestAnimationFrame(() => this.tick());
    }
}
