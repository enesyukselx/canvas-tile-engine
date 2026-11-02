import { describe, expect, it, vi } from "vitest";
import {
    createSceneDocument,
    parseSceneDocument,
    prepareScene,
    SceneAttachmentError,
    SceneValidationError,
    stringifySceneDocument,
    validateSceneDocument,
    type SceneDocument,
    type SceneDocumentInput,
    type SceneJsonObject,
    type SceneTarget,
} from "../../src/modules/scene";
import type { DrawHandle } from "../../src/types";

function fixture(): SceneDocument {
    return createSceneDocument({
        assets: [{ id: "icons", src: "./icons.png", metadata: { license: "app" } }, { id: "unused" }],
        camera: { center: { x: -2.5, y: 7 }, scale: 20 },
        metadata: { title: "Board", values: [1, true, null] },
        layers: [
            {
                id: "main",
                order: 3,
                metadata: { locked: false },
                batches: [
                    {
                        id: "rects",
                        kind: "rect",
                        clip: { minX: -5, minY: -5, maxX: 10, maxY: 10 },
                        items: [
                            {
                                id: "rect-a",
                                x: 1,
                                y: 2,
                                width: 3,
                                height: 4,
                                size: 2,
                                sizePx: 30,
                                widthPx: 45,
                                origin: { mode: "self", x: -2, y: 3 },
                                rotate: 25,
                                radius: [1, 2, 3, 4],
                                style: {
                                    fillStyle: {
                                        type: "linear",
                                        from: { x: 0, y: 0 },
                                        to: { x: 1, y: 1 },
                                        units: "world",
                                        stops: [
                                            { offset: 1, color: "#fff" },
                                            { offset: 0, color: "#000" },
                                            { offset: 0, color: "red" },
                                        ],
                                    },
                                    lineWidth: 0.2,
                                    lineWidthPx: 3,
                                    lineDash: [1, 2],
                                    lineDashPx: [4, 5],
                                },
                                data: { selected: false },
                            },
                        ],
                    },
                    {
                        id: "circles",
                        kind: "circle",
                        items: [{ id: "circle-a", x: 2, y: 3, size: 2, sizePx: 25, style: { strokeStyle: "blue" } }],
                    },
                    {
                        id: "lines",
                        kind: "line",
                        style: { strokeStyle: "red", lineWidthPx: 3 },
                        items: [
                            {
                                id: "line-a",
                                from: { x: 0, y: 0 },
                                to: { x: 10, y: 10 },
                                style: { lineWidth: 0.5 },
                                data: [1, "two"],
                            },
                        ],
                    },
                    {
                        id: "texts",
                        kind: "text",
                        hitTest: false,
                        items: [
                            {
                                id: "text-a",
                                x: 0,
                                y: 1,
                                text: "Hello",
                                size: 2,
                                fontPx: 14,
                                rotate: -30,
                                style: {
                                    fillStyle: "#000",
                                    fontFamily: "Roboto",
                                    fontWeight: 700,
                                    textAlign: "right",
                                    textBaseline: "alphabetic",
                                },
                            },
                        ],
                    },
                    {
                        id: "images",
                        kind: "image",
                        items: [
                            {
                                id: "image-a",
                                assetId: "icons",
                                x: 5,
                                y: 5,
                                sizePx: 32,
                                sprite: { x: 16, y: 0, w: 16, h: 16 },
                                flipX: true,
                                flipY: false,
                                opacity: 0.5,
                                rotate: 90,
                            },
                        ],
                    },
                    {
                        id: "paths",
                        kind: "path",
                        items: [
                            {
                                id: "path-a",
                                points: [
                                    { x: 0, y: 0 },
                                    { x: 2, y: 2 },
                                    { x: 3, y: 0 },
                                ],
                                closed: true,
                                fillRule: "evenodd",
                                style: { fillStyle: "green", cornerRadiusPx: 3 },
                            },
                            {
                                id: "path-b",
                                commands: [
                                    { type: "moveTo", x: 0, y: 0 },
                                    { type: "lineTo", x: 1, y: 1 },
                                    { type: "quadraticCurveTo", cpx: 2, cpy: 3, x: 4, y: 1 },
                                    { type: "bezierCurveTo", cp1x: 2, cp1y: 2, cp2x: 3, cp2y: 3, x: 5, y: 0 },
                                    { type: "arc", x: 5, y: 1, radius: 1, startAngle: 0, endAngle: 180, ccw: true },
                                    { type: "closePath" },
                                ],
                                style: { strokeStyle: "#123456" },
                            },
                        ],
                    },
                ],
            },
        ],
    });
}

