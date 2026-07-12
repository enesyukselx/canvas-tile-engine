import { describe, expect, it } from "vitest";
import { HitTester } from "../../src/modules/HitTester";
import type { DrawHandle } from "../../src/types";

const handle = (layer: number): DrawHandle => ({ id: Symbol("h"), layer });

describe("HitTester geometry", () => {
    it("hits a default rect inside its cell box and misses outside", () => {
        const ht = new HitTester();
        ht.register(handle(1), "rect", { x: 2, y: 3, size: 1 }, 1);

        // size 1, cell-center origin: box spans [1.5, 2.5] x [2.5, 3.5]
        expect(ht.hitTestFirst({ x: 2, y: 3 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 2.49, y: 3.49 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 2.51, y: 3 })).toBeUndefined();
        expect(ht.hitTestFirst({ x: 2, y: 3.51 })).toBeUndefined();
    });

    it("honors size and self-mode origin", () => {
        const ht = new HitTester();
        // self origin {0,0}: box spans [x, x+size]
        ht.register(handle(1), "rect", { x: 1, y: 1, size: 2, origin: { mode: "self", x: 0, y: 0 } }, 1);

        expect(ht.hitTestFirst({ x: 1.1, y: 1.1 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 2.9, y: 2.9 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 0.9, y: 1.5 })).toBeUndefined();
        expect(ht.hitTestFirst({ x: 3.1, y: 1.5 })).toBeUndefined();
    });

    it("inverse-rotates the point for rotated rects", () => {
        const ht = new HitTester();
        // size 1 at (0,0): box [-0.5, 0.5]^2, rotated 45 degrees around its center
        ht.register(handle(1), "rect", { x: 0, y: 0, size: 1, rotate: 45 }, 1);

        // On the x axis the rotated square reaches sqrt(2)/2 ~ 0.707
        expect(ht.hitTestFirst({ x: 0.68, y: 0 })).toBeDefined();
        // The unrotated corner (0.45, 0.45) is outside the rotated square
        expect(ht.hitTestFirst({ x: 0.45, y: 0.45 })).toBeUndefined();
    });

    it("tests circles by distance from the center", () => {
        const ht = new HitTester();
        ht.register(handle(1), "circle", { x: 0, y: 0, size: 1 }, 1);

        expect(ht.hitTestFirst({ x: 0.4, y: 0 })).toBeDefined();
        // Inside the bounding box but outside the disc
        expect(ht.hitTestFirst({ x: 0.4, y: 0.4 })).toBeUndefined();
    });

    it("uses the aspect-fit box for images (and the sprite frame when set)", () => {
        const ht = new HitTester();
        const wideImg = { width: 100, height: 50 };
        // size 2 at (0,0): outer box [-1, 1]^2; aspect 2 -> drawn box is 2 x 1
        ht.register(handle(1), "image", { x: 0, y: 0, size: 2, img: wideImg }, 1);

        expect(ht.hitTestFirst({ x: 0.9, y: 0 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 0, y: 0.7 })).toBeUndefined(); // above the fitted box

        // A square sprite frame restores the square box
        const ht2 = new HitTester();
        ht2.register(
            handle(1),
            "image",
            { x: 0, y: 0, size: 2, img: wideImg, sprite: { x: 0, y: 0, w: 50, h: 50 } },
            1,
        );
        expect(ht2.hitTestFirst({ x: 0, y: 0.7 })).toBeDefined();
    });

    it("duck-types Skia-style images whose width/height are methods", () => {
        const ht = new HitTester();
        const skiaImg = { width: () => 100, height: () => 50 };
        ht.register(handle(1), "image", { x: 0, y: 0, size: 2, img: skiaImg }, 1);

        expect(ht.hitTestFirst({ x: 0, y: 0.7 })).toBeUndefined();
        expect(ht.hitTestFirst({ x: 0.9, y: 0 })).toBeDefined();
    });
});

describe("HitTester ordering and filtering", () => {
    it("orders hits by layer, then registration, then item index", () => {
        const ht = new HitTester();
        const low = handle(1);
        const highA = handle(3);
        const highB = handle(3);
        ht.register(low, "rect", { x: 0, y: 0, size: 1 }, 1);
        ht.register(highA, "rect", { x: 0, y: 0, size: 1 }, 3);
        ht.register(
            highB,
            "rect",
            [
                { x: 0, y: 0, size: 1 },
                { x: 0, y: 0, size: 1 },
            ],
            3,
        );

        const hits = ht.hitTest({ x: 0, y: 0 });
        expect(hits).toHaveLength(4);
        // Layer 3 first; within it the later registration (highB), its later item first
        expect(hits[0]).toMatchObject({ handle: highB, index: 1, layer: 3 });
        expect(hits[1]).toMatchObject({ handle: highB, index: 0 });
        expect(hits[2]).toMatchObject({ handle: highA, index: 0 });
        expect(hits[3]).toMatchObject({ handle: low, layer: 1 });
    });

    it("filters by layer", () => {
        const ht = new HitTester();
        ht.register(handle(1), "rect", { x: 0, y: 0, size: 1 }, 1);
        ht.register(handle(3), "circle", { x: 0, y: 0, size: 1 }, 3);

        const hits = ht.hitTest({ x: 0, y: 0 }, { layer: 1 });
        expect(hits).toHaveLength(1);
        expect(hits[0].kind).toBe("rect");
    });

    it("forgets items on remove, clearLayer, and clear", () => {
        const ht = new HitTester();
        const a = handle(1);
        const b = handle(2);
        const c = handle(2);
        ht.register(a, "rect", { x: 0, y: 0 }, 1);
        ht.register(b, "rect", { x: 0, y: 0 }, 2);
        ht.register(c, "rect", { x: 0, y: 0 }, 2);

        ht.remove(a);
        expect(ht.hitTest({ x: 0, y: 0 })).toHaveLength(2);

        ht.clearLayer(2);
        expect(ht.hitTest({ x: 0, y: 0 })).toHaveLength(0);

        ht.register(a, "rect", { x: 0, y: 0 }, 1);
        ht.clear();
        expect(ht.hitTest({ x: 0, y: 0 })).toHaveLength(0);
    });
});

describe("HitTester large datasets (spatial index path)", () => {
    it("finds the right item among 600 and reports its original index", () => {
        const ht = new HitTester();
        // 600 rects on a row: item i sits at x = i * 2
        const items = Array.from({ length: 600 }, (_, i) => ({ x: i * 2, y: 0, size: 1 }));
        ht.register(handle(1), "rect", items, 1);

        const hit = ht.hitTestFirst({ x: 400, y: 0 });
        expect(hit).toBeDefined();
        expect(hit!.index).toBe(200);
        expect(ht.hitTestFirst({ x: 401, y: 0 })).toBeUndefined(); // between two items
    });

    it("does not miss items whose origin shifts the box away from the anchor", () => {
        const ht = new HitTester();
        const items = Array.from({ length: 600 }, (_, i) => ({
            x: i * 2,
            y: 0,
            size: 1,
            origin: { mode: "cell" as const, x: 1, y: 0.5 },
        }));
        // origin.x = 1 shifts each box half a cell right: box spans [x, x+1]
        ht.register(handle(1), "rect", items, 1);

        const hit = ht.hitTestFirst({ x: 400.9, y: 0 });
        expect(hit).toBeDefined();
        expect(hit!.index).toBe(200);
    });
});
