import { describe, expect, it } from "vitest";
import { SpriteSheet } from "../../src/modules/SpriteSheet";

describe("SpriteSheet", () => {
    describe("constructor", () => {
        it("throws on non-positive frame dimensions", () => {
            expect(() => new SpriteSheet({ frameWidth: 0, frameHeight: 32 })).toThrow();
            expect(() => new SpriteSheet({ frameWidth: 32, frameHeight: -1 })).toThrow();
        });

        it("throws on invalid columns", () => {
            expect(() => new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 0 })).toThrow();
            expect(() => new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 2.5 })).toThrow();
        });
    });

    describe("frame", () => {
        it("maps (col, row) to pixel source rect", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32 });

            expect(sheet.frame(0, 0)).toEqual({ x: 0, y: 0, w: 32, h: 32 });
            expect(sheet.frame(3, 0)).toEqual({ x: 96, y: 0, w: 32, h: 32 });
            expect(sheet.frame(1, 2)).toEqual({ x: 32, y: 64, w: 32, h: 32 });
        });

        it("supports non-square frames", () => {
            const sheet = new SpriteSheet({ frameWidth: 48, frameHeight: 24 });

            expect(sheet.frame(2, 1)).toEqual({ x: 96, y: 24, w: 48, h: 24 });
        });

        it("applies margin and spacing", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32, margin: 2, spacing: 1 });

            expect(sheet.frame(0, 0)).toEqual({ x: 2, y: 2, w: 32, h: 32 });
            expect(sheet.frame(2, 1)).toEqual({ x: 2 + 2 * 33, y: 2 + 33, w: 32, h: 32 });
        });

        it("throws on negative positions", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32 });

            expect(() => sheet.frame(-1, 0)).toThrow();
            expect(() => sheet.frame(0, -1)).toThrow();
        });
    });

    describe("frameByIndex", () => {
        it("maps linear index left-to-right, top-to-bottom", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 5 });

            expect(sheet.frameByIndex(0)).toEqual(sheet.frame(0, 0));
            expect(sheet.frameByIndex(4)).toEqual(sheet.frame(4, 0));
            expect(sheet.frameByIndex(5)).toEqual(sheet.frame(0, 1));
            expect(sheet.frameByIndex(7)).toEqual(sheet.frame(2, 1));
        });

        it("throws without columns option", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32 });

            expect(() => sheet.frameByIndex(0)).toThrow();
        });

        it("throws on negative index", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32, columns: 5 });

            expect(() => sheet.frameByIndex(-1)).toThrow();
        });
    });

    describe("framesInRow", () => {
        it("returns consecutive frames of a row, inclusive", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32 });

            const frames = sheet.framesInRow(0, 0, 4);

            expect(frames).toHaveLength(5);
            expect(frames[0]).toEqual({ x: 0, y: 0, w: 32, h: 32 });
            expect(frames[4]).toEqual({ x: 128, y: 0, w: 32, h: 32 });
        });

        it("supports a single-frame range", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32 });

            expect(sheet.framesInRow(1, 2, 2)).toEqual([sheet.frame(2, 1)]);
        });

        it("throws when endCol < startCol", () => {
            const sheet = new SpriteSheet({ frameWidth: 32, frameHeight: 32 });

            expect(() => sheet.framesInRow(0, 3, 1)).toThrow();
        });
    });
});
