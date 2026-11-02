import type { CanvasTileEngine } from "../../CanvasTileEngine";
import type { DrawHandle } from "../../types";
import { ItemCollection } from "../ItemCollection";
import {
    cloneCamera,
    cloneSceneJson,
    sceneLimits,
    SCENE_SCHEMA_VERSION,
    SceneValidationError,
    validateSceneDocument,
} from "./validation";
import type {
    PrepareSceneOptions,
    SceneAsset,
    SceneBatch,
    SceneCamera,
    SceneCollection,
    SceneDocument,
    SceneDocumentInput,
    SceneJsonObject,
    SceneKind,
    SceneLimits,
    SceneReadOptions,
    SceneRuntimeItemMap,
} from "./types";

/** Create a detached version 1 document; omitted asset/layer tables are empty. */
export function createSceneDocument(input: SceneDocumentInput = {}, options?: SceneReadOptions): SceneDocument {
    const value = cloneSceneJson(input, sceneLimits(options));
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new SceneValidationError("$", "must be an object");
    }
    if (Object.hasOwn(value, "schemaVersion")) {
        throw new SceneValidationError("$.schemaVersion", "createSceneDocument assigns the current version");
    }
    return validateSceneDocument({ assets: [], layers: [], ...value, schemaVersion: SCENE_SCHEMA_VERSION }, options);
}

/** Parse JSON, run explicitly registered migrations and validate before use. */
export function parseSceneDocument(json: string, options?: SceneReadOptions): SceneDocument {
    const limits = sceneLimits(options);
    if (typeof json !== "string" || json.length > limits.maxSourceLength) {
        throw new SceneValidationError("$", "JSON input must be a string within maxSourceLength");
    }
    let value: unknown;
    try {
        value = JSON.parse(json);
    } catch {
        throw new SceneValidationError("$", "invalid JSON syntax");
    }
    return validateSceneDocument(value, options);
}

/** Deterministic object-key order; meaningful array order is never sorted. */
export function stringifySceneDocument(document: SceneDocument, space = 2, options?: SceneReadOptions): string {
    if (!Number.isInteger(space) || space < 0 || space > 10) {
        throw new SceneValidationError("space", "must be an integer between 0 and 10");
    }
    const result = JSON.stringify(validateSceneDocument(document, options), null, space);
    if (result.length > sceneLimits(options).maxSourceLength) {
        throw new SceneValidationError("$", "serialized document exceeds maxSourceLength");
    }
    return result;
}

/** Only the renderer-independent surface needed to mount a prepared scene. */
export type SceneTarget<TImage> = Pick<
    CanvasTileEngine<unknown, TImage>,
    | "drawRect"
    | "drawCircle"
    | "drawLine"
    | "drawText"
    | "drawImage"
    | "drawPath"
    | "removeDrawHandle"
    | "requestRender"
    | "getScale"
    | "getCenter"
    | "setScale"
    | "setCenter"
>;

export interface SceneAttachment {
    readonly active: boolean;
    readonly handles: readonly DrawHandle[];
    /** Remove only this attachment's registrations; safe to call repeatedly. */
    dispose(): void;
}

export interface SceneAttachOptions {
    /** Replaced only after every new registration and requested camera change succeeds. */
    replace?: SceneAttachment;
    /** Default false. Existing engine scale limits and camera bounds still apply. */
    restoreCamera?: boolean;
}

/** Cleanup failure retains recoverable ownership through this error. */
export class SceneAttachmentError extends Error {
    constructor(
        readonly attachment: SceneAttachment,
        cause: unknown,
        readonly committed = true,
    ) {
        super(
            committed
                ? "[CanvasTileEngine] Scene attached, but previous-scene cleanup or frame scheduling failed"
                : "[CanvasTileEngine] Scene attachment failed and some staged handles still require disposal",
            { cause },
        );
        this.name = "SceneAttachmentError";
    }
}

function removeHandles<TImage>(
    engine: SceneTarget<TImage>,
    handles: readonly DrawHandle[],
): { errors: unknown[]; failed: DrawHandle[] } {
    const errors: unknown[] = [];
    const failed: DrawHandle[] = [];
    for (const handle of handles) {
        try {
            engine.removeDrawHandle(handle);
        } catch (error) {
            errors.push(error);
            failed.push(handle);
        }
    }
    return { errors, failed };
}

class OwnedAttachment<TImage> implements SceneAttachment {
    private attached = true;
    private disposing = false;
    private pending: readonly DrawHandle[];

    constructor(
        readonly engine: SceneTarget<TImage>,
        handles: readonly DrawHandle[],
    ) {
        this.pending = Object.freeze([...handles]);
    }

