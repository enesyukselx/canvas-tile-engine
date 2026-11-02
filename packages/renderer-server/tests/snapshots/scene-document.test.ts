import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
    createSceneDocument,
    parseSceneDocument,
    prepareScene,
    stringifySceneDocument,
    type PreparedScene,
} from "@canvas-tile-engine/core";
import type { Image } from "@napi-rs/canvas";
import { registerFont, renderToBuffer } from "../../src";
import { expectSamePixels, FIXTURES_DIR, makeTestImage } from "./helpers";

registerFont(join(FIXTURES_DIR, "Roboto-Regular.ttf"), "SceneDocumentTest");

const config = { scale: 24, minScale: 1, maxScale: 100, size: { width: 240, height: 240 }, backgroundColor: "#fff" };

function render(scene: PreparedScene<Image>): Promise<Buffer> {
    return renderToBuffer({
        config,
        draw: (engine) => {
            scene.attach(engine, { restoreCamera: true });
        },
    });
}

describe("portable scene pixels", () => {
    it("preserves all six primitives, mixed paint order, camera and live edits across JSON", async () => {
        const image = await makeTestImage();
        const document = createSceneDocument({
            assets: [{ id: "tile", src: "app:tile" }],
            camera: { center: { x: 0, y: 0 }, scale: 24 },
            metadata: { title: "portable" },
            layers: [
                {
                    id: "objects",
                    order: 3,
                    batches: [
                        {
                            id: "back",
                            kind: "rect",
                            items: [{ id: "back-box", x: -2, y: -2, size: 3, style: { fillStyle: "#f00" } }],
                        },
                        {
                            id: "middle",
                            kind: "circle",
                            items: [{ id: "middle-disc", x: -2, y: -2, size: 2, style: { fillStyle: "#00f" } }],
                        },
                        {
                            id: "front",
                            kind: "rect",
                            items: [{ id: "front-box", x: -2, y: -2, size: 0.6, style: { fillStyle: "#0f0" } }],
                        },
                        {
                            id: "line",
                            kind: "line",
                            style: { strokeStyle: "#333", lineWidthPx: 3 },
                            items: [
                                {
                                    id: "segment",
                                    from: { x: -3, y: 0 },
                                    to: { x: 3, y: 0 },
                                    style: { lineDashPx: [5, 2] },
                                },
                            ],
                        },
                        {
                            id: "path",
                            kind: "path",
                            items: [
                                {
                                    id: "curve",
                                    commands: [
                                        { type: "moveTo", x: 0, y: 1 },
                                        { type: "quadraticCurveTo", cpx: 3, cpy: 4, x: 3, y: 1 },
                                        { type: "closePath" },
                                    ],
                                    style: {
                                        fillStyle: {
                                            type: "linear",
                                            from: { x: 0, y: 0 },
                                            to: { x: 1, y: 1 },
                                            stops: [
                                                { offset: 0, color: "#f0f" },
                                                { offset: 1, color: "#ff0" },
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                        {
                            id: "image",
                            kind: "image",
                            clip: { minX: 0, minY: -4, maxX: 4, maxY: 0 },
                            items: [
                                {
                                    id: "sprite",
                                    assetId: "tile",
                                    x: 2,
                                    y: -2,
                                    size: 2,
                                    sprite: { x: 0, y: 0, w: 16, h: 32 },
                                    flipX: true,
                                    opacity: 0.7,
                                    rotate: 15,
                                },
                            ],
                        },
                        {
                            id: "text",
                            kind: "text",
                            items: [
                                {
                                    id: "label",
                                    x: -1,
                                    y: 3,
                                    text: "Scene",
                                    fontPx: 18,
                                    style: { fontFamily: "SceneDocumentTest", fillStyle: "#000" },
                                },
                            ],
                        },
                    ],
                },
            ],
        });
        const scene = await prepareScene(document, { resolveImage: () => image });
        const initial = await render(scene);
        const manual = await renderToBuffer({
            config,
            draw: (engine) => {
                const batches = document.layers[0].batches;
                for (const batch of batches) {
                    const options = { clip: batch.clip, hitTest: batch.hitTest };
                    switch (batch.kind) {
                        case "rect":
                            engine.drawRect(batch.items, 3, options);
                            break;
                        case "circle":
                            engine.drawCircle(batch.items, 3, options);
                            break;
                        case "line":
                            engine.drawLine(batch.items, batch.style, 3, options);
                            break;
                        case "path":
                            engine.drawPath(batch.items, 3, options);
                            break;
                        case "text":
                            engine.drawText(batch.items, 3, options);
                            break;
                        case "image":
                            engine.drawImage(
                                batch.items.map((item) => ({ ...item, img: image })),
                                3,
                                options,
                            );
                            break;
                    }
                }
            },
        });
        expectSamePixels(initial, manual, "scene-vs-direct-draws");

        scene.getCollection("front", "rect").update("front-box", { x: -1.5, widthPx: 24 });
        scene.getCollection("text", "text").update("label", { text: "Reopened" });
        scene.getCollection("image", "image").update("sprite", { opacity: 0.4, flipY: true });
        const saved = stringifySceneDocument(scene.capture());
        expect(saved).not.toContain('"img"');
        const reopened = await prepareScene(parseSceneDocument(saved), { resolveImage: () => image });
        expectSamePixels(await render(scene), await render(reopened), "scene-document-roundtrip");
    });
});
