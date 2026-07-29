import { describe, expect, it } from "vitest";
import { parseTiledMap, tiledMapBounds } from "../src/parse";
import { GID_FLIP_H } from "../src/gid";
import type { TmjMap, TmjText, TiledTileLayerData, TiledObjectLayerData } from "../src/types";

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

    it("rejects tilesets with no usable columns value", async () => {
        const map = baseMap({ tilesets: [{ ...TILESET, columns: 0 }] });
        await expect(parseTiledMap(map)).rejects.toThrow(/columns/);
    });
});

describe("parseTiledMap — tiles larger than the grid", () => {
    // 32x32 tiles on a 16px grid: Tiled anchors a tile at the BOTTOM-left of
    // its cell, so an oversized tile grows up and to the right.
    const big = { ...TILESET, tilewidth: 32, tileheight: 32, columns: 2 };

    it("boxes an oversized tile and centers it on the bottom-left anchor", async () => {
        const map = await parseTiledMap(
            baseMap({ tilesets: [big], layers: [{ type: "tilelayer", name: "t", data: [1, 0, 0, 0] }] }),
        );
        const cell = (map.layers[0] as TiledTileLayerData).cells[0];
        // cell (0,0): px rect (0,-16)-(32,16), center px (16, 0)
        expect(cell).toMatchObject({ x: 0.5, y: -0.5, size: 2 });
        expect(cell.sprite).toEqual({ x: 0, y: 0, w: 32, h: 32 });
    });

    it("keeps a non-square tile's aspect inside the larger box", async () => {
        const tall = { ...TILESET, tilewidth: 32, tileheight: 48, columns: 2 };
        const map = await parseTiledMap(
            baseMap({ tilesets: [tall], layers: [{ type: "tilelayer", name: "t", data: [1, 0, 0, 0] }] }),
        );
        const cell = (map.layers[0] as TiledTileLayerData).cells[0];
        // center px (0 + 16, 16 - 24) = (16, -8); box takes the larger side
        expect(cell).toMatchObject({ x: 0.5, y: -1, size: 3 });
        expect(cell.sprite).toEqual({ x: 0, y: 0, w: 32, h: 48 });
    });

    it("steps the atlas by each axis separately with margin and spacing", async () => {
        const tall = { ...TILESET, tilewidth: 32, tileheight: 48, columns: 2, margin: 2, spacing: 1 };
        const map = await parseTiledMap(
            baseMap({ tilesets: [tall], layers: [{ type: "tilelayer", name: "t", data: [4, 0, 0, 0] }] }),
        );
        // local 3 -> col 1, row 1
        expect((map.layers[0] as TiledTileLayerData).cells[0].sprite).toEqual({
            x: 2 + 33,
            y: 2 + 49,
            w: 32,
            h: 48,
        });
    });

    it("applies the tileset tileoffset to placed tiles", async () => {
        const map = await parseTiledMap(
            baseMap({
                tilesets: [{ ...TILESET, tileoffset: { x: -8, y: 16 } }],
                layers: [{ type: "tilelayer", name: "t", data: [1, 0, 0, 0] }],
            }),
        );
        // grid-sized tile at cell (0,0) is normally (0,0); the offset shifts it
        // by (-8, 16) px = (-0.5, 1) world units.
        expect((map.layers[0] as TiledTileLayerData).cells[0]).toMatchObject({ x: -0.5, y: 1, size: 1 });
    });

    it("warns and keeps the transparentcolor image as-is", async () => {
        const map = await parseTiledMap(baseMap({ tilesets: [{ ...TILESET, transparentcolor: "#ff00ff" }] }));
        expect(map.warnings.some((w) => w.includes("transparentcolor"))).toBe(true);
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

describe("parseTiledMap — text objects", () => {
    const textObject = (text: TmjText) =>
        baseMap({
            layers: [
                {
                    type: "objectgroup",
                    name: "labels",
                    // 32x16px box starting at px (16, 16) = cells (1,1)-(2,2).
                    objects: [{ id: 9, name: "sign", x: 16, y: 16, width: 32, height: 16, text }],
                },
            ],
        });

    it("resolves the box and alignment into a single anchor", async () => {
        const map = await parseTiledMap(textObject({ text: "Town", pixelsize: 8, color: "#ff0000" }));
        const shape = (map.layers[0] as TiledObjectLayerData).objects[0].shape;
        expect(shape).toEqual({
            kind: "text",
            // left/top default: the anchor is the box's top-left corner
            at: { x: 0.5, y: 0.5 },
            text: "Town",
            size: 0.5, // 8px on a 16px grid: labels scale with the map
            color: "#ff0000",
            align: "left",
            baseline: "top",
            rotate: 0,
        });
    });

    it("moves the anchor for centered and bottom-right alignment", async () => {
        const centered = await parseTiledMap(textObject({ text: "x", halign: "center", valign: "center" }));
        const bottomRight = await parseTiledMap(textObject({ text: "x", halign: "right", valign: "bottom" }));

        expect((centered.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({
            at: { x: 1.5, y: 1 }, // box center px (32, 24)
            align: "center",
            baseline: "middle",
        });
        expect((bottomRight.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({
            at: { x: 2.5, y: 1.5 }, // box bottom-right px (48, 32)
            align: "right",
            baseline: "bottom",
        });
    });

    it("defaults size, color and alignment the way Tiled does", async () => {
        const map = await parseTiledMap(textObject({ text: "plain" }));
        expect((map.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({
            size: 1, // 16px default on a 16px grid
            color: "#000000",
            align: "left",
            baseline: "top",
        });
        expect(map.warnings).toEqual([]);
    });

    it("keeps the font family only when the map names one", async () => {
        const named = await parseTiledMap(textObject({ text: "x", fontfamily: "Georgia" }));
        const unnamed = await parseTiledMap(textObject({ text: "x" }));
        expect((named.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({ fontFamily: "Georgia" });
        expect((unnamed.layers[0] as TiledObjectLayerData).objects[0].shape).not.toHaveProperty("fontFamily");
    });

    it("warns for typography the renderers cannot express", async () => {
        const map = await parseTiledMap(
            textObject({ text: "x", bold: true, italic: true, underline: true, strikeout: true, wrap: true }),
        );
        const warning = map.warnings.find((w) => w.includes("not supported"))!;
        for (const feature of ["bold", "italic", "underline", "strikeout", "word wrap"]) {
            expect(warning).toContain(feature);
        }
    });

    it("warns that justified text falls back to left-aligned", async () => {
        const map = await parseTiledMap(textObject({ text: "x", halign: "justify" }));
        expect(map.warnings.some((w) => w.includes("justified"))).toBe(true);
        expect((map.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({ align: "left" });
    });

    it("rotates the resolved anchor around the object origin", async () => {
        const map = await parseTiledMap(textObject({ text: "x", halign: "right" }));
        // rotation lives on the object, not the text block
        const rotated = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "labels",
                        objects: [{ id: 9, x: 16, y: 16, width: 32, height: 16, rotation: 90, text: { text: "x" } }],
                    },
                ],
            }),
        );
        expect((map.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({ rotate: 0 });
        // 90° CW around px (16,16) keeps the top-left anchor in place
        expect((rotated.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({
            at: { x: 0.5, y: 0.5 },
            rotate: 90,
        });
    });
});

describe("parseTiledMap — layer offsets", () => {
    it("shifts tile cells by the layer offset without the half-cell coordinate shift", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [{ type: "tilelayer", name: "t", data: [1, 0, 0, 0], offsetx: 8, offsety: -16 }],
            }),
        );
        // Cell (0,0) is normally (0,0); +8px = +0.5, -16px = -1 world units.
        expect((map.layers[0] as TiledTileLayerData).cells[0]).toMatchObject({ x: 0.5, y: -1 });
    });

    it("accumulates group offsets down the tree, like opacity", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "group",
                        name: "g",
                        offsetx: 16,
                        layers: [{ type: "tilelayer", name: "t", data: [1, 0, 0, 0], offsetx: 8 }],
                    },
                ],
            }),
        );
        expect((map.layers[0] as TiledTileLayerData).cells[0]).toMatchObject({ x: 1.5, y: 0 });
    });

    it("shifts object geometry of every kind", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        offsetx: 16,
                        offsety: 16,
                        objects: [
                            { id: 1, x: 0, y: 0, width: 16, height: 16 },
                            { id: 2, x: 24, y: 24, point: true },
                            { id: 3, x: 8, y: 8, width: 16, height: 16, ellipse: true },
                            { id: 4, x: 16, y: 32, width: 16, height: 16, gid: 2 },
                        ],
                    },
                ],
            }),
        );
        const objects = (map.layers[0] as TiledObjectLayerData).objects;
        expect(objects[0].shape).toMatchObject({
            points: [
                { x: 0.5, y: 0.5 },
                { x: 1.5, y: 0.5 },
                { x: 1.5, y: 1.5 },
                { x: 0.5, y: 1.5 },
            ],
        });
        expect(objects[1].shape).toMatchObject({ at: { x: 2, y: 2 } });
        expect(objects[2].shape).toMatchObject({ center: { x: 1.5, y: 1.5 } });
        expect(objects[3].shape).toMatchObject({ center: { x: 2, y: 2 } });
    });

    it("warns on parallax factors it cannot honor", async () => {
        const map = await parseTiledMap(
            baseMap({ layers: [{ type: "tilelayer", name: "t", data: [0, 0, 0, 0], parallaxx: 0.5 }] }),
        );
        expect(map.warnings.some((w) => w.includes("parallax"))).toBe(true);
    });
});

