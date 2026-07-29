import type { NamedExoticComponent } from "react";
import {
    Image as ImageBase,
    Sprite as SpriteBase,
    StaticImage as StaticImageBase,
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
    DrawFunction,
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
// image type; re-export them typed to HTMLImageElement so app code sees the
// same concrete API as before. Runtime objects are identical.
export type ImageProps = ImagePropsBase<HTMLImageElement>;
export const Image = ImageBase as NamedExoticComponent<ImageProps>;

export type SpriteProps = SpritePropsBase<HTMLImageElement>;
export const Sprite = SpriteBase as NamedExoticComponent<SpriteProps>;

export type StaticImageProps = StaticImagePropsBase<HTMLImageElement>;
export const StaticImage = StaticImageBase as NamedExoticComponent<StaticImageProps>;

// On the web the custom draw context stays `unknown` (it depends on the
// injected renderer), which is the shared default.
export type DrawFunctionProps = DrawFunctionPropsBase;