function target() {
    const live = new Map<symbol, { kind: string; items: unknown; layer: number }>();
    const calls: string[] = [];
    const state = {
        scale: 5,
        center: { x: 7, y: 8 },
        failKind: "",
        failCamera: false,
        failRemove: false,
        removeFailures: 0,
    };
    const add = (kind: string, items: unknown, layer = 1) => {
        calls.push(kind);
        if (kind === state.failKind) {
            throw new Error(`cannot register ${kind}`);
        }
        const handle: DrawHandle = { id: Symbol(kind), layer };
        live.set(handle.id, { kind, items, layer });
        return handle;
    };
    const engine = {
        drawRect: vi.fn((items: unknown, layer?: number) => add("rect", items, layer)),
        drawCircle: vi.fn((items: unknown, layer?: number) => add("circle", items, layer)),
        drawLine: vi.fn((items: unknown, _style: unknown, layer?: number) => add("line", items, layer)),
        drawText: vi.fn((items: unknown, layer?: number) => add("text", items, layer)),
        drawImage: vi.fn((items: unknown, layer?: number) => add("image", items, layer)),
        drawPath: vi.fn((items: unknown, layer?: number) => add("path", items, layer)),
        removeDrawHandle: vi.fn((handle: DrawHandle) => {
            if (state.failRemove || state.removeFailures-- > 0) {
                throw new Error("cannot remove");
            }
            live.delete(handle.id);
        }),
        requestRender: vi.fn(),
        getScale: () => state.scale,
        getCenter: () => ({ ...state.center }),
        setScale: vi.fn((scale: number) => {
            state.scale = scale;
            if (state.failCamera) {
                throw new Error("camera observer");
            }
        }),
        setCenter: vi.fn((center: { x: number; y: number }) => {
            state.center = { ...center };
        }),
    };
    return { engine: engine as unknown as SceneTarget<{ asset: string }>, spies: engine, state, live, calls };
}

const resolveImage = (asset: { id: string }) => ({ asset: asset.id });

