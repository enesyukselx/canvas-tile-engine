---
sidebar_position: 4
---

# Scene Documents

Scene documents save and reopen a declared drawing as portable JSON. Version 1 supports dynamic rectangles, circles, lines, text, images and paths, including gradients, pixel sizing, sprite rectangles, clips, per-item styles and application data. Images are stored as asset references; platform image handles remain outside the JSON.

The helpers are exported by `@canvas-tile-engine/core`, `@canvas-tile-engine/react` and `@canvas-tile-engine/react-native`. They require core 0.12 or later and work without DOM types.

## Create, Prepare and Attach

```ts
import { createSceneDocument, prepareScene, stringifySceneDocument } from "@canvas-tile-engine/core";

const document = createSceneDocument({
    metadata: { title: "Station board" },
    assets: [{ id: "station-icon", src: "/assets/station.png" }],
    layers: [
        {
            id: "stations",
            order: 1,
            batches: [
                {
                    id: "platforms",
                    kind: "rect",
                    items: [
                        {
                            id: "platform-a",
                            x: 0,
                            y: 0,
                            width: 3,
                            height: 1,
                            style: { fillStyle: "#22c55e" },
                            data: { label: "Platform A" },
                        },
                    ],
                },
                {
                    id: "icons",
                    kind: "image",
                    items: [{ id: "icon-a", assetId: "station-icon", x: 0, y: 0, sizePx: 24 }],
                },
            ],
        },
    ],
});

const scene = await prepareScene(document, {
    resolveImage: (asset) => engine.images.load(asset.src!),
});
const attachment = scene.attach(engine); // Requests a frame.

const platforms = scene.getCollection("platforms", "rect");
platforms.update("platform-a", { x: 5 }); // Updates the existing draw handle.

const savedJson = stringifySceneDocument(
    scene.capture({
        center: engine.getCenter(),
        scale: engine.getScale(),
    }),
);
// Store savedJson using your application's file, database or download API.

attachment.dispose(); // Removes only this attachment's drawings.
```

`getCollection(batchId, kind)` returns a typed `ItemCollection`. The kind argument also verifies the batch at runtime. Insertions append, updates preserve position, and removals compact the batch. Its item `id` is its stable collection key and therefore appears as `key` in hit-test results. Text retains the engine's existing non-hit-testable behavior.

These helpers own the document and its registrations. They do not inspect unrelated `engine.draw*` calls, custom drawing callbacks, or renderer caches. Put persistent content in the document; register runtime overlays separately.

## Version 1 Shape and Ordering

```ts
type SceneDocument = {
    schemaVersion: 1;
    assets: Array<{ id: string; src?: string; metadata?: SceneJsonValue }>;
    layers: Array<{
        id: string;
        order: number;
        metadata?: SceneJsonValue;
        batches: SceneBatch[];
    }>;
    camera?: { center: { x: number; y: number }; scale: number };
    metadata?: SceneJsonValue;
};
```

IDs are nonempty strings of at most 256 characters. Asset IDs, layer IDs and batch IDs each have their own namespace and must be unique throughout that namespace. Item IDs must be unique throughout the entire document, including across kinds and layers. Numeric layer orders are finite and unique.

Layers draw in numeric `order`. Within a layer, batch array order is registration order; within a batch, item array order is paint order. Keep separate batches when an overlapping sequence is rectangle, circle, then rectangle. Combining the two rectangle batches would change the result. Each batch becomes one collection and one draw registration, preserving the engine's existing renderer behavior. WebGL text still uses its existing overlay plane.

Every batch has `id`, `kind` and `items`. Optional `clip`, `hitTest` and `metadata` fields apply to that batch. A `line` batch can also contain a call-level `style`, with normal per-item stroke-style precedence. Batch kinds are `rect`, `circle`, `line`, `text`, `image` and `path`.

Items use the corresponding core draw fields plus a required string `id`. Their optional `data` must be JSON. Image items replace `img` with `assetId`. Paths declare exactly one of `points` or `commands`; command paths close through a `closePath` command. Sizes, widths, radii and dash lengths must be nonnegative; text sizes and sprite dimensions must be positive. Both world and pixel fields may be saved together, with the usual pixel-field precedence. Finite origin offsets outside `0..1` remain supported. Finite gradient offsets retain the renderer's clamping and stable sorting behavior.

## Images and Other Runtime Resources

Preparation validates the whole document, then calls `resolveImage` once for **every declared asset**, including unused assets. It awaits all returned handles before creating the prepared scene. The resolver is required when the asset table is nonempty. No URL, path or asset ID triggers an automatic fetch or file read in core.

`src` is an optional opaque string, at most 8,192 characters. An application may instead resolve an ID through its asset catalog. Choose the allowed sources and the platform loader in that resolver. The provided engine image loaders already cache their results.

Resolved image collections retain `assetId` beside their runtime `img`. To switch an existing image to another prepared asset, change both fields together:

```ts
scene.getCollection("icons", "image").update("icon-a", {
    assetId: "alternate-icon",
    img: scene.getImage("alternate-icon"),
});
```

