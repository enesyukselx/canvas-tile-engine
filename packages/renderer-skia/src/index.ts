import type { ImageItem } from "@canvas-tile-engine/core";
import {
    Skia,
    type SkCanvas,
    type SkImage,
    type SkPaint,
    type SkFont,
    type SkPath,
    type SkRect,
    type SkPoint,
    type SkRRect,
} from "@shopify/react-native-skia";

// Main renderer export
export { RendererSkia } from "./RendererSkia";

// Mount contract for hosts (e.g. the React Native binding)
export type { SkiaMount, SkiaSize } from "./types";

// Types only - internal classes not exported
export type { DrawHandle } from "./modules/Layer";

// Re-export the Skia surface so consumers can write custom draw code without
// importing from @shopify/react-native-skia directly. (The peer dependency
// still has to be installed by the app, but app code never references it.)
export { Skia };
export type { SkCanvas, SkImage, SkPaint, SkFont, SkPath, SkRect, SkPoint, SkRRect };

/** Convenience alias for image draw items backed by a Skia `SkImage`. */
export type SkiaImageItem = ImageItem<SkImage>;