    get active(): boolean {
        return this.attached;
    }

    get handles(): readonly DrawHandle[] {
        return this.pending;
    }

    dispose(): void {
        if (!this.attached || this.disposing) {
            return;
        }
        this.disposing = true;
        const { errors, failed } = removeHandles(this.engine, this.pending);
        this.pending = Object.freeze(failed);
        this.attached = failed.length > 0;
        this.disposing = false;
        try {
            this.engine.requestRender();
        } catch (error) {
            errors.push(error);
        }
        if (errors.length > 0) {
            throw new AggregateError(errors, "[CanvasTileEngine] Could not completely dispose scene attachment");
        }
    }
}

type RuntimeItem<TImage> = SceneRuntimeItemMap<TImage>[SceneKind];
interface RuntimeBatch<TImage> {
    kind: SceneKind;
    collection: ItemCollection<RuntimeItem<TImage>>;
}

/**
 * Prepared assets plus live keyed collections. Capture validates current items
 * again, so unsupported runtime edits cannot silently enter a saved document.
 */
export class PreparedScene<TImage = unknown> {
    private readonly batches = new Map<string, RuntimeBatch<TImage>>();

    /** @internal Built by prepareScene, which validates and resolves assets first. */
    static fromPrepared<TImage>(
        document: SceneDocument,
        images: ReadonlyMap<string, TImage>,
        limits: SceneLimits,
    ): PreparedScene<TImage> {
        return new PreparedScene(document, images, limits);
    }

    // Private, not stripped from declarations: a stripped constructor would
    // publish an implicit no-argument one that crashes at runtime.
    private constructor(
        private readonly document: SceneDocument,
        private readonly images: ReadonlyMap<string, TImage>,
        private readonly limits: SceneLimits,
    ) {
        for (const layer of document.layers) {
            for (const batch of layer.batches) {
                const items: RuntimeItem<TImage>[] =
                    batch.kind === "image"
                        ? batch.items.map((item) => ({ ...item, img: images.get(item.assetId)! }))
                        : batch.items;
                this.batches.set(batch.id, {
                    kind: batch.kind,
                    collection: new ItemCollection(items, { keyOf: (item) => item.id }),
                });
            }
        }
    }

    /** The kind argument checks the batch at runtime and narrows its item type. */
    getCollection<K extends SceneKind>(batchId: string, kind: K): SceneCollection<TImage, K> {
        const batch = this.batches.get(batchId);
        if (!batch || batch.kind !== kind) {
            throw new Error(`[CanvasTileEngine] Scene batch ${JSON.stringify(batchId)} is not a ${kind} batch`);
        }
        return batch.collection as unknown as SceneCollection<TImage, K>;
    }

    /** Retrieve a handle resolved during preparation; this never starts a load. */
    getImage(assetId: string): TImage {
        if (!this.images.has(assetId)) {
            throw new Error(`[CanvasTileEngine] Unknown scene asset ${JSON.stringify(assetId)}`);
        }
        return this.images.get(assetId)!;
    }

    /** Detached JSON snapshot of current collection contents, with optional updated camera. */
    capture(camera?: SceneCamera): SceneDocument {
        const layers = this.document.layers.map((layer, layerIndex) => ({
            ...layer,
            batches: layer.batches.map((batch, batchIndex) => {
                const source = this.batches.get(batch.id)!;
                const items = source.collection.items.map((item, itemIndex) => {
                    if (batch.kind !== "image") {
                        return item;
                    }
                    const path = `$.layers[${layerIndex}].batches[${batchIndex}].items[${itemIndex}]`;
                    const asset = Object.getOwnPropertyDescriptor(item, "assetId");
                    const image = Object.getOwnPropertyDescriptor(item, "img");
                    if (
                        !asset ||
                        !Object.hasOwn(asset, "value") ||
                        typeof asset.value !== "string" ||
                        !this.images.has(asset.value)
                    ) {
                        throw new SceneValidationError(`${path}.assetId`, "must reference a prepared asset");
                    }
                    if (
                        !image ||
                        !Object.hasOwn(image, "value") ||
                        !Object.is(image.value, this.images.get(asset.value))
                    ) {
                        throw new SceneValidationError(`${path}.img`, "image handle must match its declared assetId");
                    }
                    // Preserve descriptors so validation rejects accessors instead
                    // of executing them while excluding the opaque image handle.
                    const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(item);
                    delete descriptors.img;
                    return Object.create(Object.getPrototypeOf(item), descriptors) as SceneJsonObject;
                });
                return { ...batch, items };
            }),
        }));
        return validateSceneDocument(
            { ...this.document, layers, ...(camera ? { camera } : {}) },
            { limits: this.limits },
        );
    }

