import { describe, expect, it, vi } from "vitest";
import { CanvasTileEngine } from "@canvas-tile-engine/core";
import type { IRenderer } from "@canvas-tile-engine/core";
import { parseTiledMap } from "../src/parse";
import { mountTiledMap } from "../src/mount";
import type { TmjMap } from "../src/types";

type Mount = Record<string, never>;
type FakeImage = { src: string };

function createMockEngine() {
    let seq = 0;
    const handle = (tag: string) => ({ id: Symbol(`${tag}-${seq++}`), layer: 0 });
    const drawAPI = {
        drawImage: vi.fn((_items: unknown, layer: number = 1, _o?: unknown) => ({ ...handle("img"), layer })),
        drawStaticImage: vi.fn((_items: unknown, _key: string, layer: number = 1) => ({
            ...handle("static"),
            layer,
        })),
        drawPath: vi.fn((_items: unknown, layer: number = 1, _o?: unknown) => ({ ...handle("path"), layer })),
        drawCircle: vi.fn((_items: unknown, layer: number = 1, _o?: unknown) => ({ ...handle("circle"), layer })),
        removeDrawHandle: vi.fn(),
        clearLayer: vi.fn(),
        clearAll: vi.fn(),
        clearStaticCache: vi.fn(),
    };
    const imageLoader = {
        load: vi.fn(async (src: string): Promise<FakeImage> => ({ src })),
        get: vi.fn(),
        has: vi.fn(() => false),
        clear: vi.fn(),
        onLoad: vi.fn(() => () => {}),
    };
    const renderer = {
        init: vi.fn(),
        setupEvents: vi.fn(),
        render: vi.fn(),
        resize: vi.fn(),
        resizeWithAnimation: vi.fn(),
        destroy: vi.fn(),
        getDrawAPI: vi.fn(() => drawAPI),
        getImageLoader: vi.fn(() => imageLoader),
    } as unknown as IRenderer<Mount, FakeImage>;

    const engine = new CanvasTileEngine<Mount, FakeImage>(
        {},
        { scale: 1, minScale: 0.5, maxScale: 2, size: { width: 800, height: 600 } },
        renderer,
    );
    return { engine, drawAPI, imageLoader, renderer };
}

const MAP: TmjMap = {
    orientation: "orthogonal",
    width: 2,
    height: 2,
    tilewidth: 16,
    tileheight: 16,
    tilesets: [
        {
            firstgid: 1,
            name: "terrain",
            image: "terrain.png",
            tilewidth: 16,
            tileheight: 16,
            columns: 4,
            tilecount: 8,
            tiles: [
                {
                    id: 3,
                    animation: [
                        { tileid: 3, duration: 100 },
                        { tileid: 4, duration: 100 },
                    ],
                },
            ],
        },
    ],
    layers: [
        { type: "tilelayer", name: "ground", data: [1, 2, 4, 0] }, // gid 4 = animated tile
        {
            type: "objectgroup",
            name: "zones",
            objects: [
                { id: 1, name: "spawn", x: 0, y: 0, width: 16, height: 16 },
                { id: 2, x: 24, y: 24, point: true },
            ],
        },
    ],
};

describe("mountTiledMap", () => {
    it("loads tileset images, statics the still cells, dynamics the animated ones", async () => {
        const { engine, drawAPI, imageLoader } = createMockEngine();
        const map = await parseTiledMap(MAP);
        await mountTiledMap(engine, map);

        expect(imageLoader.load).toHaveBeenCalledWith("terrain.png");
        // Two still cells go static on engine layer 0.
        expect(drawAPI.drawStaticImage).toHaveBeenCalledTimes(1);
        const [staticItems, staticKey, staticLayer] = drawAPI.drawStaticImage.mock.calls[0];
        expect(staticItems).toHaveLength(2);
        expect(staticKey).toBe("tiled:0:ground:static");
        expect(staticLayer).toBe(0);
        // The animated cell goes through dynamic drawImage on the same layer.
        const animCall = drawAPI.drawImage.mock.calls.find((c) => (c[0] as unknown[]).length === 1);
        expect(animCall).toBeDefined();
        expect(animCall![1]).toBe(0);
    });

    it("registers object layers as paths and markers on the next engine layer", async () => {
        const { engine, drawAPI } = createMockEngine();
        const map = await parseTiledMap(MAP);
        await mountTiledMap(engine, map, { layerOffset: 5 });

        expect(drawAPI.drawPath.mock.calls[0][1]).toBe(6); // layerOffset + index 1
        expect(drawAPI.drawCircle.mock.calls[0][1]).toBe(6);
        expect(drawAPI.drawStaticImage.mock.calls[0][2]).toBe(5);
    });

    it("resolves image sources through resolveImage", async () => {
        const { engine, imageLoader } = createMockEngine();
        const map = await parseTiledMap(MAP);
        await mountTiledMap(engine, map, { resolveImage: (source) => `/assets/${source}` });
        expect(imageLoader.load).toHaveBeenCalledWith("/assets/terrain.png");
    });

    it("dynamic option routes tile layers through drawImage instead of statics", async () => {
        const { engine, drawAPI } = createMockEngine();
        const map = await parseTiledMap(MAP);
        await mountTiledMap(engine, map, { dynamic: true });
        expect(drawAPI.drawStaticImage).not.toHaveBeenCalled();
    });

    it("destroy removes every handle exactly once", async () => {
        const { engine, drawAPI } = createMockEngine();
        const map = await parseTiledMap(MAP);
        const mounted = await mountTiledMap(engine, map);

        const registered =
            drawAPI.drawStaticImage.mock.calls.length +
            drawAPI.drawImage.mock.calls.length +
            drawAPI.drawPath.mock.calls.length +
            drawAPI.drawCircle.mock.calls.length;

        mounted.destroy();
        mounted.destroy(); // idempotent
        expect(drawAPI.removeDrawHandle).toHaveBeenCalledTimes(registered);
    });

    it("hit-testing a mounted object path returns its TiledObjectData", async () => {
        const { engine } = createMockEngine();
        const map = await parseTiledMap(MAP);
        await mountTiledMap(engine, map);

        // The "spawn" rect covers cell (0,0): corner-space (-0.5..0.5). (At
        // this mock's scale=1 the sizePx marker covers the whole tiny map and
        // out-prioritizes the path, so look the path hit up by kind.)
        const hits = engine.hitTest<{ name: string }>({ x: 0, y: 0 });
        const pathHit = hits.find((h) => h.kind === "path");
        expect(pathHit).toBeDefined();
        expect(pathHit!.item.data!.name).toBe("spawn");
    });
});
