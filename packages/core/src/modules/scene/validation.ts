import type {
    SceneCamera,
    SceneDocument,
    SceneJsonObject,
    SceneJsonValue,
    SceneKind,
    SceneLimits,
    SceneReadOptions,
} from "./types";

export const SCENE_SCHEMA_VERSION = 1 as const;

/** Defaults bound document traversal, text input and application metadata. */
export const DEFAULT_SCENE_LIMITS: Readonly<SceneLimits> = Object.freeze({
    maxDepth: 64,
    maxNodes: 2_000_000,
    maxStringLength: 1_000_000,
    maxSourceLength: 32_000_000,
});

export class SceneValidationError extends Error {
    constructor(
        readonly path: string,
        readonly reason: string,
    ) {
        super(`[CanvasTileEngine] Invalid scene at ${path}: ${reason}`);
        this.name = "SceneValidationError";
    }
}

function fail(path: string, reason: string): never {
    throw new SceneValidationError(path, reason);
}

export function sceneLimits(options?: SceneReadOptions): SceneLimits {
    const limits = { ...DEFAULT_SCENE_LIMITS, ...options?.limits };
    for (const key of Object.keys(DEFAULT_SCENE_LIMITS) as (keyof SceneLimits)[]) {
        if (!Number.isSafeInteger(limits[key]) || limits[key] < 1) {
            fail(`limits.${key}`, "must be a positive safe integer");
        }
    }
    return limits;
}

/** Clone descriptors rather than reading values through getters or toJSON. */
export function cloneSceneJson(input: unknown, limits: SceneLimits): SceneJsonValue {
    const ancestors = new Set<object>();
    let nodes = 0;
    const visit = (value: unknown, path: string, depth: number): SceneJsonValue => {
        if (++nodes > limits.maxNodes) {
            fail(path, "document exceeds maxNodes");
        }
        if (depth > limits.maxDepth) {
            fail(path, "document exceeds maxDepth");
        }
        if (value === null || typeof value === "boolean") {
            return value;
        }
        if (typeof value === "number") {
            if (!Number.isFinite(value)) {
                fail(path, "must be a finite number");
            }
            return value;
        }
        if (typeof value === "string") {
            if (value.length > limits.maxStringLength) {
                fail(path, "string exceeds maxStringLength");
            }
            return value;
        }
        if (typeof value !== "object") {
            fail(path, "must be a JSON value (no functions, undefined, symbols or bigint)");
        }
        if (ancestors.has(value)) {
            fail(path, "cyclic data is not JSON");
        }
        const isArray = Array.isArray(value);
        const proto = Object.getPrototypeOf(value);
        if (isArray ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) {
            fail(path, "must be a plain object or array");
        }
        ancestors.add(value);
        const keys = Reflect.ownKeys(value);
        if (keys.length > limits.maxNodes - nodes + 1) {
            fail(path, "document exceeds maxNodes");
        }
        for (const key of keys) {
            if (typeof key !== "string") {
                fail(path, "symbol properties are not JSON");
            }
            if (key.length > limits.maxStringLength) {
                fail(path, "property name exceeds maxStringLength");
            }
            if (key === "__proto__" || key === "prototype" || key === "constructor") {
                fail(`${path}.${key}`, "reserved property name");
            }
            const descriptor = Object.getOwnPropertyDescriptor(value, key)!;
            if (!Object.hasOwn(descriptor, "value")) {
                fail(`${path}.${key}`, "accessor properties are not JSON");
            }
            if (isArray) {
                if (key !== "length" && (!/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length)) {
                    fail(`${path}.${key}`, "extra array properties are not JSON");
                }
            } else if (!descriptor.enumerable) {
                fail(`${path}.${key}`, "non-enumerable properties are not JSON");
            }
        }
        let result: SceneJsonValue;
        if (isArray) {
            if (value.length > limits.maxNodes - nodes) {
                fail(path, "array exceeds maxNodes");
            }
            result = Array.from({ length: value.length }, (_, i) => {
                const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
                if (!descriptor) {
                    fail(`${path}[${i}]`, "sparse arrays are not supported");
                }
                return visit(descriptor.value, `${path}[${i}]`, depth + 1);
            });
        } else {
            const object: SceneJsonObject = {};
            for (const key of (keys as string[]).sort()) {
                object[key] = visit(Object.getOwnPropertyDescriptor(value, key)!.value, `${path}.${key}`, depth + 1);
            }
            result = object;
        }
        ancestors.delete(value);
        return result;
    };
    return visit(input, "$", 0);
}

