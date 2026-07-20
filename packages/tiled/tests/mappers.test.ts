import { describe, expect, it } from "vitest";
import { parseTiledMap } from "../src/parse";
import { objectLayerToItems, tileLayerToItems } from "../src/mappers";
import type { TiledObjectLayerData, TiledTileLayerData, TmjMap } from "../src/types";

const TILESET = {
    firstgid: 1,
    name: "terrain",
    image: "terrain.png",
    tilewidth: 16,
    tileheight: 16,
    columns: 4,
    tilecount: 8,
};

const IMG = { fake: "image" };

async function parseWith(layers: TmjMap["layers"], tilesets: TmjMap["tilesets"] = [{ ...TILESET }]) {
    const map = await parseTiledMap({
        orientation: "orthogonal",
        width: 2,
        height: 2,
        tilewidth: 16,
        tileheight: 16,
        tilesets,
        layers,
    });
    return { map, images: new Map([[map.tilesets[0], IMG]]) };
}

describe("tileLayerToItems", () => {
    it("produces image items with sprite rects, flips, and layer opacity", async () => {
        const { map, images } = await parseWith([{ type: "tilelayer", name: "t", opacity: 0.5, data: [6, 0, 0, 0] }]);
        const { staticItems, animated } = tileLayerToItems(map.layers[0] as TiledTileLayerData, images);

        expect(animated).toHaveLength(0);
        expect(staticItems).toEqual([{ x: 0, y: 0, img: IMG, sprite: { x: 16, y: 16, w: 16, h: 16 }, opacity: 0.5 }]);
    });

    it("splits animated cells into shared groups seeded with frame 0", async () => {
        const { map, images } = await parseWith(
            [{ type: "tilelayer", name: "t", data: [1, 1, 2, 0] }],
            [
                {
                    ...TILESET,
                    tiles: [
                        {
                            id: 0,
                            animation: [
                                { tileid: 0, duration: 100 },
                                { tileid: 3, duration: 100 },
                            ],
                        },
                    ],
                },
            ],
        );
        const { staticItems, animated } = tileLayerToItems(map.layers[0] as TiledTileLayerData, images);

        expect(staticItems).toHaveLength(1); // the gid-2 cell
        expect(animated).toHaveLength(1); // both gid-1 cells share ONE group
        expect(animated[0].items).toHaveLength(2);
        expect(animated[0].animation.fps).toBe(10);
        // Seeded with the animation's first frame, not the cell's own sprite.
        expect(animated[0].items[0].sprite).toEqual({ x: 0, y: 0, w: 16, h: 16 });
    });

    it("throws when a tileset image is missing", async () => {
        const { map } = await parseWith([{ type: "tilelayer", name: "t", data: [1, 0, 0, 0] }]);
        expect(() => tileLayerToItems(map.layers[0] as TiledTileLayerData, new Map())).toThrow(/no image loaded/);
    });
});

describe("objectLayerToItems", () => {
    it("maps rects to closed paths carrying TiledObjectData", async () => {
        const { map, images } = await parseWith([
            {
                type: "objectgroup",
                name: "zones",
                objects: [{ id: 7, name: "spawn", class: "zone", x: 0, y: 0, width: 16, height: 16 }],
            },
        ]);
        const { paths } = objectLayerToItems(map.layers[0] as TiledObjectLayerData, images);

        expect(paths).toHaveLength(1);
        expect(paths[0].closed).toBe(true);
        expect(paths[0].data).toMatchObject({ id: 7, name: "spawn", type: "zone" });
        expect(paths[0].style).toBeDefined(); // default style applied
    });

    it("maps polylines open, circles to arc commands, points to sizePx markers", async () => {
        const { map, images } = await parseWith([
            {
                type: "objectgroup",
                name: "o",
                objects: [
                    {
                        id: 1,
                        x: 0,
                        y: 0,
                        polyline: [
                            { x: 0, y: 0 },
                            { x: 16, y: 16 },
                        ],
                    },
                    { id: 2, x: 8, y: 8, width: 16, height: 16, ellipse: true },
                    { id: 3, x: 24, y: 24, point: true },
                ],
            },
        ]);
        const { paths, markers } = objectLayerToItems(map.layers[0] as TiledObjectLayerData, images);

        expect(paths[0].closed).toBe(false);
        expect(paths[1].commands).toEqual([{ type: "arc", x: 0.5, y: 0.5, radius: 0.5, startAngle: 0, endAngle: 360 }]);
        expect(markers).toEqual([
            {
                x: 1,
                y: 1,
                sizePx: 8,
                style: { fillStyle: "#3b82f6" },
                data: { id: 3, name: "", type: "", properties: {} },
            },
        ]);
    });

    it("flattens non-circular ellipses to bezier commands", async () => {
        const { map, images } = await parseWith([
            {
                type: "objectgroup",
                name: "o",
                objects: [{ id: 1, x: 0, y: 0, width: 32, height: 16, ellipse: true }],
            },
        ]);
        const { paths } = objectLayerToItems(map.layers[0] as TiledObjectLayerData, images);
        const types = paths[0].commands!.map((c) => c.type);
        expect(types).toEqual([
            "moveTo",
            "bezierCurveTo",
            "bezierCurveTo",
            "bezierCurveTo",
            "bezierCurveTo",
            "closePath",
        ]);
    });

    it("resolves per-object styles through a pathStyle function", async () => {
        const { map, images } = await parseWith([
            {
                type: "objectgroup",
                name: "o",
                objects: [
                    { id: 1, x: 0, y: 0, width: 16, height: 16, class: "water" },
                    { id: 2, x: 16, y: 16, width: 16, height: 16 },
                ],
            },
        ]);
        const { paths } = objectLayerToItems(map.layers[0] as TiledObjectLayerData, images, {
            pathStyle: (data) => (data.type === "water" ? { fillStyle: "#00f" } : undefined),
        });
        expect(paths[0].style).toEqual({ fillStyle: "#00f" });
        expect(paths[1].style).toMatchObject({ strokeStyle: "#3b82f6" }); // fell back to default
    });

    it("maps tile objects to image items", async () => {
        const { map, images } = await parseWith([
            {
                type: "objectgroup",
                name: "o",
                objects: [{ id: 4, name: "tree", x: 16, y: 32, width: 16, height: 16, gid: 2 }],
            },
        ]);
        const { tiles } = objectLayerToItems(map.layers[0] as TiledObjectLayerData, images);
        expect(tiles).toEqual([
            {
                x: 1,
                y: 1,
                size: 1,
                img: IMG,
                sprite: { x: 16, y: 0, w: 16, h: 16 },
                data: { id: 4, name: "tree", type: "", properties: {} },
            },
        ]);
    });
});
