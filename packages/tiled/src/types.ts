import type { Coords, SpriteRect } from "@canvas-tile-engine/core";

// ─── Raw Tiled JSON (.tmj / .tsj) — the subset this package reads ───

export interface TmjProperty {
    name: string;
    type?: string;
    value: unknown;
}

export interface TmjFrame {
    tileid: number;
    duration: number;
}

export interface TmjTilesetTile {
    id: number;
    animation?: TmjFrame[];
    properties?: TmjProperty[];
}

export interface TmjTileset {
    name?: string;
    image: string;
    imagewidth?: number;
    imageheight?: number;
    tilewidth: number;
    tileheight: number;
    columns: number;
    tilecount?: number;
    margin?: number;
    spacing?: number;
    tiles?: TmjTilesetTile[];
}

/** Inline tileset, or a reference to an external `.tsj` file. */
export type TmjTilesetRef =
    | { firstgid: number; source: string }
    | (TmjTileset & { firstgid: number; source?: undefined });

export interface TmjPoint {
    x: number;
    y: number;
}

export interface TmjObject {
    id: number;
    name?: string;
    /** Tiled <1.9 object type. */
    type?: string;
    /** Tiled >=1.9 renamed `type` to `class`. */
    class?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    /** Degrees, clockwise, around the object's anchor. */
    rotation?: number;
    /** Tile object: a GID (with flip flags) drawn at the object position. */
    gid?: number;
    visible?: boolean;
    ellipse?: boolean;
    point?: boolean;
    /** Vertices relative to (x, y), in pixels. */
    polygon?: TmjPoint[];
    polyline?: TmjPoint[];
    text?: unknown;
    properties?: TmjProperty[];
}

export interface TmjLayer {
    type: string; // "tilelayer" | "objectgroup" | "group" | "imagelayer"
    name?: string;
    visible?: boolean;
    opacity?: number;
    offsetx?: number;
    offsety?: number;
    tintcolor?: string;
    /** tilelayer: GID array (csv encoding) or base64 string. */
    data?: number[] | string;
    encoding?: string; // "csv" (default) | "base64"
    compression?: string; // "" | "zlib" | "gzip" | "zstd"
    chunks?: unknown[];
    /** group */
    layers?: TmjLayer[];
    /** objectgroup */
    objects?: TmjObject[];
    properties?: TmjProperty[];
}

export interface TmjMap {
    type?: string;
    orientation?: string;
    infinite?: boolean;
    width: number;
    height: number;
    tilewidth: number;
    tileheight: number;
    layers?: TmjLayer[];
    tilesets?: TmjTilesetRef[];
    properties?: TmjProperty[];
}

// ─── Normalized model (engine-space; what parseTiledMap returns) ───

/** One tile animation, shared by every cell referencing the same tileset tile. */
export interface TiledAnimation {
    frames: SpriteRect[];
    /** Derived from the first frame's duration; see the RFC. */
    fps: number;
}

export interface TiledTileset {
    name: string;
    firstgid: number;
    /** Image source as written in the file (resolve to a URL/path at mount). */
    image: string;
    imageWidth?: number;
    imageHeight?: number;
    /** Tile edge in source pixels (square, equal to the map grid). */
    tileSize: number;
    columns: number;
    margin: number;
    spacing: number;
    /** Local tile id → animation (only animated tiles present). */
    animations: ReadonlyMap<number, TiledAnimation>;
    /** Local tile id → custom properties (only tiles that have any). */
    tileProperties: ReadonlyMap<number, Record<string, unknown>>;
}

/** One placed tile of a tile layer, in item space (integers = cell centers). */
export interface TiledCell {
    x: number;
    y: number;
    tileset: TiledTileset;
    /** Atlas source rect (margin/spacing applied). */
    sprite: SpriteRect;
    flipX: boolean;
    flipY: boolean;
    /** Degrees, clockwise — from the GID diagonal-flip decode. */
    rotate: number;
    /** Shared animation object when this cell's tile is animated. */
    animation?: TiledAnimation;
    /** Custom properties of the tileset tile, if any. */
    properties?: Record<string, unknown>;
}

/** Identity payload every produced object item carries in `data`. */
export interface TiledObjectData {
    id: number;
    name: string;
    /** Tiled object type/class ("" when unset). */
    type: string;
    properties: Record<string, unknown>;
}

export type TiledObjectShape =
    | { kind: "rect"; points: Coords[] }
    | { kind: "polygon"; points: Coords[] }
    | { kind: "polyline"; points: Coords[] }
    | { kind: "ellipse"; center: Coords; radiusX: number; radiusY: number }
    | { kind: "point"; at: Coords }
    | {
          kind: "tile";
          /** Item-space center of the drawn tile. */
          center: Coords;
          /** World-unit size (tiles are square, so width === height). */
          size: number;
          tileset: TiledTileset;
          sprite: SpriteRect;
          flipX: boolean;
          flipY: boolean;
          rotate: number;
      };

export interface TiledObject {
    data: TiledObjectData;
    shape: TiledObjectShape;
    visible: boolean;
}

export interface TiledTileLayerData {
    kind: "tiles";
    name: string;
    opacity: number;
    cells: TiledCell[];
    properties: Record<string, unknown>;
}

export interface TiledObjectLayerData {
    kind: "objects";
    name: string;
    opacity: number;
    objects: TiledObject[];
    properties: Record<string, unknown>;
}

export type TiledLayer = TiledTileLayerData | TiledObjectLayerData;

export interface TiledMap {
    columns: number;
    rows: number;
    /** px per cell in the source assets. */
    tileSize: number;
    tilesets: TiledTileset[];
    /** Flattened (groups resolved), in draw order, invisible layers removed. */
    layers: TiledLayer[];
    properties: Record<string, unknown>;
    /** Non-fatal skips and quirks encountered while parsing. */
    warnings: string[];
}