describe("scene document codecs", () => {
    it("round-trips every primitive, units, authored ordering and JSON metadata", () => {
        const document = fixture();
        const json = stringifySceneDocument(document);
        expect(parseSceneDocument(json)).toEqual(document);
        expect(stringifySceneDocument(parseSceneDocument(json))).toBe(json);
        expect(json).not.toContain('"img"');
        const reversedKeys = {
            metadata: document.metadata,
            camera: document.camera,
            layers: document.layers,
            assets: document.assets,
            schemaVersion: 1,
        };
        expect(stringifySceneDocument(reversedKeys as SceneDocument)).toBe(json);
    });

    it("creates empty versioned documents and never retains caller data aliases", () => {
        expect(createSceneDocument()).toEqual({ schemaVersion: 1, assets: [], layers: [] });
        const metadata = { nested: { title: "original" } };
        const document = createSceneDocument({ metadata });
        metadata.nested.title = "changed";
        expect(document.metadata).toEqual({ nested: { title: "original" } });
    });

    it.each([
        { value: { schemaVersion: 2, assets: [], layers: [] }, message: "unsupported schema" },
        { value: { schemaVersion: 0, assets: [], layers: [] }, message: "no migration" },
        { value: { schemaVersion: 1.5, assets: [], layers: [] }, message: "unsupported schema" },
        { value: { assets: [], layers: [] }, message: "schemaVersion" },
    ])("rejects unsupported version envelopes %#", ({ value, message }) => {
        expect(() => validateSceneDocument(value)).toThrow(message);
    });

    it("migrates only explicitly registered prior formats and validates the result", () => {
        const input = { schemaVersion: 0, title: "Old" };
        const migration = vi.fn((old: SceneJsonObject) => {
            old.title = "Migrated";
            return { schemaVersion: 1, assets: [], layers: [], metadata: { title: old.title } };
        });
        const document = parseSceneDocument(JSON.stringify(input), { migrations: new Map([[0, migration]]) });
        expect(document.metadata).toEqual({ title: "Migrated" });
        expect(input.title).toBe("Old");
        expect(migration).toHaveBeenCalledTimes(1);
        expect(() => validateSceneDocument(input, { migrations: new Map([[0, () => input]]) })).toThrow(
            "must produce version 1",
        );
        expect(() =>
            validateSceneDocument(input, {
                migrations: new Map([[0, () => ({ schemaVersion: 1, assets: [], layers: null })]]),
            }),
        ).toThrow("$.layers");
    });

    it.each([NaN, Infinity, -Infinity, undefined, () => 1, Symbol("x"), 1n, new Date()])(
        "rejects non-JSON metadata %#",
        (metadata) => {
            expect(() => createSceneDocument({ metadata } as unknown as SceneDocumentInput)).toThrow(
                SceneValidationError,
            );
        },
    );

    it("rejects cycles, sparse arrays and dangerous/accessor properties without invoking getters", () => {
        const cyclic: Record<string, unknown> = {};
        cyclic.self = cyclic;
        expect(() => createSceneDocument({ metadata: cyclic } as SceneDocumentInput)).toThrow("cyclic");
        expect(() => createSceneDocument({ metadata: Array(2) })).toThrow("sparse");
        expect(() =>
            parseSceneDocument(
                '{"schemaVersion":1,"assets":[],"layers":[],"metadata":{"__proto__":{"polluted":true}}}',
            ),
        ).toThrow("reserved");
        const getter = vi.fn(() => "hidden");
        const metadata = Object.defineProperty({}, "title", { get: getter, enumerable: true });
        expect(() => createSceneDocument({ metadata })).toThrow("accessor");
        expect(getter).not.toHaveBeenCalled();
        expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
    });

    it("applies bounded traversal and source limits", () => {
        expect(() => createSceneDocument({ metadata: { a: { b: true } } }, { limits: { maxDepth: 2 } })).toThrow(
            "maxDepth",
        );
        expect(() => createSceneDocument({ metadata: [1, 2, 3, 4] }, { limits: { maxNodes: 4 } })).toThrow("maxNodes");
        expect(() => createSceneDocument({ metadata: "1234" }, { limits: { maxStringLength: 3 } })).toThrow(
            "maxStringLength",
        );
        expect(() => parseSceneDocument("{}", { limits: { maxSourceLength: 1 } })).toThrow("maxSourceLength");
        expect(() => parseSceneDocument("{")).toThrow("invalid JSON");
        expect(() => stringifySceneDocument(createSceneDocument(), -1)).toThrow("space");
    });

    it.each([
        (doc: SceneDocument) => {
            doc.assets.push({ ...doc.assets[0] });
        },
        (doc: SceneDocument) => {
            doc.layers.push({ id: "main", order: 4, batches: [] });
        },
        (doc: SceneDocument) => {
            doc.layers.push({ id: "other", order: 3, batches: [] });
        },
        (doc: SceneDocument) => {
            doc.layers[0].batches[1].id = "rects";
        },
        (doc: SceneDocument) => {
            doc.layers[0].batches[1].items[0].id = "rect-a";
        },
    ])("rejects ambiguous identity or layer order %#", (change) => {
        const document = fixture();
        change(document);
        expect(() => validateSceneDocument(document)).toThrow(SceneValidationError);
    });

    it.each([
        { kind: "rect", item: { id: "x", x: 0, y: 0, width: -1 } },
        { kind: "circle", item: { id: "x", x: 0, y: 0, rotate: 1 } },
        { kind: "text", item: { id: "x", x: 0, y: 0, text: "x", fontPx: 0 } },
        { kind: "image", item: { id: "x", x: 0, y: 0, assetId: "missing" } },
        { kind: "image", item: { id: "x", x: 0, y: 0, assetId: "icons", opacity: 2 } },
        { kind: "line", item: { id: "x", from: { x: 0 }, to: { x: 1, y: 1 } } },
        { kind: "path", item: { id: "x", points: [], commands: [] } },
        {
            kind: "path",
            item: { id: "x", commands: [{ type: "arc", x: 0, y: 0, radius: -1, startAngle: 0, endAngle: 90 }] },
        },
        { kind: "path", item: { id: "x", commands: [{ type: "script", code: "run" }] } },
    ])("rejects malformed primitive %#", ({ kind, item }) => {
        expect(() =>
            validateSceneDocument({
                schemaVersion: 1,
                assets: [{ id: "icons" }],
                layers: [{ id: "layer", order: 1, batches: [{ id: "batch", kind, items: [item] }] }],
            }),
        ).toThrow(SceneValidationError);
    });

    it("rejects persisted draw callbacks and opaque image handles", () => {
        const document = fixture();
        (document.layers[0].batches[0] as unknown as { styleOf: () => object }).styleOf = () => ({});
        expect(() => validateSceneDocument(document)).toThrow("JSON value");
        const other = fixture();
        Object.assign(other.layers[0].batches[4].items[0], { img: {} });
        expect(() => validateSceneDocument(other)).toThrow("unknown field");
    });
});

