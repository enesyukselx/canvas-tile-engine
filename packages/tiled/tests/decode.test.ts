import { describe, expect, it } from "vitest";
import { zlibSync, gzipSync } from "fflate";
import { decodeLayerData } from "../src/decode";
import type { TmjLayer } from "../src/types";

const GIDS = [1, 0, 2, 2147483653, 0, 3]; // includes an H-flipped GID > 2^31

function gidBytes(gids: number[]): Uint8Array {
    const bytes = new Uint8Array(gids.length * 4);
    const view = new DataView(bytes.buffer);
    gids.forEach((g, i) => view.setUint32(i * 4, g, true));
    return bytes;
}

function toBase64(bytes: Uint8Array): string {
    return Buffer.from(bytes).toString("base64");
}

function layer(partial: Partial<TmjLayer>): TmjLayer {
    return { type: "tilelayer", name: "t", ...partial };
}

describe("decodeLayerData", () => {
    it("reads plain (csv) arrays", () => {
        const out = decodeLayerData(layer({ data: GIDS }), GIDS.length);
        expect(Array.from(out)).toEqual(GIDS);
    });

    it("reads base64 without compression", () => {
        const out = decodeLayerData(layer({ data: toBase64(gidBytes(GIDS)), encoding: "base64" }), GIDS.length);
        expect(Array.from(out)).toEqual(GIDS);
    });

    it("reads base64 + zlib", () => {
        const data = toBase64(zlibSync(gidBytes(GIDS)));
        const out = decodeLayerData(layer({ data, encoding: "base64", compression: "zlib" }), GIDS.length);
        expect(Array.from(out)).toEqual(GIDS);
    });

    it("reads base64 + gzip", () => {
        const data = toBase64(gzipSync(gidBytes(GIDS)));
        const out = decodeLayerData(layer({ data, encoding: "base64", compression: "gzip" }), GIDS.length);
        expect(Array.from(out)).toEqual(GIDS);
    });

    it("rejects zstd with an actionable message", () => {
        expect(() => decodeLayerData(layer({ data: "AAAA", encoding: "base64", compression: "zstd" }), 1)).toThrow(
            /zstd.*Re-export/s,
        );
    });

    it("rejects chunked (infinite) layers", () => {
        expect(() => decodeLayerData(layer({ chunks: [] }), 1)).toThrow(/infinite/i);
    });

    it("rejects length mismatches", () => {
        expect(() => decodeLayerData(layer({ data: [1, 2, 3] }), 4)).toThrow(/expected 4/);
    });
});