`getImage` performs no loading. Declare the alternate asset before preparation. Capture and attachment reject a runtime handle that does not match its declared asset ID. To add assets, layers or batches, edit a captured document, prepare it again, and replace the attachment.

Font family names are preserved as text style, but font files and font registration remain application setup. Server and native applications should register or supply the same fonts when matching another platform's text. Runtime style/visibility callbacks, custom draw functions, animation state, DOM/native image handles, selection state and history stacks are not persisted automatically. Store the application data you need as JSON metadata and reconnect behavior after loading.

## Reopen and Replace

```ts
import { parseSceneDocument, prepareScene } from "@canvas-tile-engine/core";

const reopenedDocument = parseSceneDocument(savedJson);
const reopened = await prepareScene(reopenedDocument, {
    resolveImage: (asset) => engine.images.load(asset.src!),
});

const nextAttachment = reopened.attach(engine, {
    replace: currentAttachment,
    restoreCamera: true,
});
currentAttachment = nextAttachment;
```

Schema or image-resolution failure happens before any engine registration changes. Attachment validates current collection contents again, stages all new registrations, and removes the previous attachment only after staging succeeds. It does not clear layers or unrelated drawings. A failed registration removes handles already returned by the renderer and leaves the previous attachment in place. A replacement must be an active attachment on the same engine.

`restoreCamera` defaults to `false`. When enabled and the document contains a camera, attachment applies scale and center through the normal engine setters. Existing scale limits and camera bounds still clamp the requested values. Read `getScale()` and `getCenter()` afterward when you need the applied camera. No camera change occurs during preparation.

Camera setters can render and invoke application observers during attachment. If one throws, the helper removes the staged handles and attempts to restore both previous camera values. Observer side effects and intermediate frames cannot be undone. Restoration errors are reported with the original error in an `AggregateError`.

Disposal releases successful removals immediately and retains only failed handles. If a renderer removal throws, the attachment remains active while handles are pending; call `dispose()` again to retry. `SceneAttachmentError` exposes an `attachment` when cleanup itself fails. `committed: false` means this attachment owns remaining staged handles to clean up and the previous attachment remains the current scene. `committed: true` means the new attachment has committed, but previous-scene disposal or frame scheduling failed. Keep the new attachment, and retry disposal on the previous one if it is still active.

## Validation and Deterministic Saving

`validateSceneDocument(value)` returns a detached validated snapshot. `parseSceneDocument(json)` parses and validates; `stringifySceneDocument(document, space = 2)` validates before serialization. Object keys use deterministic sorted order, while arrays retain authored order. `capture()` clones nested data and metadata, so editing a saved snapshot cannot change live items.

Validation rejects unknown structural fields, invalid enum values, nonfinite numbers, missing asset references, duplicate IDs, duplicate numeric layer orders, callbacks, image handles, cycles, class instances, accessors, symbols, bigint, explicit `undefined`, sparse arrays and reserved prototype property names. Optional fields should be omitted. A `SceneValidationError` includes `path` and `reason`; errors identify fields such as `$.layers[0].batches[1].items[2].assetId`.

The default limits are depth 64, 2,000,000 visited JSON nodes, 1,000,000 characters per string/property name and 32,000,000 characters of JSON input/output. Trusted applications can override positive integer limits through `{ limits: { ... } }` when creating, parsing, validating or preparing. For stringify, options are the third argument. Limits constrain traversal and document size; they do not make arbitrary runtime callbacks serializable.

Full validation runs during create, parse, prepare, capture and attach. Live collection mutation follows the existing `ItemCollection` contract; it does not run a whole-document validation on every update. A later capture or attachment rejects invalid live edits, cross-batch duplicate IDs or mismatched image references.

## Schema Lifecycle and Migrations

The first built-in format is `schemaVersion: 1`. Unknown future versions are rejected. Older application-defined formats require explicit migration functions; the library does not assume an undocumented legacy format.

```ts
import { parseSceneDocument, type SceneMigrations } from "@canvas-tile-engine/core";

const migrations: SceneMigrations = new Map([
    [
        0,
        (legacy) => ({
            schemaVersion: 1,
            assets: [],
            layers: [],
            metadata: { importedTitle: legacy.title ?? "Untitled" },
        }),
    ],
]);

const migrated = parseSceneDocument(oldJson, { migrations });
```

The example defines an application-specific version 0; it is not a historical engine schema. Each migration receives detached JSON and must return version `from + 1`. Every returned value is checked for JSON safety and the final current-version document receives full validation. Migrations are application code supplied at load time and are never read from the saved JSON.

## React and React Native

Use the same helpers from either binding package. Wait for the mounted engine instance, attach from an effect, and dispose from that effect's cleanup:

```tsx
useEffect(() => {
    if (!engine.instance) return;
    const attachment = preparedScene.attach(engine.instance);
    return () => attachment.dispose();
}, [engine.instance, preparedScene]);
```

Keep `preparedScene` stable between edits. Its collections can also be passed to the corresponding compound components; choose either those components or `attach` as the owner of a given batch to avoid drawing it twice. Camera state is optional document data, independent of component configuration and viewport size.
