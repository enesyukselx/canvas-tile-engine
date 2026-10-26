import { useEffect, useMemo, useRef, memo } from "react";
import { useEngineContext } from "../EngineContext";
import { SpriteAnimator } from "@canvas-tile-engine/core";
import type { Bounds, ImageItem, SpriteRect } from "@canvas-tile-engine/core";

export interface SpriteProps<TImage = unknown> {
    /**
     * Items to draw. All items of one Sprite share the same animation and flip
     * frames in sync. Compared by reference: keep the array stable with
     * useMemo/useState instead of an inline literal. Items are cloned
     * internally, so the passed objects are never mutated.
     */
    items: ImageItem<TImage> | ImageItem<TImage>[];
    /**
     * Animation frames in play order, e.g. `sheet.framesInRow(0, 0, 4)`.
     * Compared by reference — keep it stable with useMemo.
     */
    frames: SpriteRect[];
    /** Playback speed in frames per second. */
    fps: number;
    /** Restart from the first frame after the last one (default: true). */
    loop?: boolean;
    /**
     * Whether the animation is playing (default: true). Toggling back to true
     * restarts from the first frame.
     */
    playing?: boolean;
    layer?: number;
    /** Fired when a non-looping animation reaches its last frame. */
    onComplete?: () => void;
    /**
     * Set to `false` to keep these items out of hit testing — the
     * `pointer-events: none` of the draw API, for decorative animations.
     * Default `true`.
     */
    hitTest?: boolean;
    /**
     * Confine this registration to a world rectangle: nothing it draws paints
     * outside it, and nothing outside it hit-tests. Compared by value, so an
     * inline object literal does not re-register on every render.
     */
    clip?: Bounds;
}

/**
 * Draws spritesheet-animated images on the canvas. Renders each item cropped
 * to the current animation frame and re-renders at the animation's fps.
 * For a fixed (non-animated) sheet frame, use `<Image>` with the item's
 * `sprite` field instead.
 */
export const Sprite = memo(function Sprite({
    items,
    frames,
    fps,
    loop = true,
    playing = true,
    layer = 1,
    onComplete,
    hitTest,
    clip,
}: SpriteProps) {
    const { engine, requestRender } = useEngineContext();

    // Value-compared so an inline clip literal does not re-register the
    // draw call on every render.
    const clipKey = clip ? `${clip.minX},${clip.maxX},${clip.minY},${clip.maxY}` : "";

    // Clone so the animation owns the drawn items' `sprite` field without
    // mutating caller-owned objects.
    const drawnItems = useMemo(
        () => (Array.isArray(items) ? items.map((item) => ({ ...item })) : [{ ...items }]),
        [items],
    );

    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    useEffect(() => {
        const handle = engine.drawImage(drawnItems, layer, { hitTest, clip });
        requestRender();
        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, drawnItems, layer, hitTest, requestRender, clipKey]);

    useEffect(() => {
        if (!playing || frames.length === 0) {
            return;
        }

        const animator = new SpriteAnimator({ frames, fps, loop });
        animator.start(
            (frame) => {
                for (const item of drawnItems) {
                    item.sprite = frame;
                }
                requestRender();
            },
            () => onCompleteRef.current?.(),
        );

        return () => animator.stop();
    }, [drawnItems, frames, fps, loop, playing, requestRender]);

    return null;
});
