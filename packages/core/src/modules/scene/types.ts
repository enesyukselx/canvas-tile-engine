import type { Bounds, Circle, Coords, ImageItem, Line, LineStyle, PathItem, Rect, Text } from "../../types";
import type { ItemCollection } from "../ItemCollection";

/** Values that survive JSON without invoking application code or losing data. */
export type SceneJsonValue = null | boolean | number | string | SceneJsonValue[] | SceneJsonObject;
export interface SceneJsonObject {
    [key: string]: SceneJsonValue;
}

export type SceneKind = "rect" | "circle" | "line" | "text" | "image" | "path";

export interface SceneAsset {
    id: string;
    /** An opaque URL/path for the application's resolver; core never fetches it. */
    src?: string;
    metadata?: SceneJsonValue;
}

export interface SceneCamera {
    center: Coords;
    scale: number;
}

export type SceneRect = Rect<SceneJsonValue> & { id: string };
export type SceneCircle = Circle<SceneJsonValue> & { id: string };
export type SceneLine = Line<SceneJsonValue> & { id: string };
export type SceneText = Text<SceneJsonValue> & { id: string };
export type ScenePath = PathItem<SceneJsonValue> & { id: string };
export type SceneImage = Omit<ImageItem<never, SceneJsonValue>, "img"> & { id: string; assetId: string };

export interface SceneItemMap {
    rect: SceneRect;
    circle: SceneCircle;
    line: SceneLine;
    text: SceneText;
    image: SceneImage;
    path: ScenePath;
}

export type SceneRuntimeItemMap<TImage> = Omit<SceneItemMap, "image"> & {
    image: SceneImage & { img: TImage };
};

interface SceneBatchBase {
    /** Unique across all batches in this document. */
    id: string;
    clip?: Bounds;
    hitTest?: boolean;
    metadata?: SceneJsonValue;
}

/** Batches and their items paint in array order within their numeric layer. */
export type SceneBatch = {
    [K in SceneKind]: SceneBatchBase & {
        kind: K;
        items: SceneItemMap[K][];
    } & (K extends "line" ? { style?: LineStyle } : object);
}[SceneKind];

export interface SceneLayer {
    id: string;
    /** A finite, unique engine layer number. Lower numbers paint first. */
    order: number;
    batches: SceneBatch[];
    metadata?: SceneJsonValue;
}

/** Portable version 1 document. Item IDs are unique across the entire scene. */
export interface SceneDocument {
    schemaVersion: 1;
    assets: SceneAsset[];
    layers: SceneLayer[];
    camera?: SceneCamera;
    metadata?: SceneJsonValue;
}

export interface SceneDocumentInput {
    assets?: SceneAsset[];
    layers?: SceneLayer[];
    camera?: SceneCamera;
    metadata?: SceneJsonValue;
}

/** Budgets apply to the whole JSON value, including application data. */
export interface SceneLimits {
    maxDepth: number;
    maxNodes: number;
    maxStringLength: number;
    maxSourceLength: number;
}

/** Each supplied step must produce a JSON document with version `from + 1`. */
export type SceneMigration = (document: SceneJsonObject) => unknown;
export type SceneMigrations = ReadonlyMap<number, SceneMigration>;

export interface SceneReadOptions {
    limits?: Partial<SceneLimits>;
    /** No historical formats are assumed. Register only formats your app knows. */
    migrations?: SceneMigrations;
}

export interface PrepareSceneOptions<TImage> extends SceneReadOptions {
    /** Called once for every declared asset, before any engine is changed. */
    resolveImage?: (asset: Readonly<SceneAsset>) => TImage | Promise<TImage>;
}

export type SceneCollection<TImage, K extends SceneKind> = ItemCollection<SceneRuntimeItemMap<TImage>[K]>;
