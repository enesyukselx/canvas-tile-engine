import type { SpriteRect } from "../types/draw-object";

/**
 * A frame-based sprite animation definition.
 */
export interface SpriteAnimation {
    /** Frames to cycle through, in play order (e.g. `SpriteSheet.framesInRow(...)`). */
    frames: SpriteRect[];
    /** Playback speed in frames per second. */
    fps: number;
    /** Restart from the first frame after the last one (default: true). */
    loop?: boolean;
}

/**
 * Whether frame scheduling is available. Headless environments (e.g. the
 * server renderer under Node) have no requestAnimationFrame; animations
 * apply their first frame once there instead of crashing.
 */
function canAnimate(): boolean {
    return typeof requestAnimationFrame === "function";
}

/**
 * Plays a {@link SpriteAnimation} by invoking a callback whenever the current
 * frame changes. The callback typically mutates an ImageItem's `sprite` field
 * and triggers a render, which makes animation work identically across all
 * renderers without renderer-specific code.
 *
 * The internal rAF loop only fires the callback when the frame index actually
 * advances, so renders happen at the animation's fps, not at 60fps.
 *
 * @example
 * ```ts
 * const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32 });
 * const item = { x: 5, y: 3, img, sprite: sheet.frame(0, 0) };
 * engine.drawImage(item);
 *
 * const animator = new SpriteAnimator({ frames: sheet.framesInRow(0, 0, 4), fps: 8 });
 * animator.start((frame) => {
 *     item.sprite = frame;
 *     engine.render();
 * });
 * ```
 */
export class SpriteAnimator {
    private readonly frames: SpriteRect[];
    private readonly frameDurationMs: number;
    private readonly loop: boolean;
    private animationId?: number;

    constructor(animation: SpriteAnimation) {
        if (animation.frames.length === 0) {
            throw new Error("SpriteAnimator: frames must not be empty");
        }
        if (animation.fps <= 0) {
            throw new Error("SpriteAnimator: fps must be positive");
        }
        this.frames = animation.frames;
        this.frameDurationMs = 1000 / animation.fps;
        this.loop = animation.loop ?? true;
    }

    /**
     * Frame index for a given elapsed time since the animation started.
     * Pure timing math; exposed for tests and manual stepping.
     */
    frameIndexAt(elapsedMs: number): number {
        const raw = Math.floor(Math.max(0, elapsedMs) / this.frameDurationMs);
        if (this.loop) return raw % this.frames.length;
        return Math.min(raw, this.frames.length - 1);
    }

    /**
     * Frame source rect for a given elapsed time since the animation started.
     */
    frameAt(elapsedMs: number): SpriteRect {
        return this.frames[this.frameIndexAt(elapsedMs)];
    }

    /**
     * Start playback. Restarts from the first frame if already running.
     * @param onFrame Called with the new frame whenever the frame changes
     * (including once immediately with the first frame).
     * @param onComplete Called when a non-looping animation reaches its last frame.
     */
    start(onFrame: (frame: SpriteRect, index: number) => void, onComplete?: () => void) {
        this.stop();

        onFrame(this.frames[0], 0);

        // Headless: no frame scheduling — leave the first frame applied.
        if (!canAnimate()) {
            if (!this.loop) onComplete?.();
            return;
        }

        if (this.frames.length === 1) {
            if (!this.loop) onComplete?.();
            return;
        }

        const startTime = performance.now();
        let lastIndex = 0;

        const step = (now: number) => {
            const index = this.frameIndexAt(now - startTime);

            if (index !== lastIndex) {
                lastIndex = index;
                onFrame(this.frames[index], index);
            }

            if (!this.loop && index === this.frames.length - 1) {
                this.animationId = undefined;
                onComplete?.();
                return;
            }

            this.animationId = requestAnimationFrame(step);
        };

        this.animationId = requestAnimationFrame(step);
    }

    /**
     * Stop playback. The last applied frame stays drawn.
     */
    stop() {
        if (this.animationId !== undefined) {
            cancelAnimationFrame(this.animationId);
            this.animationId = undefined;
        }
    }

    /**
     * Whether the animation loop is currently scheduled.
     */
    isRunning(): boolean {
        return this.animationId !== undefined;
    }
}
