import { describe, expect, it } from "vitest";
import { decodeGid, GID_FLIP_D, GID_FLIP_H, GID_FLIP_V } from "../src/gid";

describe("decodeGid", () => {
    it("passes plain GIDs through untouched", () => {
        expect(decodeGid(0)).toEqual({ gid: 0, flipX: false, flipY: false, rotate: 0 });
        expect(decodeGid(17)).toEqual({ gid: 17, flipX: false, flipY: false, rotate: 0 });
    });

    it("maps the 8 orientations to engine flip/rotate (flip-before-rotate order)", () => {
        const g = 5;
        expect(decodeGid(g)).toEqual({ gid: g, flipX: false, flipY: false, rotate: 0 });
        expect(decodeGid((g | GID_FLIP_H) >>> 0)).toEqual({ gid: g, flipX: true, flipY: false, rotate: 0 });
        expect(decodeGid((g | GID_FLIP_V) >>> 0)).toEqual({ gid: g, flipX: false, flipY: true, rotate: 0 });
        expect(decodeGid((g | GID_FLIP_H | GID_FLIP_V) >>> 0)).toEqual({
            gid: g,
            flipX: true,
            flipY: true,
            rotate: 0,
        });
        expect(decodeGid((g | GID_FLIP_D) >>> 0)).toEqual({ gid: g, flipX: false, flipY: true, rotate: 90 });
        expect(decodeGid((g | GID_FLIP_D | GID_FLIP_H) >>> 0)).toEqual({
            gid: g,
            flipX: false,
            flipY: false,
            rotate: 90,
        });
        expect(decodeGid((g | GID_FLIP_D | GID_FLIP_V) >>> 0)).toEqual({
            gid: g,
            flipX: false,
            flipY: false,
            rotate: 270,
        });
        expect(decodeGid((g | GID_FLIP_D | GID_FLIP_H | GID_FLIP_V) >>> 0)).toEqual({
            gid: g,
            flipX: true,
            flipY: false,
            rotate: 90,
        });
    });

    it("handles the sign bit correctly for GIDs stored as unsigned 32-bit values", () => {
        // H-flag GIDs exceed 2^31; JSON writes them as large positive numbers.
        expect(decodeGid(2147483653)).toEqual({ gid: 5, flipX: true, flipY: false, rotate: 0 });
    });
});
