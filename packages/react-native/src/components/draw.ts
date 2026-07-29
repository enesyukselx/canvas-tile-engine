import type { NamedExoticComponent } from "react";
import type { SkCanvas, SkImage } from "@canvas-tile-engine/renderer-skia";
import {
    Image as ImageBase,
    Sprite as SpriteBase,
    StaticImage as StaticImageBase,
    DrawFunction as DrawFunctionBase,
    type ImageProps as ImagePropsBase,
    type SpriteProps as SpritePropsBase,
    type StaticImageProps as StaticImagePropsBase,
    type DrawFunctionProps as DrawFunctionPropsBase,
} from "@canvas-tile-engine/react-shared";

// Components with no platform-specific typing re-export as-is.
export {
    Rect,
    Circle,
    GridLines,
    Line,
    Text,
    Path,
    StaticRect,
    StaticCircle,
    type RectProps,
    type CircleProps,
    type GridLinesProps,
    type LineProps,
    type TextProps,
    type PathProps,
    type StaticRectProps,
    type StaticCircleProps,
} from "@canvas-tile-engine/react-shared";

// Type-level pins: the shared implementations are generic over the platform
// image and draw context types; re-export them typed to Skia's `SkImage` and
// `SkCanvas` so app code sees the concrete API. Runtime objects are identical.
export type ImageProps = ImagePropsBase<SkImage>;
export const Image = ImageBase as NamedExoticComponent<ImageProps>;

export type SpriteProps = SpritePropsBase<SkImage>;
export const Sprite = SpriteBase as NamedExoticComponent<SpriteProps>;

export type StaticImageProps = StaticImagePropsBase<SkImage>;
export const StaticImage = StaticImageBase as NamedExoticComponent<StaticImageProps>;

export type DrawFunctionProps = DrawFunctionPropsBase<SkCanvas>;
// The shared implementation forwards the renderer's draw context straight
// through; on the Skia backend it is always an SkCanvas, so the double cast
// narrows the callback's `ctx: unknown` to keep the cast out of user code.
export const DrawFunction = DrawFunctionBase as unknown as NamedExoticComponent<DrawFunctionProps>;
