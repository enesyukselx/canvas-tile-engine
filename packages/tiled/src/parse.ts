import type { Bounds, Coords, SpriteRect } from "@canvas-tile-engine/core";
import { decodeGid } from "./gid";
import { decodeLayerData } from "./decode";
import { pxPointToWorld, pxToWorld, rotateAround } from "./coords";
import type {
    TiledAnimation,
    TiledCell,
    TiledLayer,
    TiledMap,
    TiledObject,
    TiledObjectShape,
    TiledTileset,
    TmjLayer,
    TmjMap,
    TmjObject,
    TmjProperty,
    TmjTileset,
} from "./types";

const PKG = "@canvas-tile-engine/tiled";

export interface ParseTiledMapOptions {
    /**
     * Return the parsed JSON of an external tileset (`.tsj`), given its
     * `source` path exactly as written in the map file. Required only when
     * the map references external tilesets.
     */
    resolveTileset?: (source: string) => Promise<unknown>;
}

function propsToRecord(props: TmjProperty[] | undefined): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (props) for (const p of props) out[p.name] = p.value;
    return out;
}

/** Atlas source rect of a tileset's local tile id (margin/spacing applied). */
export function tilesetSpriteRect(tileset: TiledTileset, localId: number): SpriteRect {
    const col = localId % tileset.columns;
    const row = Math.floor(localId / tileset.columns);
    const step = tileset.tileSize + tileset.spacing;
    return {
        x: tileset.margin + col * step,
        y: tileset.margin + row * step,
        w: tileset.tileSize,
        h: tileset.tileSize,
    };
}

function normalizeTileset(raw: TmjTileset, firstgid: number, mapTileSize: number, warnings: string[]): TiledTileset {
    const name = raw.name ?? raw.image;
    if (raw.tilewidth !== raw.tileheight) {
        throw new Error(`${PKG}: tileset "${name}" has non-square tiles (${raw.tilewidth}x${raw.tileheight}).`);
    }
    if (raw.tilewidth !== mapTileSize) {
        throw new Error(
            `${PKG}: tileset "${name}" tile size (${raw.tilewidth}px) differs from the map grid (${mapTileSize}px). ` +
                `Oversized-tile tilesets are not supported in v1.`,
        );
    }
    if (!Number.isInteger(raw.columns) || raw.columns <= 0) {
        throw new Error(`${PKG}: tileset "${name}" has no valid "columns" value.`);
    }

    const tileset: TiledTileset = {
        name,
        firstgid,
        image: raw.image,
        imageWidth: raw.imagewidth,
        imageHeight: raw.imageheight,
        tileSize: raw.tilewidth,
        columns: raw.columns,
        margin: raw.margin ?? 0,
        spacing: raw.spacing ?? 0,
        animations: new Map(),
        tileProperties: new Map(),
    };

    // Second pass: animations/properties need the finished tileset for
    // sprite-rect math.
    const animations = tileset.animations as Map<number, TiledAnimation>;
    const tileProperties = tileset.tileProperties as Map<number, Record<string, unknown>>;
    for (const tile of raw.tiles ?? []) {
        if (tile.animation && tile.animation.length > 0) {
            const durations = tile.animation.map((f) => f.duration);
            if (durations.some((d) => d !== durations[0])) {
                warnings.push(
                    `tileset "${name}" tile ${tile.id}: uneven animation frame durations; ` +
                        `playback uses the first frame's duration (${durations[0]}ms) for every frame.`,
                );
            }
            animations.set(tile.id, {
                frames: tile.animation.map((f) => tilesetSpriteRect(tileset, f.tileid)),
                fps: 1000 / durations[0],
            });
        }
        if (tile.properties && tile.properties.length > 0) {
            tileProperties.set(tile.id, propsToRecord(tile.properties));
        }
    }
    return tileset;
}

/** Owning tileset of a GID: the last tileset whose firstgid <= gid. */
function tilesetForGid(gid: number, tilesets: TiledTileset[]): TiledTileset {
    for (let i = tilesets.length - 1; i >= 0; i--) {
        if (gid >= tilesets[i].firstgid) return tilesets[i];
    }
    throw new Error(`${PKG}: GID ${gid} does not belong to any tileset.`);
}