    attach(engine: SceneTarget<TImage>, options: SceneAttachOptions = {}): SceneAttachment {
        // Includes live edits, duplicate IDs and image/reference correspondence.
        const document = this.capture();
        const previous = options.replace;
        if (previous && (!(previous instanceof OwnedAttachment) || previous.engine !== engine || !previous.active)) {
            throw new Error("[CanvasTileEngine] Replacement must be an active attachment on this engine");
        }
        const camera = options.restoreCamera ? document.camera : undefined;
        const oldCamera = camera
            ? cloneCamera({ center: engine.getCenter(), scale: engine.getScale() }, this.limits)
            : undefined;
        const handles: DrawHandle[] = [];
        let cameraStarted = false;
        try {
            for (const layer of document.layers) {
                for (const batch of layer.batches) {
                    handles.push(this.register(engine, batch, layer.order));
                }
            }
            if (camera) {
                cameraStarted = true;
                engine.setScale(camera.scale);
                engine.setCenter(camera.center);
            }
        } catch (error) {
            const cleanup = removeHandles(engine, handles);
            const errors = [error, ...cleanup.errors];
            if (cameraStarted && oldCamera) {
                // A setter may mutate state before an observer throws. Try both
                // restoration steps even if the first observer throws again.
                for (const restore of [
                    () => engine.setScale(oldCamera.scale),
                    () => engine.setCenter(oldCamera.center),
                ]) {
                    try {
                        restore();
                    } catch (restoreError) {
                        errors.push(restoreError);
                    }
                }
            }
            if (cleanup.failed.length > 0) {
                throw new SceneAttachmentError(
                    new OwnedAttachment(engine, cleanup.failed),
                    new AggregateError(errors, "[CanvasTileEngine] Scene attachment rollback reported errors"),
                    false,
                );
            }
            if (errors.length > 1) {
                throw new AggregateError(
                    errors,
                    "[CanvasTileEngine] Scene attachment failed; rollback also reported errors",
                );
            }
            throw error;
        }
        // Commit: prior registrations stay alive until staging has succeeded.
        const attachment = new OwnedAttachment(engine, handles);
        try {
            previous?.dispose();
            engine.requestRender();
        } catch (error) {
            throw new SceneAttachmentError(attachment, error);
        }
        return attachment;
    }

    private register(engine: SceneTarget<TImage>, batch: SceneBatch, layer: number): DrawHandle {
        // No engine draw ID: IDs belong to this document, so two independent
        // attachments cannot accidentally replace each other's registrations.
        const options = { clip: batch.clip, hitTest: batch.hitTest };
        switch (batch.kind) {
            case "rect":
                return engine.drawRect(this.getCollection(batch.id, "rect"), layer, options);
            case "circle":
                return engine.drawCircle(this.getCollection(batch.id, "circle"), layer, options);
            case "line":
                return engine.drawLine(this.getCollection(batch.id, "line"), batch.style, layer, options);
            case "text":
                return engine.drawText(this.getCollection(batch.id, "text"), layer, options);
            case "path":
                return engine.drawPath(this.getCollection(batch.id, "path"), layer, options);
            case "image":
                return engine.drawImage(this.getCollection(batch.id, "image"), layer, options);
        }
    }
}

/**
 * Eagerly resolve every declared asset once. JSON never initiates network/file
 * access by itself: applications supply the platform's trusted resolver.
 */
export async function prepareScene<TImage = unknown>(
    input: unknown,
    options: PrepareSceneOptions<TImage> = {},
): Promise<PreparedScene<TImage>> {
    const document =
        typeof input === "string" ? parseSceneDocument(input, options) : validateSceneDocument(input, options);
    if (document.assets.length > 0 && !options.resolveImage) {
        throw new Error("[CanvasTileEngine] prepareScene requires resolveImage for declared assets");
    }
    const limits = sceneLimits(options);
    const entries = await Promise.all(
        document.assets.map(async (asset) => {
            // The resolver may retain or mutate its input; never expose the stored
            // document's metadata to it.
            const copy = cloneSceneJson(asset, limits) as unknown as SceneAsset;
            const image = await options.resolveImage!(copy);
            if (image === undefined || image === null) {
                throw new Error(
                    `[CanvasTileEngine] Image resolver returned no handle for asset ${JSON.stringify(asset.id)}`,
                );
            }
            return [asset.id, image] as const;
        }),
    );
    return PreparedScene.fromPrepared(document, new Map(entries), limits);
}