describe("prepared scene collections", () => {
    it("resolves every asset once and captures live keyed edits without handles or aliases", async () => {
        const document = fixture();
        const resolver = vi.fn(resolveImage);
        const scene = await prepareScene(document, { resolveImage: resolver });
        expect(resolver.mock.calls.map(([asset]) => asset.id)).toEqual(["icons", "unused"]);
        const rects = scene.getCollection("rects", "rect");
        rects.update("rect-a", { x: 42, data: { title: "edited" } });
        const images = scene.getCollection("images", "image");
        images.update("image-a", { assetId: "unused", img: scene.getImage("unused") });
        const captured = scene.capture({ center: { x: 1, y: 2 }, scale: 3 });
        expect(captured.layers[0].batches[0].items[0]).toMatchObject({ id: "rect-a", x: 42 });
        expect(captured.layers[0].batches[4].items[0]).toMatchObject({ id: "image-a", assetId: "unused" });
        expect(captured.layers[0].batches[4].items[0]).not.toHaveProperty("img");
        expect(captured.camera).toEqual({ center: { x: 1, y: 2 }, scale: 3 });
        (captured.layers[0].batches[0].items[0].data as SceneJsonObject).title = "outside";
        expect(rects.get("rect-a")!.data).toEqual({ title: "edited" });
        expect(document.layers[0].batches[0].items[0]).toMatchObject({ x: 1 });
        expect(scene.capture().camera).toEqual(document.camera);
        expect(() => scene.getCollection("rects", "circle")).toThrow("not a circle");
        expect(() => scene.getImage("missing")).toThrow("Unknown scene asset");
    });

    it("prepares detached data even when a resolver edits its argument or source", async () => {
        const document = fixture();
        const scene = await prepareScene(document, {
            resolveImage: async (asset) => {
                if (asset.metadata) {
                    (asset.metadata as SceneJsonObject).license = "changed";
                }
                document.layers[0].batches[0].items[0].id = "source-mutation";
                return resolveImage(asset);
            },
        });
        expect(scene.capture().assets[0].metadata).toEqual({ license: "app" });
        expect(scene.getCollection("rects", "rect").get("rect-a")).toBeDefined();
    });

    it("rejects invalid documents before calling resolvers and requires explicit image resolution", async () => {
        const document = fixture();
        document.layers[0].batches[0].items[0].id = "circle-a";
        const resolver = vi.fn(resolveImage);
        await expect(prepareScene(document, { resolveImage: resolver })).rejects.toThrow("duplicate ID");
        expect(resolver).not.toHaveBeenCalled();
        await expect(prepareScene(fixture())).rejects.toThrow("requires resolveImage");
        await expect(prepareScene(fixture(), { resolveImage: () => undefined })).rejects.toThrow("no handle");
        await expect(
            prepareScene(fixture(), { resolveImage: () => Promise.reject(new Error("asset unavailable")) }),
        ).rejects.toThrow("asset unavailable");
    });

    it("refuses stale asset references, invalid edits and duplicate IDs before attachment", async () => {
        const scene = await prepareScene(fixture(), { resolveImage });
        const { engine, calls } = target();
        scene.getCollection("images", "image").update("image-a", { assetId: "unused" });
        expect(() => scene.capture()).toThrow("must match");
        expect(() => scene.attach(engine)).toThrow("must match");
        expect(calls).toEqual([]);
        scene.getCollection("images", "image").update("image-a", { img: scene.getImage("unused") });
        scene.getCollection("rects", "rect").insert({ id: "circle-a", x: 1, y: 2 });
        expect(() => scene.attach(engine)).toThrow("duplicate ID");
        expect(calls).toEqual([]);
    });
});