function normalizeObject(
    o: TmjObject,
    tileSize: number,
    tilesets: TiledTileset[],
    warnings: string[],
): TiledObject | null {
    if (o.visible === false) return null;

    const label = o.name ? `"${o.name}"` : `#${o.id}`;
    if (o.text !== undefined) {
        warnings.push(`object ${label}: text objects are not supported; skipped.`);
        return null;
    }

    const data = {
        id: o.id,
        name: o.name ?? "",
        type: o.class ?? o.type ?? "",
        properties: propsToRecord(o.properties),
    };
    const rotation = o.rotation ?? 0;
    const anchorPx = { x: o.x, y: o.y };

    let shape: TiledObjectShape;
    if (o.point === true) {
        shape = { kind: "point", at: pxPointToWorld(anchorPx, tileSize) };
    } else if (o.gid !== undefined) {
        const { gid, flipX, flipY, rotate } = decodeGid(o.gid);
        const tileset = tilesetForGid(gid, tilesets);
        const w = o.width ?? tileSize;
        const h = o.height ?? tileSize;
        if (w !== h) {
            warnings.push(`object ${label}: non-square tile object (${w}x${h}px); skipped.`);
            return null;
        }
        // Tile objects anchor at their BOTTOM-left corner; the object's own
        // rotation spins around that anchor, so the center moves with it.
        const centerPx = rotateAround({ x: o.x + w / 2, y: o.y - h / 2 }, anchorPx, rotation);
        shape = {
            kind: "tile",
            center: pxPointToWorld(centerPx, tileSize),
            size: w / tileSize,
            tileset,
            sprite: tilesetSpriteRect(tileset, gid - tileset.firstgid),
            flipX,
            flipY,
            rotate: rotate + rotation,
        };
    } else if (o.ellipse === true) {
        if (rotation !== 0) {
            warnings.push(`object ${label}: ellipse rotation is not supported; rotation ignored.`);
        }
        const w = o.width ?? 0;
        const h = o.height ?? 0;
        shape = {
            kind: "ellipse",
            center: pxPointToWorld({ x: o.x + w / 2, y: o.y + h / 2 }, tileSize),
            radiusX: w / 2 / tileSize,
            radiusY: h / 2 / tileSize,
        };
    } else if (o.polygon !== undefined || o.polyline !== undefined) {
        const rel = o.polygon ?? o.polyline!;
        const points: Coords[] = rel.map((p) => {
            const abs = rotateAround({ x: o.x + p.x, y: o.y + p.y }, anchorPx, rotation);
            return pxPointToWorld(abs, tileSize);
        });
        shape = {
            kind: o.polygon !== undefined ? "polygon" : "polyline",
            points,
        };
    } else {
        // Plain rectangle (top-left anchored; rotation around the anchor).
        const w = o.width ?? 0;
        const h = o.height ?? 0;
        const corners = [
            { x: o.x, y: o.y },
            { x: o.x + w, y: o.y },
            { x: o.x + w, y: o.y + h },
            { x: o.x, y: o.y + h },
        ];
        shape = {
            kind: "rect",
            points: corners.map((c) => pxPointToWorld(rotateAround(c, anchorPx, rotation), tileSize)),
        };
    }

    return { data, shape, visible: true };
}

/**
 * Parse and normalize a Tiled JSON map (`.tmj`) into the engine-space model.
 * Async only because external tilesets may need fetching via
 * `options.resolveTileset`. Throws on unsupported maps (non-orthogonal,
 * infinite, non-square or grid-mismatched tiles, zstd); records skipped
 * content in `map.warnings`.
 */
