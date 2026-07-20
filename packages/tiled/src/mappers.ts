import type { Circle, ImageItem, PathCommand, PathItem, PathStyle } from "@canvas-tile-engine/core";
import type { TiledAnimation, TiledObjectData, TiledObjectLayerData, TiledTileLayerData, TiledTileset } from "./types";

const PKG = "@canvas-tile-engine/tiled";

/** All cells sharing one animated tileset tile — one animator drives them all. */
export interface AnimatedTileGroup<TImage> {
    animation: TiledAnimation;
    items: ImageItem<TImage>[];
}

export interface TileLayerItems<TImage> {
    /** Never-changing cells — the drawStaticImage payload. */
    staticItems: ImageItem<TImage>[];
    /** One group per distinct animated tile — dynamic drawImage + SpriteAnimator. */
    animated: AnimatedTileGroup<TImage>[];
}

function imageFor<TImage>(images: ReadonlyMap<TiledTileset, TImage>, tileset: TiledTileset): TImage {
    const img = images.get(tileset);
    if (img === undefined) {
        throw new Error(`${PKG}: no image loaded for tileset "${tileset.name}" — load every map tileset first.`);
    }
    return img;
}

/**
 * Turn a parsed tile layer into engine image items. Animated cells are split
 * out and grouped by their (shared) animation so the mount can drive each
 * group with a single SpriteAnimator.
 */
export function tileLayerToItems<TImage>(
    layer: TiledTileLayerData,
    images: ReadonlyMap<TiledTileset, TImage>,
): TileLayerItems<TImage> {
    const staticItems: ImageItem<TImage>[] = [];
    const groups = new Map<TiledAnimation, AnimatedTileGroup<TImage>>();

    for (const cell of layer.cells) {
        const item: ImageItem<TImage> = {
            x: cell.x,
            y: cell.y,
            img: imageFor(images, cell.tileset),
            sprite: cell.animation ? cell.animation.frames[0] : cell.sprite,
        };
        if (cell.flipX) item.flipX = true;
        if (cell.flipY) item.flipY = true;
        if (cell.rotate !== 0) item.rotate = cell.rotate;
        if (layer.opacity !== 1) item.opacity = layer.opacity;
        if (cell.properties) item.data = cell.properties;

        if (cell.animation) {
            let group = groups.get(cell.animation);
            if (!group) {
                group = { animation: cell.animation, items: [] };
                groups.set(cell.animation, group);
            }
            group.items.push(item);
        } else {
            staticItems.push(item);
        }
    }
    return { staticItems, animated: [...groups.values()] };
}

export interface ObjectLayerItems<TImage> {
    /** rect/polygon/polyline/ellipse objects as hit-testable paths. */
    paths: PathItem<TiledObjectData>[];
    /** Point objects as fixed-pixel marker circles. */
    markers: Circle<TiledObjectData>[];
    /** Tile objects as image items. */
    tiles: ImageItem<TImage, TiledObjectData>[];
}

export interface ObjectStyleOptions {
    /** Style for object paths; a function receives the object's data. */
    pathStyle?: PathStyle | ((data: TiledObjectData) => PathStyle | undefined);
    /** Style for point-object markers. */
    markerStyle?: NonNullable<Circle["style"]>;
    /** Marker diameter in screen pixels. Default 8. */
    markerSizePx?: number;
}

const DEFAULT_PATH_STYLE: PathStyle = {
    fillStyle: "rgba(59, 130, 246, 0.2)",
    strokeStyle: "#3b82f6",
    lineWidthPx: 2,
};
const DEFAULT_MARKER_STYLE: NonNullable<Circle["style"]> = { fillStyle: "#3b82f6" };

/** Cubic-bezier circle constant. */
const KAPPA = 0.5522847498307936;

function ellipseCommands(cx: number, cy: number, rx: number, ry: number): PathCommand[] {
    if (rx === ry) {
        return [{ type: "arc", x: cx, y: cy, radius: rx, startAngle: 0, endAngle: 360 }];
    }
    const kx = rx * KAPPA;
    const ky = ry * KAPPA;
    return [
        { type: "moveTo", x: cx + rx, y: cy },
        { type: "bezierCurveTo", cp1x: cx + rx, cp1y: cy + ky, cp2x: cx + kx, cp2y: cy + ry, x: cx, y: cy + ry },
        { type: "bezierCurveTo", cp1x: cx - kx, cp1y: cy + ry, cp2x: cx - rx, cp2y: cy + ky, x: cx - rx, y: cy },
        { type: "bezierCurveTo", cp1x: cx - rx, cp1y: cy - ky, cp2x: cx - kx, cp2y: cy - ry, x: cx, y: cy - ry },
        { type: "bezierCurveTo", cp1x: cx + kx, cp1y: cy - ry, cp2x: cx + rx, cp2y: cy - ky, x: cx + rx, y: cy },
        { type: "closePath" },
    ];
}

/**
 * Turn a parsed object layer into engine items: paths (hit-testable, carrying
 * the Tiled object's id/name/type/properties in `data`), point markers, and
 * tile-object images.
 */
export function objectLayerToItems<TImage>(
    layer: TiledObjectLayerData,
    images: ReadonlyMap<TiledTileset, TImage>,
    options: ObjectStyleOptions = {},
): ObjectLayerItems<TImage> {
    const paths: PathItem<TiledObjectData>[] = [];
    const markers: Circle<TiledObjectData>[] = [];
    const tiles: ImageItem<TImage, TiledObjectData>[] = [];

    const styleFor = (data: TiledObjectData): PathStyle | undefined => {
        const style = options.pathStyle;
        if (typeof style === "function") return style(data) ?? DEFAULT_PATH_STYLE;
        return style ?? DEFAULT_PATH_STYLE;
    };

    for (const obj of layer.objects) {
        const { data, shape } = obj;
        switch (shape.kind) {
            case "rect":
            case "polygon":
                paths.push({ points: shape.points, closed: true, style: styleFor(data), data });
                break;
            case "polyline":
                paths.push({ points: shape.points, closed: false, style: styleFor(data), data });
                break;
            case "ellipse":
                paths.push({
                    commands: ellipseCommands(shape.center.x, shape.center.y, shape.radiusX, shape.radiusY),
                    style: styleFor(data),
                    data,
                });
                break;
            case "point":
                markers.push({
                    x: shape.at.x,
                    y: shape.at.y,
                    sizePx: options.markerSizePx ?? 8,
                    style: options.markerStyle ?? DEFAULT_MARKER_STYLE,
                    data,
                });
                break;
            case "tile": {
                const item: ImageItem<TImage, TiledObjectData> = {
                    x: shape.center.x,
                    y: shape.center.y,
                    size: shape.size,
                    img: imageFor(images, shape.tileset),
                    sprite: shape.sprite,
                    data,
                };
                if (shape.flipX) item.flipX = true;
                if (shape.flipY) item.flipY = true;
                if (shape.rotate !== 0) item.rotate = shape.rotate;
                tiles.push(item);
                break;
            }
        }
    }
    return { paths, markers, tiles };
}
