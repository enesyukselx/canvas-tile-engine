# Scene documents (core >= 0.12)

Use the scene helpers to save/reopen declared drawing data across browser,
native and server renderers. Import them from core or either React binding.
Keep arbitrary engine callbacks and runtime handles outside the document.

## Workflow

```ts
import {
    createSceneDocument,
    prepareScene,
    stringifySceneDocument,
    parseSceneDocument,
} from "@canvas-tile-engine/core";

const document = createSceneDocument({
    assets: [{ id: "marker", src: "/marker.png" }],
    layers: [
        {
            id: "board",
            order: 1,
            batches: [
                { id: "tiles", kind: "rect", items: [{ id: "tile-a", x: 0, y: 0, style: { fillStyle: "#22c55e" } }] },
                {
                    id: "markers",
                    kind: "image",
                    items: [{ id: "marker-a", x: 0, y: 0, assetId: "marker", sizePx: 24 }],
                },
            ],
        },
    ],
});
const scene = await prepareScene(document, {
    resolveImage: (asset) => engine.images.load(asset.src!),
});
let attachment = scene.attach(engine);
scene.getCollection("tiles", "rect").update("tile-a", { x: 2 });
const json = stringifySceneDocument(
    scene.capture({
        center: engine.getCenter(),
        scale: engine.getScale(),
    }),
);
const reopened = await prepareScene(parseSceneDocument(json), {
    resolveImage: (asset) => engine.images.load(asset.src!),
});
attachment = reopened.attach(engine, { replace: attachment, restoreCamera: true });
// The replacement registers last: it now paints above other drawings on the
// same layer numbers, so keep app overlays on their own layers.
// Dispose when this owner unmounts:
attachment.dispose();
```

## Document contract

- `createSceneDocument` assigns `schemaVersion: 1`; omitted `assets` and
  `layers` become empty arrays. Parse/validate require an explicit version.
- Use unique string IDs (nonblank, at most 256 chars) for assets, layers and
  batches within their respective document-wide namespaces. Item IDs must be
  unique across all batches. Numeric layer `order` values must also be unique.
- Store ordered typed batches in each layer. `kind` is `rect`, `circle`,
  `line`, `text`, `image` or `path`. Each batch maps to one keyed collection
  and one registration. Preserve separate rect/circle/rect batches when
  their overlap order matters. Do not group all items by primitive afterward.
- Put `clip`, `hitTest` and optional JSON `metadata` on the batch. A line
  batch may have call-level `style`; per-item style still overlays it.
- Preserve core item geometry/appearance plus `id`. Use JSON `data` for app
  values. Store image `assetId`, never an image handle. Paths declare exactly
  one of `points` or `commands`; command paths close with `closePath`.
- Store optional JSON `metadata` on document, layer, batch and asset.
  Store optional `camera: { center: {x, y}, scale }`, not viewport or renderer
  configuration. All JSON numbers must be finite.

## Runtime and resources

Prepare every declared asset eagerly, once per ID, before attachment. Supply
`resolveImage` whenever `assets` is nonempty. Core does not fetch URLs or read
files implicitly. `src` is an opaque optional reference of at most 8,192
characters; use an application catalog when URL/path loading is unsuitable.
Register fonts separately; only text family names are saved.

Use `getCollection(batchId, kind)` for typed `ItemCollection` access; geometry
edits preserve registration and item order. `getImage(assetId)` returns a
prepared handle without loading. Image items carry both `assetId` and `img`
at runtime: update both together when switching prepared assets. Capture and
attach reject mismatched handles/references. Reprepare a captured document
to add/remove assets, layers or batches.

Call `capture()` for a detached, validated snapshot of current items. Pass a
camera argument to update the captured camera; otherwise the document's
original optional camera is retained. Nested snapshot edits cannot change
the prepared scene. `stringifySceneDocument` sorts object keys for stable
output and keeps array order. It never invokes `toJSON` or accessors.

Validation rejects unknown structural fields, duplicates, missing refs,
non-JSON values, cycles, accessors, sparse arrays and reserved prototype keys.
Omit optional values rather than explicitly writing `undefined`. Use
`SceneValidationError.path` and `.reason` for form feedback. Default limits:
depth 64, 2,000,000 nodes, 1,000,000 chars per string/key, 32,000,000 chars for
JSON input/output. Use `options.limits` to adjust trusted workloads. Live
mutations use collection rules; full scene validation runs on capture/attach.

## Ownership and failures

Attach only to a ready engine. In React/RN, depend on `engine.instance` and
the stable prepared scene; return `attachment.dispose()` from effect cleanup.
Use either attachment ownership or compound draw components for each batch,
not both. Existing non-scene registrations remain untouched.

Validate/resolve before replacing. Staging failure removes returned new
handles and preserves the old attachment. Disposal retains failed handles
for retry; successful removals are released. `SceneAttachmentError` exposes
an owned `attachment`: `committed: false` means remaining staged handles need
cleanup; `committed: true` means the new attachment committed but old cleanup
or frame scheduling failed. Retry old disposal if it remains active.

Camera restore is opt-in. Normal engine limits/bounds can clamp it; read the
applied values afterward. Camera observers/rendering may run during attach.
On setter failure, rollback attempts both previous values, but cannot undo
observer side effects or intermediate frames. Multiple rollback errors use
`AggregateError`. Do not promise transactionality across user callbacks.

## Migrations

There is no assumed legacy engine format. Register a `SceneMigrations`
`ReadonlyMap<number, (oldJson) => unknown>` only for an app-defined older
schema. Migrations are keyed by the input's numeric `schemaVersion`; add one
(e.g. `0`) to legacy JSON first, since input without it is rejected before any
migration runs. Each step must increment `schemaVersion` by exactly one. JSON safety
is rechecked after each step and full validation runs on the final version.
Unknown future versions and older versions without a registered migration
are rejected. Migration functions remain application code, not document data.