export async function parseTiledMap(json: unknown, options?: ParseTiledMapOptions): Promise<TiledMap> {
    if (typeof json !== "object" || json === null) {
        throw new Error(`${PKG}: expected a parsed Tiled JSON map object.`);
    }
    const raw = json as TmjMap;

    const orientation = raw.orientation ?? "orthogonal";
    if (orientation !== "orthogonal") {
        throw new Error(`${PKG}: orientation "${orientation}" is not supported (orthogonal only).`);
    }
    if (raw.infinite === true) {
        throw new Error(
            `${PKG}: infinite maps are not supported — convert the map to a fixed size in Tiled (Map > Resize Map).`,
        );
    }
    if (raw.tilewidth !== raw.tileheight) {
        throw new Error(`${PKG}: non-square tiles (${raw.tilewidth}x${raw.tileheight}) are not supported.`);
    }
    if (!Number.isInteger(raw.width) || !Number.isInteger(raw.height) || raw.width <= 0 || raw.height <= 0) {
        throw new Error(`${PKG}: map has no valid width/height.`);
    }

    const warnings: string[] = [];
    const tileSize = raw.tilewidth;

    const tilesets: TiledTileset[] = [];
    for (const ref of raw.tilesets ?? []) {
        let source: TmjTileset;
        if (typeof ref.source === "string") {
            if (!options?.resolveTileset) {
                throw new Error(
                    `${PKG}: map references external tileset "${ref.source}" — provide options.resolveTileset to load it.`,
                );
            }
            source = (await options.resolveTileset(ref.source)) as TmjTileset;
            if (typeof source !== "object" || source === null) {
                throw new Error(`${PKG}: resolveTileset("${ref.source}") did not return a tileset object.`);
            }
        } else {
            source = ref;
        }
        tilesets.push(normalizeTileset(source, ref.firstgid, tileSize, warnings));
    }
    tilesets.sort((a, b) => a.firstgid - b.firstgid);

    const layers: TiledLayer[] = [];

    const walk = (rawLayers: TmjLayer[], parentOpacity: number) => {
        for (const layer of rawLayers) {
            if (layer.visible === false) continue;
            const name = layer.name ?? "(unnamed)";
            if ((layer.offsetx ?? 0) !== 0 || (layer.offsety ?? 0) !== 0) {
                throw new Error(
                    `${PKG}: layer "${name}" uses a pixel offset (offsetx/offsety), which is not supported — ` +
                        `remove the layer offset in Tiled.`,
                );
            }
            if (layer.tintcolor !== undefined) {
                warnings.push(`layer "${name}": tintcolor is not supported; ignored.`);
            }
            const opacity = parentOpacity * (layer.opacity ?? 1);

            if (layer.type === "group") {
                walk(layer.layers ?? [], opacity);
            } else if (layer.type === "imagelayer") {
                warnings.push(`layer "${name}": image layers are not supported; skipped.`);
            } else if (layer.type === "tilelayer") {
                const gids = decodeLayerData(layer, raw.width * raw.height);
                const cells: TiledCell[] = [];
                for (let i = 0; i < gids.length; i++) {
                    if (gids[i] === 0) continue;
                    const { gid, flipX, flipY, rotate } = decodeGid(gids[i]);
                    const tileset = tilesetForGid(gid, tilesets);
                    const localId = gid - tileset.firstgid;
                    const cell: TiledCell = {
                        x: i % raw.width,
                        y: Math.floor(i / raw.width),
                        tileset,
                        sprite: tilesetSpriteRect(tileset, localId),
                        flipX,
                        flipY,
                        rotate,
                    };
                    const animation = tileset.animations.get(localId);
                    if (animation) cell.animation = animation;
                    const properties = tileset.tileProperties.get(localId);
                    if (properties) cell.properties = properties;
                    cells.push(cell);
                }
                layers.push({
                    kind: "tiles",
                    name,
                    opacity,
                    cells,
                    properties: propsToRecord(layer.properties),
                });
            } else if (layer.type === "objectgroup") {
                if (opacity !== 1) {
                    warnings.push(`layer "${name}": object-layer opacity is not supported; objects draw fully opaque.`);
                }
                const objects: TiledObject[] = [];
                for (const o of layer.objects ?? []) {
                    const normalized = normalizeObject(o, tileSize, tilesets, warnings);
                    if (normalized) objects.push(normalized);
                }
                layers.push({
                    kind: "objects",
                    name,
                    opacity,
                    objects,
                    properties: propsToRecord(layer.properties),
                });
            } else {
                warnings.push(`layer "${name}": unknown layer type "${layer.type}"; skipped.`);
            }
        }
    };
    walk(raw.layers ?? [], 1);

    return {
        columns: raw.width,
        rows: raw.height,
        tileSize,
        tilesets,
        layers,
        properties: propsToRecord(raw.properties),
        warnings,
    };
}

/** Item-space world position of a Tiled pixel coordinate — exposed for apps
 * that store extra pixel-space data in custom properties. */
export const tiledPxToWorld = pxToWorld;

/**
 * The map's world extents in RAW corner space — the space the bounds APIs
 * and event `coords.raw` use, where cell k spans [k, k+1] (item space with
 * its cell-centered integers is for item coordinates only). Feed it to
 * `config.bounds`/`engine.setBounds` to keep the camera on the map, or to
 * `engine.fitBounds` to frame it.
 */
export function tiledMapBounds(map: TiledMap): Bounds {
    return {
        minX: 0,
        minY: 0,
        maxX: map.columns,
        maxY: map.rows,
    };
}
