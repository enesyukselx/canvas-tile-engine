import type { GestureProcessor } from "@canvas-tile-engine/core";

/**
 * Bridge a DOM `KeyboardEvent` into the platform-agnostic
 * `GestureProcessor.handleKeyDown`.
 *
 * `preventDefault` runs ONLY for a key the engine actually consumed. Anything
 * else reaches the browser untouched. The default camera leaves Tab, Escape,
 * Home/End and screen-reader shortcuts alone; a selection tool consumes
 * Escape only while cancelling an active edit. Tab always remains available.
 *
 * Only keys pressed while the key target itself has focus are handled. Key
 * events bubble, and in vanilla JS the wrapper is the app's own element, often
 * holding overlays such as a popup with an `<input>` or `<button>`: without
 * this check, typing a space or `-` there would activate or zoom the map and
 * never reach the field.
 * @internal
 */
export function createKeyDownHandler(gestureProcessor: GestureProcessor): (e: KeyboardEvent) => void {
    return (e: KeyboardEvent) => {
        if (e.target !== e.currentTarget) {
            return;
        }
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