function record(value: SceneJsonValue | undefined, path: string): SceneJsonObject {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        fail(path, "must be an object");
    }
    return value;
}

function fields(value: SceneJsonObject, names: readonly string[], path: string): void {
    for (const key of Object.keys(value)) {
        if (!names.includes(key)) {
            fail(`${path}.${key}`, "unknown field");
        }
    }
}

function array(value: SceneJsonValue | undefined, path: string): SceneJsonValue[] {
    if (!Array.isArray(value)) {
        fail(path, "must be an array");
    }
    return value;
}

function number(value: SceneJsonValue | undefined, path: string, minimum = -Infinity): number {
    if (typeof value !== "number" || !Number.isFinite(value) || value < minimum) {
        fail(path, `must be a finite number${minimum !== -Infinity ? ` >= ${minimum}` : ""}`);
    }
    return value;
}

function string(value: SceneJsonValue | undefined, path: string, maximum = Infinity): string {
    if (typeof value !== "string" || value.length > maximum) {
        fail(path, `must be a string${maximum !== Infinity ? ` of at most ${maximum} characters` : ""}`);
    }
    return value;
}

function id(value: SceneJsonValue | undefined, path: string, seen?: Set<string>): string {
    const result = string(value, path, 256);
    if (result.trim().length === 0) {
        fail(path, "must not be empty or whitespace");
    }
    if (seen?.has(result)) {
        fail(path, `duplicate ID ${JSON.stringify(result)}`);
    }
    seen?.add(result);
    return result;
}

function boolean(value: SceneJsonValue, path: string): void {
    if (typeof value !== "boolean") {
        fail(path, "must be a boolean");
    }
}

function choice(value: SceneJsonValue, allowed: readonly SceneJsonValue[], path: string): void {
    if (!allowed.includes(value)) {
        fail(path, `must be one of ${allowed.map(String).join(", ")}`);
    }
}

function optionalNumbers(object: SceneJsonObject, names: readonly string[], path: string, minimum = -Infinity): void {
    for (const key of names) {
        if (Object.hasOwn(object, key)) {
            number(object[key], `${path}.${key}`, minimum);
        }
    }
}

function coords(value: SceneJsonValue | undefined, path: string): void {
    const object = record(value, path);
    fields(object, ["x", "y"], path);
    number(object.x, `${path}.x`);
    number(object.y, `${path}.y`);
}

function bounds(value: SceneJsonValue, path: string): void {
    const object = record(value, path);
    fields(object, ["minX", "minY", "maxX", "maxY"], path);
    for (const name of ["minX", "minY", "maxX", "maxY"]) {
        number(object[name], `${path}.${name}`);
    }
    if ((object.minX as number) > (object.maxX as number) || (object.minY as number) > (object.maxY as number)) {
        fail(path, "minimum bounds must not exceed maximum bounds");
    }
}

function paint(value: SceneJsonValue, path: string): void {
    if (typeof value === "string") {
        return;
    }
    const object = record(value, path);
    fields(object, ["type", "from", "to", "stops", "units"], path);
    choice(object.type, ["linear"], `${path}.type`);
    coords(object.from, `${path}.from`);
    coords(object.to, `${path}.to`);
    if (Object.hasOwn(object, "units")) {
        choice(object.units, ["box", "world"], `${path}.units`);
    }
    array(object.stops, `${path}.stops`).forEach((stop, index) => {
        const at = `${path}.stops[${index}]`;
        const entry = record(stop, at);
        fields(entry, ["offset", "color"], at);
        // Renderers already clamp and stably sort finite authored offsets.
        number(entry.offset, `${at}.offset`);
        string(entry.color, `${at}.color`);
    });
}

