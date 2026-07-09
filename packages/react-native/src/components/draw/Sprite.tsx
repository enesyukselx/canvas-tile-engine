import { useEffect, useMemo, useRef, memo } from "react";
import { useEngineContext } from "../../context/EngineContext";
import { SpriteAnimator } from "@canvas-tile-engine/core";
import type { ImageItem, SpriteRect } from "@canvas-tile-engine/core";
import type { SkImage } from "@shopify/react-native-skia";

export interface SpriteProps {
    /**
     * Items to draw. All items of one Sprite share the same animation and flip
     * frames in sync. Compared by reference: keep the array stable with
     * useMemo/useState instead of an inline literal. Items are cloned
     * internally, so the passed objects are never mutated.
     */
    items: ImageItem<SkImage> | ImageItem<SkImage>[];
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
}: SpriteProps) {
    const { engine, requestRender } = useEngineContext();

    // Clone so the animation owns the drawn items' `sprite` field without
    // mutating caller-owned objects.
    const drawnItems = useMemo(
        () => (Array.isArray(items) ? items.map((item) => ({ ...item })) : [{ ...items }]),
        [items],
    );

    const onCompleteRef = useRef(onComplete);
    onCompleteRef.current = onComplete;

    useEffect(() => {
        const handle = engine.drawImage(drawnItems, layer);
        requestRender();
        return () => {
            if (handle) {
                engine.removeDrawHandle(handle);
                // Repaint so the removed items disappear immediately; safe on
                // full unmount too — the handle no-ops once the engine is gone.
                requestRender();
            }
        };
    }, [engine, drawnItems, layer, requestRender]);

    useEffect(() => {
        if (!playing || frames.length === 0) return;

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
