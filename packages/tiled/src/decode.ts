import { gunzipSync, unzlibSync } from "fflate";
import type { TmjLayer } from "./types";

/** Base64 → bytes without assuming Node or DOM globals exist. */
function base64ToBytes(b64: string): Uint8Array {
    const clean = b64.replace(/\s+/g, "");
    if (typeof Buffer !== "undefined") {
        const buf = Buffer.from(clean, "base64");
        return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    }
    const bin = atob(clean);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

/**
 * Decode a tile layer's `data` into an array of raw GIDs (flip bits intact).
 * Supports the v1 subset: plain array (csv), base64, base64+zlib,
 * base64+gzip. zstd and chunked (infinite) layers reject with actionable
 * messages.
 */
export function decodeLayerData(layer: TmjLayer, expectedLength: number): Uint32Array {
    const name = layer.name ?? "(unnamed)";
    if (layer.chunks !== undefined) {
        throw new Error(
            `@canvas-tile-engine/tiled: layer "${name}" uses chunked data (infinite map). ` +
                `Infinite maps are not supported — convert the map to a fixed size in Tiled (Map > Resize Map).`,
        );
    }
    const data = layer.data;
    if (data === undefined) {
        throw new Error(`@canvas-tile-engine/tiled: tile layer "${name}" has no data.`);
    }

    let gids: Uint32Array;
    if (Array.isArray(data)) {
        gids = Uint32Array.from(data);
    } else {
        const compression = layer.compression ?? "";
        if (compression === "zstd") {
            throw new Error(
                `@canvas-tile-engine/tiled: layer "${name}" uses zstd compression, which is not supported. ` +
                    `Re-export the map with zlib, gzip, or CSV tile layer data.`,
            );
        }
        let bytes = base64ToBytes(data);
        if (compression === "zlib") bytes = unzlibSync(bytes);
        else if (compression === "gzip") bytes = gunzipSync(bytes);
        else if (compression !== "") {
            throw new Error(`@canvas-tile-engine/tiled: layer "${name}" uses unknown compression "${compression}".`);
        }
        if (bytes.byteLength % 4 !== 0) {
            throw new Error(`@canvas-tile-engine/tiled: layer "${name}" data is not a whole number of 32-bit GIDs.`);
        }
        // GIDs are little-endian u32s; read via DataView so byte order is
        // explicit regardless of platform endianness.
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        gids = new Uint32Array(bytes.byteLength / 4);
        for (let i = 0; i < gids.length; i++) gids[i] = view.getUint32(i * 4, true);
    }

    if (gids.length !== expectedLength) {
        throw new Error(
            `@canvas-tile-engine/tiled: layer "${name}" has ${gids.length} tiles, expected ${expectedLength} (width * height).`,
        );
    }
    return gids;
}