const strokeFields = ["strokeStyle", "lineWidth", "lineWidthPx", "lineDash", "lineDashPx"];
function style(value: SceneJsonValue, path: string, kind: SceneKind): void {
    const object = record(value, path);
    if (kind === "text") {
        fields(object, ["fillStyle", "fontFamily", "fontWeight", "textAlign", "textBaseline"], path);
        for (const key of ["fillStyle", "fontFamily"]) {
            if (Object.hasOwn(object, key)) {
                string(object[key], `${path}.${key}`);
            }
        }
        if (Object.hasOwn(object, "fontWeight")) {
            choice(
                object.fontWeight,
                ["normal", "bold", 100, 200, 300, 400, 500, 600, 700, 800, 900],
                `${path}.fontWeight`,
            );
        }
        if (Object.hasOwn(object, "textAlign")) {
            choice(object.textAlign, ["center", "end", "left", "right", "start"], `${path}.textAlign`);
        }
        if (Object.hasOwn(object, "textBaseline")) {
            choice(
                object.textBaseline,
                ["alphabetic", "bottom", "hanging", "ideographic", "middle", "top"],
                `${path}.textBaseline`,
            );
        }
        return;
    }
    fields(
        object,
        [
            ...strokeFields,
            ...(kind === "line" ? [] : ["fillStyle"]),
            ...(kind === "path" ? ["cornerRadius", "cornerRadiusPx"] : []),
        ],
        path,
    );
    if (Object.hasOwn(object, "fillStyle")) {
        paint(object.fillStyle, `${path}.fillStyle`);
    }
    if (Object.hasOwn(object, "strokeStyle")) {
        string(object.strokeStyle, `${path}.strokeStyle`);
    }
    optionalNumbers(object, ["lineWidth", "lineWidthPx", "cornerRadius", "cornerRadiusPx"], path, 0);
    for (const key of ["lineDash", "lineDashPx"]) {
        if (Object.hasOwn(object, key)) {
            array(object[key], `${path}.${key}`).forEach((value, i) => number(value, `${path}.${key}[${i}]`, 0));
        }
    }
}

function command(value: SceneJsonValue, path: string): void {
    const object = record(value, path);
    switch (object.type) {
        case "moveTo":
        case "lineTo":
            fields(object, ["type", "x", "y"], path);
            number(object.x, `${path}.x`);
            number(object.y, `${path}.y`);
            break;
        case "arc":
            fields(object, ["type", "x", "y", "radius", "startAngle", "endAngle", "ccw"], path);
            for (const key of ["x", "y", "startAngle", "endAngle"]) {
                number(object[key], `${path}.${key}`);
            }
            number(object.radius, `${path}.radius`, 0);
            if (Object.hasOwn(object, "ccw")) {
                boolean(object.ccw, `${path}.ccw`);
            }
            break;
        case "quadraticCurveTo":
        case "bezierCurveTo": {
            const keys =
                object.type === "quadraticCurveTo"
                    ? ["cpx", "cpy", "x", "y"]
                    : ["cp1x", "cp1y", "cp2x", "cp2y", "x", "y"];
            fields(object, ["type", ...keys], path);
            for (const key of keys) {
                number(object[key], `${path}.${key}`);
            }
            break;
        }
        case "closePath":
            fields(object, ["type"], path);
            break;
        default:
            fail(`${path}.type`, "unknown path command");
    }
}

