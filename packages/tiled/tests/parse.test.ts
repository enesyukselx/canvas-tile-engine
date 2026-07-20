import { describe, expect, it } from "vitest";
import { parseTiledMap } from "../src/parse";
import { GID_FLIP_H } from "../src/gid";
import type { TmjMap, TiledTileLayerData, TiledObjectLayerData } from "../src/types";

const TILESET = {
    firstgid: 1,
    name: "terrain",
    image: "terrain.png",
    imagewidth: 64,
    imageheight: 32,
    tilewidth: 16,
    tileheight: 16,
    columns: 4,
    tilecount: 8,
};

function baseMap(partial: Partial<TmjMap>): TmjMap {
    return {
        orientation: "orthogonal",
        width: 2,
        height: 2,
        tilewidth: 16,
        tileheight: 16,
        tilesets: [{ ...TILESET }],
        layers: [],
        ...partial,
    };
}

describe("parseTiledMap — validation", () => {
    it("rejects non-orthogonal maps", async () => {
        await expect(parseTiledMap(baseMap({ orientation: "isometric" }))).rejects.toThrow(/orthogonal only/);
    });

    it("rejects infinite maps with the resize hint", async () => {
        await expect(parseTiledMap(baseMap({ infinite: true }))).rejects.toThrow(/Resize Map/);
    });

    it("rejects non-square map tiles", async () => {
        await expect(parseTiledMap(baseMap({ tileheight: 8 }))).rejects.toThrow(/non-square/);
    });

    it("rejects tilesets whose tile size differs from the map grid", async () => {
        const map = baseMap({ tilesets: [{ ...TILESET, tilewidth: 32, tileheight: 32 }] });
        await expect(parseTiledMap(map)).rejects.toThrow(/differs from the map grid/);
    });

    it("rejects layers with pixel offsets", async () => {
        const map = baseMap({
            layers: [{ type: "tilelayer", name: "t", data: [0, 0, 0, 0], offsetx: 4 }],
        });
        await expect(parseTiledMap(map)).rejects.toThrow(/offset/);
    });
});

