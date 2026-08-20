import type { GestureProcessor } from "@canvas-tile-engine/core";

/**
 * Bridge a DOM `KeyboardEvent` into the platform-agnostic
 * `GestureProcessor.handleKeyDown`.
 *
 * `preventDefault` runs ONLY for a key the engine actually consumed. Anything
 * else — `Tab`, `Escape`, `Home`/`End`, screen-reader shortcuts — must reach
 * the browser untouched, which is what keeps the surface escapable (SC 2.1.2).
 * @internal
 */
export function createKeyDownHandler(gestureProcessor: GestureProcessor): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
        const consumed = gestureProcessor.handleKeyDown({
            key: e.key,
            shiftKey: e.shiftKey,
            ctrlKey: e.ctrlKey,
            metaKey: e.metaKey,
            altKey: e.altKey,
        });
        if (consumed) {
            e.preventDefault();
        }
    };
}