function item(value: SceneJsonValue, kind: SceneKind, path: string, itemIds: Set<string>, assetIds: Set<string>): void {
    const object = record(value, path);
    id(object.id, `${path}.id`, itemIds);
    const base = ["id", "data"];
    if (kind === "line") {
        fields(object, [...base, "from", "to", "style"], path);
        coords(object.from, `${path}.from`);
        coords(object.to, `${path}.to`);
    } else if (kind === "path") {
        fields(object, [...base, "points", "commands", "closed", "fillRule", "style"], path);
        if (Object.hasOwn(object, "points") === Object.hasOwn(object, "commands")) {
            fail(path, "a path must declare exactly one of points or commands");
        }
        if (Object.hasOwn(object, "points")) {
            array(object.points, `${path}.points`).forEach((value, i) => coords(value, `${path}.points[${i}]`));
        } else {
            array(object.commands, `${path}.commands`).forEach((value, i) => command(value, `${path}.commands[${i}]`));
            if (Object.hasOwn(object, "closed")) {
                fail(`${path}.closed`, "command paths use a closePath command");
            }
        }
        if (Object.hasOwn(object, "closed")) {
            boolean(object.closed, `${path}.closed`);
        }
        if (Object.hasOwn(object, "fillRule")) {
            choice(object.fillRule, ["nonzero", "evenodd"], `${path}.fillRule`);
        }
    } else {
        number(object.x, `${path}.x`);
        number(object.y, `${path}.y`);
        const position = [...base, "x", "y", "size"];
        if (kind === "text") {
            fields(object, [...position, "text", "fontPx", "rotate", "style"], path);
            string(object.text, `${path}.text`);
            optionalNumbers(object, ["size", "fontPx"], path, Number.MIN_VALUE);
        } else {
            const anchored = [...position, "origin", "sizePx"];
            if (kind === "rect") {
                fields(
                    object,
                    [...anchored, "width", "height", "widthPx", "heightPx", "rotate", "radius", "style"],
                    path,
                );
                optionalNumbers(object, ["width", "height", "widthPx", "heightPx"], path, 0);
                if (Object.hasOwn(object, "radius")) {
                    if (Array.isArray(object.radius)) {
                        if (object.radius.length < 1 || object.radius.length > 4) {
                            fail(`${path}.radius`, "must contain between one and four radii");
                        }
                        object.radius.forEach((value, i) => number(value, `${path}.radius[${i}]`, 0));
                    } else {
                        number(object.radius, `${path}.radius`, 0);
                    }
                }
            } else if (kind === "circle") {
                fields(object, [...anchored, "style"], path);
            } else {
                fields(object, [...anchored, "assetId", "rotate", "sprite", "flipX", "flipY", "opacity"], path);
                const reference = id(object.assetId, `${path}.assetId`);
                if (!assetIds.has(reference)) {
                    fail(`${path}.assetId`, `unknown asset ${JSON.stringify(reference)}`);
                }
                if (Object.hasOwn(object, "sprite")) {
                    const sprite = record(object.sprite, `${path}.sprite`);
                    fields(sprite, ["x", "y", "w", "h"], `${path}.sprite`);
                    for (const key of ["x", "y", "w", "h"]) {
                        number(sprite[key], `${path}.sprite.${key}`, key === "w" || key === "h" ? Number.MIN_VALUE : 0);
                    }
                }
                for (const key of ["flipX", "flipY"]) {
                    if (Object.hasOwn(object, key)) {
                        boolean(object[key], `${path}.${key}`);
                    }
                }
                if (Object.hasOwn(object, "opacity") && number(object.opacity, `${path}.opacity`, 0) > 1) {
                    fail(`${path}.opacity`, "must be <= 1");
                }
            }
            optionalNumbers(object, ["size", "sizePx"], path, 0);
            if (Object.hasOwn(object, "origin")) {
                const origin = record(object.origin, `${path}.origin`);
                fields(origin, ["mode", "x", "y"], `${path}.origin`);
                if (Object.hasOwn(origin, "mode")) {
                    choice(origin.mode, ["cell", "self"], `${path}.origin.mode`);
                }
                optionalNumbers(origin, ["x", "y"], `${path}.origin`);
            }
        }
        optionalNumbers(object, ["rotate"], path);
    }
    if (Object.hasOwn(object, "style")) {
        style(object.style, `${path}.style`, kind);
    }
}

export function validateSceneCamera(value: SceneJsonValue, path = "$.camera"): void {
    const camera = record(value, path);
    fields(camera, ["center", "scale"], path);
    coords(camera.center, `${path}.center`);
    number(camera.scale, `${path}.scale`, Number.MIN_VALUE);
}