describe("parseTiledMap — tile layers", () => {
    it("places cells at item-space cell coordinates with atlas sprite rects", async () => {
        const map = await parseTiledMap(baseMap({ layers: [{ type: "tilelayer", name: "t", data: [1, 0, 6, 2] }] }));
        const layer = map.layers[0] as TiledTileLayerData;

        expect(layer.kind).toBe("tiles");
        expect(layer.cells).toHaveLength(3); // gid 0 = empty, skipped
        // gid 1 -> local 0 -> col 0 row 0; index 0 -> cell (0, 0)
        expect(layer.cells[0]).toMatchObject({ x: 0, y: 0, sprite: { x: 0, y: 0, w: 16, h: 16 } });
        // gid 6 -> local 5 -> col 1 row 1; index 2 -> cell (0, 1)
        expect(layer.cells[1]).toMatchObject({ x: 0, y: 1, sprite: { x: 16, y: 16, w: 16, h: 16 } });
        // gid 2 -> local 1 -> col 1 row 0; index 3 -> cell (1, 1)
        expect(layer.cells[2]).toMatchObject({ x: 1, y: 1, sprite: { x: 16, y: 0, w: 16, h: 16 } });
    });

    it("applies margin and spacing to sprite rects", async () => {
        const map = await parseTiledMap(
            baseMap({
                tilesets: [{ ...TILESET, margin: 2, spacing: 1 }],
                layers: [{ type: "tilelayer", name: "t", data: [6, 0, 0, 0] }],
            }),
        );
        const layer = map.layers[0] as TiledTileLayerData;
        // local 5 -> col 1 row 1; step = 16 + 1
        expect(layer.cells[0].sprite).toEqual({ x: 2 + 17, y: 2 + 17, w: 16, h: 16 });
    });

    it("decodes flip flags on cells", async () => {
        const flipped = (1 | GID_FLIP_H) >>> 0;
        const map = await parseTiledMap(
            baseMap({ layers: [{ type: "tilelayer", name: "t", data: [flipped, 0, 0, 0] }] }),
        );
        const layer = map.layers[0] as TiledTileLayerData;
        expect(layer.cells[0]).toMatchObject({ flipX: true, flipY: false, rotate: 0 });
    });

    it("attaches shared animations and tile properties from the tileset", async () => {
        const map = await parseTiledMap(
            baseMap({
                tilesets: [
                    {
                        ...TILESET,
                        tiles: [
                            {
                                id: 0,
                                animation: [
                                    { tileid: 0, duration: 200 },
                                    { tileid: 1, duration: 200 },
                                ],
                            },
                            { id: 0, properties: [{ name: "kind", value: "water" }] },
                        ],
                    },
                ],
                layers: [{ type: "tilelayer", name: "t", data: [1, 1, 0, 0] }],
            }),
        );
        const layer = map.layers[0] as TiledTileLayerData;
        expect(layer.cells[0].animation).toBeDefined();
        expect(layer.cells[0].animation!.fps).toBe(5);
        expect(layer.cells[0].animation!.frames).toHaveLength(2);
        // Shared object identity: both cells reference the SAME animation.
        expect(layer.cells[0].animation).toBe(layer.cells[1].animation);
    });

    it("warns on uneven animation durations and uses the first frame's", async () => {
        const map = await parseTiledMap(
            baseMap({
                tilesets: [
                    {
                        ...TILESET,
                        tiles: [
                            {
                                id: 0,
                                animation: [
                                    { tileid: 0, duration: 100 },
                                    { tileid: 1, duration: 300 },
                                ],
                            },
                        ],
                    },
                ],
                layers: [{ type: "tilelayer", name: "t", data: [1, 0, 0, 0] }],
            }),
        );
        expect(map.warnings.some((w) => w.includes("uneven"))).toBe(true);
        expect((map.layers[0] as TiledTileLayerData).cells[0].animation!.fps).toBe(10);
    });
});

describe("parseTiledMap — layer tree", () => {
    it("flattens groups, multiplies opacity, honors visible:false, warns on image layers", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "group",
                        name: "g",
                        opacity: 0.5,
                        layers: [
                            { type: "tilelayer", name: "a", opacity: 0.5, data: [1, 0, 0, 0] },
                            { type: "tilelayer", name: "hidden", visible: false, data: [1, 0, 0, 0] },
                            { type: "imagelayer", name: "bg" },
                        ],
                    },
                ],
            }),
        );
        expect(map.layers).toHaveLength(1);
        expect(map.layers[0].name).toBe("a");
        expect(map.layers[0].opacity).toBe(0.25);
        expect(map.warnings.some((w) => w.includes("image layers"))).toBe(true);
    });
});

describe("parseTiledMap — external tilesets", () => {
    it("resolves external tilesets through the hook", async () => {
        const { firstgid: _fg, ...external } = TILESET;
        const map = await parseTiledMap(
            baseMap({
                tilesets: [{ firstgid: 1, source: "terrain.tsj" }],
                layers: [{ type: "tilelayer", name: "t", data: [1, 0, 0, 0] }],
            }),
            { resolveTileset: async (source) => (source === "terrain.tsj" ? external : null) },
        );
        expect(map.tilesets[0].name).toBe("terrain");
    });

    it("throws when external tilesets are present but no resolver is given", async () => {
        const map = baseMap({ tilesets: [{ firstgid: 1, source: "terrain.tsj" }] });
        await expect(parseTiledMap(map)).rejects.toThrow(/resolveTileset/);
    });
});