describe("tiledMapBounds", () => {
    it("returns the raw corner-space extents of the map (cell k spans [k, k+1])", async () => {
        const map = await parseTiledMap(baseMap({ width: 40, height: 24, layers: [] }));
        expect(tiledMapBounds(map)).toEqual({ minX: 0, minY: 0, maxX: 40, maxY: 24 });
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

    it("honors the tileset objectalignment for tile objects", async () => {
        const objectsAt = (alignment: string) =>
            parseTiledMap(
                baseMap({
                    tilesets: [{ ...TILESET, objectalignment: alignment }],
                    layers: [
                        {
                            type: "objectgroup",
                            name: "o",
                            objects: [{ id: 4, x: 16, y: 32, width: 16, height: 16, gid: 2 }],
                        },
                    ],
                }),
            );

        // Same object, three anchors: the tile hangs below, above, or centered
        // on px (16, 32) = the corner between cells (0,1) and (1,2).
        const bottomLeft = (await objectsAt("bottomleft")).layers[0] as TiledObjectLayerData;
        const topLeft = (await objectsAt("topleft")).layers[0] as TiledObjectLayerData;
        const center = (await objectsAt("center")).layers[0] as TiledObjectLayerData;

        expect(bottomLeft.objects[0].shape).toMatchObject({ center: { x: 1, y: 1 } });
        expect(topLeft.objects[0].shape).toMatchObject({ center: { x: 1, y: 2 } });
        expect(center.objects[0].shape).toMatchObject({ center: { x: 0.5, y: 1.5 } });
    });

    it("defaults to bottom-left when objectalignment is unspecified or unknown", async () => {
        const map = await parseTiledMap(
            baseMap({
                tilesets: [{ ...TILESET, objectalignment: "sideways" }],
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        objects: [{ id: 4, x: 16, y: 32, width: 16, height: 16, gid: 2 }],
                    },
                ],
            }),
        );
        expect((map.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({ center: { x: 1, y: 1 } });
        expect(map.warnings.some((w) => w.includes("objectalignment"))).toBe(true);
    });

    it("warns when a tile object is scaled to a different aspect than its tile", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        // 16x16 tile forced into a 32x16 box: the renderers
                        // aspect-fit, so it cannot be stretched.
                        objects: [{ id: 4, x: 0, y: 32, width: 32, height: 16, gid: 2 }],
                    },
                ],
            }),
        );
        expect(map.warnings.some((w) => w.includes("different aspect"))).toBe(true);
        // Uniform scaling stays silent and doubles the box.
        const uniform = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        objects: [{ id: 4, x: 0, y: 32, width: 32, height: 32, gid: 2 }],
                    },
                ],
            }),
        );
        expect(uniform.warnings).toEqual([]);
        expect((uniform.layers[0] as TiledObjectLayerData).objects[0].shape).toMatchObject({ size: 2 });
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

    it("skips invisible objects", async () => {
        const map = await parseTiledMap(
            baseMap({
                layers: [{ type: "objectgroup", name: "o", objects: [{ id: 1, x: 0, y: 0, visible: false }] }],
            }),
        );
        expect((map.layers[0] as TiledObjectLayerData).objects).toHaveLength(0);
    });

    it("warns about object-layer opacity only when a shape cannot honor it", async () => {
        const withShape = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        opacity: 0.5,
                        objects: [{ id: 1, x: 0, y: 0, width: 16, height: 16 }],
                    },
                ],
            }),
        );
        expect(withShape.warnings.some((w) => w.includes("object-layer opacity"))).toBe(true);

        // Tile objects are images, so they take the opacity: nothing to warn about.
        const tilesOnly = await parseTiledMap(
            baseMap({
                layers: [
                    {
                        type: "objectgroup",
                        name: "o",
                        opacity: 0.5,
                        objects: [{ id: 1, x: 16, y: 32, width: 16, height: 16, gid: 2 }],
                    },
                ],
            }),
        );
        expect(tilesOnly.warnings).toEqual([]);
    });
});