/** Validate a detached JSON value. No renderer, loader or application callback runs here. */
function documentShape(value: SceneJsonValue): SceneDocument {
    const document = record(value, "$");
    fields(document, ["schemaVersion", "assets", "layers", "camera", "metadata"], "$");
    if (document.schemaVersion !== SCENE_SCHEMA_VERSION) {
        fail("$.schemaVersion", `expected ${SCENE_SCHEMA_VERSION}`);
    }
    const assetIds = new Set<string>();
    array(document.assets, "$.assets").forEach((value, i) => {
        const path = `$.assets[${i}]`;
        const asset = record(value, path);
        fields(asset, ["id", "src", "metadata"], path);
        id(asset.id, `${path}.id`, assetIds);
        if (Object.hasOwn(asset, "src")) {
            if (string(asset.src, `${path}.src`, 8192).trim().length === 0) {
                fail(`${path}.src`, "must not be empty or whitespace");
            }
        }
    });
    const layerIds = new Set<string>();
    const layerOrders = new Set<number>();
    const batchIds = new Set<string>();
    const itemIds = new Set<string>();
    array(document.layers, "$.layers").forEach((value, i) => {
        const path = `$.layers[${i}]`;
        const layer = record(value, path);
        fields(layer, ["id", "order", "batches", "metadata"], path);
        id(layer.id, `${path}.id`, layerIds);
        const order = number(layer.order, `${path}.order`);
        if (layerOrders.has(order)) {
            fail(`${path}.order`, "numeric layer orders must be unique");
        }
        layerOrders.add(order);
        array(layer.batches, `${path}.batches`).forEach((value, n) => {
            const at = `${path}.batches[${n}]`;
            const batch = record(value, at);
            choice(batch.kind, ["rect", "circle", "line", "text", "image", "path"], `${at}.kind`);
            const kind = batch.kind as SceneKind;
            fields(
                batch,
                ["id", "kind", "items", "clip", "hitTest", "metadata", ...(kind === "line" ? ["style"] : [])],
                at,
            );
            id(batch.id, `${at}.id`, batchIds);
            if (Object.hasOwn(batch, "clip")) {
                bounds(batch.clip, `${at}.clip`);
            }
            if (Object.hasOwn(batch, "hitTest")) {
                boolean(batch.hitTest, `${at}.hitTest`);
            }
            if (Object.hasOwn(batch, "style")) {
                style(batch.style, `${at}.style`, "line");
            }
            array(batch.items, `${at}.items`).forEach((value, j) =>
                item(value, kind, `${at}.items[${j}]`, itemIds, assetIds),
            );
        });
    });
    if (Object.hasOwn(document, "camera")) {
        validateSceneCamera(document.camera);
    }
    return document as unknown as SceneDocument;
}

/** Return a validated, detached snapshot; caller-defined migrations are opt-in. */
export function validateSceneDocument(input: unknown, options?: SceneReadOptions): SceneDocument {
    const limits = sceneLimits(options);
    let value = record(cloneSceneJson(input, limits), "$");
    const version = number(value.schemaVersion, "$.schemaVersion", 0);
    if (!Number.isSafeInteger(version) || version > SCENE_SCHEMA_VERSION) {
        fail("$.schemaVersion", `unsupported schema version ${version}`);
    }
    for (let current = version; current < SCENE_SCHEMA_VERSION; current++) {
        const migration = options?.migrations?.get(current);
        if (!migration) {
            fail("$.schemaVersion", `no migration registered for version ${current}`);
        }
        value = record(cloneSceneJson(migration(value), limits), "$");
        if (value.schemaVersion !== current + 1) {
            fail("$.schemaVersion", `migration from ${current} must produce version ${current + 1}`);
        }
    }
    return documentShape(value);
}

export function cloneCamera(camera: SceneCamera, limits: SceneLimits): SceneCamera {
    const value = cloneSceneJson(camera, limits);
    validateSceneCamera(value);
    return value as unknown as SceneCamera;
}