describe("parseTiledMap — objects", () => {
    it("converts rects to item-space corner points", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "zones",
                        objects: [
                            {
                                id: 7,
                                name: "spawn",
                                class: "zone",
                                x: 16,
                                y: 16,
                                width: 16,
                                height: 16,
                                properties: [{ name: "team", value: "red" }],
                            },
                        ],
                    },
                ],
            }),
        );
        const layer = map.layers[0] as TiledObjectLayerData;
        const obj = layer.objects[0];
        expect(obj.data).toEqual({ id: 7, name: "spawn", type: "zone", properties: { team: "red" } });
        expect(obj.shape.kind).toBe("rect");
        if (obj.shape.kind === "rect") {
            // px rect (16,16)-(32,32) = exactly cell (1,1): corners at half-integers
            expect(obj.shape.points).toEqual([
                { x: 0.5, y: 0.5 },
                { x: 1.5, y: 0.5 },
                { x: 1.5, y: 1.5 },
                { x: 0.5, y: 1.5 },
            ]);
        }
    });

    it("converts points, ellipses, and polygons", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        objects: [
                            { id: 1, x: 24, y: 24, point: true },
                            { id: 2, x: 8, y: 8, width: 16, height: 16, ellipse: true },
                            {
                                id: 3,
                                x: 8,
                                y: 8,
                                polygon: [
                                    { x: 0, y: 0 },
                                    { x: 16, y: 0 },
                                    { x: 16, y: 16 },
                                ],
                            },
                        ],
                    },
                ],
            }),
        );
        const layer = map.layers[0] as TiledObjectLayerData;
        expect(layer.objects[0].shape).toEqual({ kind: "point", at: { x: 1, y: 1 } });
        expect(layer.objects[1].shape).toEqual({
            kind: "ellipse",
            center: { x: 0.5, y: 0.5 },
            radiusX: 0.5,
            radiusY: 0.5,
        });
        expect(layer.objects[2].shape).toMatchObject({
            kind: "polygon",
            points: [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 1, y: 1 },
            ],
        });
    });

    it("anchors tile objects at their bottom-left corner", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        // Tile object placed at px (16, 32): bottom-left anchor
                        // means it occupies cell (1, 1) -> center (1, 1).
                        objects: [{ id: 4, x: 16, y: 32, width: 16, height: 16, gid: 2 }],
                    },
                ],
            }),
        );
        const layer = map.layers[0] as TiledObjectLayerData;
        const shape = layer.objects[0].shape;
        expect(shape.kind).toBe("tile");
        if (shape.kind === "tile") {
            expect(shape.center).toEqual({ x: 1, y: 1 });
            expect(shape.size).toBe(1);
            expect(shape.sprite).toEqual({ x: 16, y: 0, w: 16, h: 16 });
        }
    });

    it("rotates rect corners around the top-left anchor", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        objects: [{ id: 5, x: 16, y: 16, width: 16, height: 16, rotation: 90 }],
                    },
                ],
            }),
        );
        const layer = map.layers[0] as TiledObjectLayerData;
        const shape = layer.objects[0].shape;
        if (shape.kind === "rect") {
            // 90° CW around px (16,16): rect swings to the left of the anchor.
            expect(shape.points[0].x).toBeCloseTo(0.5);
            expect(shape.points[0].y).toBeCloseTo(0.5);
            expect(shape.points[1].x).toBeCloseTo(0.5);
            expect(shape.points[1].y).toBeCloseTo(1.5);
            expect(shape.points[2].x).toBeCloseTo(-0.5);
            expect(shape.points[2].y).toBeCloseTo(1.5);
        } else {
            throw new Error("expected rect shape");
        }
    });

    it("skips invisible and text objects (text with a warning)", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        objects: [
                            { id: 1, x: 0, y: 0, visible: false },
                            { id: 2, x: 0, y: 0, text: { text: "hi" } },
                        ],
                    },
                ],
            }),
        );
        expect((map.layers[0] as TiledObjectLayerData).objects).toHaveLength(0);
        expect(map.warnings.some((w) => w.includes("text objects"))).toBe(true);
    });

    it("warns on object-layer opacity", async () => {
        const map = await parseTiledMap(
            baseMap({ layers: [{ type: "objectgroup", name: "o", opacity: 0.5, objects: [] }] }),
        );
        expect(map.warnings.some((w) => w.includes("object-layer opacity"))).toBe(true);
    });
});