describe("scene attachment ownership", () => {
    it("keeps ordered mixed batches and their live collections without global draw IDs", async () => {
        const document = createSceneDocument({
            layers: [
                {
                    id: "layer",
                    order: 2,
                    batches: [
                        { id: "back", kind: "rect", items: [{ id: "a", x: 0, y: 0 }] },
                        { id: "middle", kind: "circle", items: [{ id: "b", x: 0, y: 0 }] },
                        { id: "front", kind: "rect", items: [{ id: "c", x: 0, y: 0 }] },
                    ],
                },
            ],
        });
        const scene = await prepareScene<{ asset: string }>(document);
        const { engine, spies, calls, live } = target();
        const attachment = scene.attach(engine);
        expect(calls).toEqual(["rect", "circle", "rect"]);
        expect(spies.drawRect.mock.calls[0][0]).toBe(scene.getCollection("back", "rect"));
        scene.getCollection("back", "rect").update("a", { x: 10 });
        expect(calls).toHaveLength(3);
        expect(live.size).toBe(3);
        expect(attachment.handles).toHaveLength(3);
        expect(spies.setScale).not.toHaveBeenCalled();
        attachment.dispose();
        attachment.dispose();
        expect(live.size).toBe(0);
        expect(spies.removeDrawHandle).toHaveBeenCalledTimes(3);
        expect(attachment.active).toBe(false);
    });

    it("replaces only the prior attachment and rolls back staging on registration failure", async () => {
        const scene = await prepareScene(fixture(), { resolveImage });
        const { engine, state, live } = target();
        const unrelated = engine.drawRect({ x: 100, y: 100 });
        const old = scene.attach(engine);
        const before = [...live.keys()];
        state.failKind = "line";
        expect(() => scene.attach(engine, { replace: old })).toThrow("cannot register line");
        expect([...live.keys()]).toEqual(before);
        expect(old.active).toBe(true);
        state.failKind = "";
        const replacement = scene.attach(engine, { replace: old });
        expect(old.active).toBe(false);
        expect(live.size).toBe(7);
        expect(live.has(unrelated.id)).toBe(true);
        replacement.dispose();
        expect([...live.keys()]).toEqual([unrelated.id]);
    });

    it("leaves attachments untouched when resource preparation fails", async () => {
        const { engine, calls, live } = target();
        const old = (await prepareScene(fixture(), { resolveImage })).attach(engine);
        const before = [...live.keys()];
        await expect(
            prepareScene(fixture(), { resolveImage: () => Promise.reject(new Error("offline")) }),
        ).rejects.toThrow("offline");
        expect([...live.keys()]).toEqual(before);
        expect(calls).toHaveLength(6);
        expect(old.active).toBe(true);
    });

    it("restores camera only when asked and attempts rollback after observer errors", async () => {
        const scene = await prepareScene(fixture(), { resolveImage });
        const { engine, state, live } = target();
        const old = scene.attach(engine);
        const before = [...live.keys()];
        state.failCamera = true;
        expect(() => scene.attach(engine, { replace: old, restoreCamera: true })).toThrow(AggregateError);
        expect(state.scale).toBe(5);
        expect(state.center).toEqual({ x: 7, y: 8 });
        expect([...live.keys()]).toEqual(before);
        expect(old.active).toBe(true);
        state.failCamera = false;
        scene.attach(engine, { replace: old, restoreCamera: true });
        expect(state.scale).toBe(20);
        expect(state.center).toEqual({ x: -2.5, y: 7 });
    });

    it("rejects invalid camera snapshots and cross-engine replacement before mutation", async () => {
        const document = fixture();
        document.camera!.scale = NaN;
        await expect(prepareScene(document, { resolveImage })).rejects.toThrow(SceneValidationError);
        const scene = await prepareScene(fixture(), { resolveImage });
        const first = target();
        const second = target();
        const attachment = scene.attach(first.engine);
        expect(() => scene.attach(second.engine, { replace: attachment })).toThrow("active attachment on this engine");
        expect(second.calls).toEqual([]);
    });

    it("exposes new ownership if previous cleanup fails after commit", async () => {
        const scene = await prepareScene(fixture(), { resolveImage });
        const { engine, state, live } = target();
        const old = scene.attach(engine);
        state.failRemove = true;
        let failure: unknown;
        try {
            scene.attach(engine, { replace: old });
        } catch (error) {
            failure = error;
        }
        expect(failure).toBeInstanceOf(SceneAttachmentError);
        expect((failure as SceneAttachmentError).attachment.active).toBe(true);
        expect((failure as SceneAttachmentError).committed).toBe(true);
        expect(old.active).toBe(true);
        state.failRemove = false;
        old.dispose();
        (failure as SceneAttachmentError).attachment.dispose();
        expect(live.size).toBe(0);
    });

    it("retries only failed removals and releases successfully removed handles", async () => {
        const scene = await prepareScene(fixture(), { resolveImage });
        const { engine, state, spies, live } = target();
        const attachment = scene.attach(engine);
        const first = attachment.handles[0];
        state.removeFailures = 1;
        expect(() => attachment.dispose()).toThrow(AggregateError);
        expect(attachment.active).toBe(true);
        expect(attachment.handles).toEqual([first]);
        expect([...live.keys()]).toEqual([first.id]);
        expect(spies.removeDrawHandle).toHaveBeenCalledTimes(6);
        attachment.dispose();
        expect(spies.removeDrawHandle).toHaveBeenCalledTimes(7);
        expect(attachment.active).toBe(false);
        expect(attachment.handles).toEqual([]);
        expect(live.size).toBe(0);
    });

    it("keeps failed staging cleanup recoverable without losing the previous attachment", async () => {
        const scene = await prepareScene(fixture(), { resolveImage });
        const { engine, state, live } = target();
        const old = scene.attach(engine);
        state.failKind = "line";
        state.removeFailures = 1;
        let failure: unknown;
        try {
            scene.attach(engine, { replace: old });
        } catch (error) {
            failure = error;
        }
        expect(failure).toBeInstanceOf(SceneAttachmentError);
        const cleanup = failure as SceneAttachmentError;
        expect(cleanup.committed).toBe(false);
        expect(cleanup.attachment.handles).toHaveLength(1);
        expect(old.active).toBe(true);
        cleanup.attachment.dispose();
        expect(live.size).toBe(6);
        old.dispose();
        expect(live.size).toBe(0);
    });
});
