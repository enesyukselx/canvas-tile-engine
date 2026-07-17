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

    it("returns the original item so attached data survives, typed via the TData param", () => {
        const ht = new HitTester();
        const tile = { x: 0, y: 0, size: 1, data: { id: "castle", hp: 42 } };
        ht.register(handle(1), "rect", tile, 1);

        const hit = ht.hitTestFirst<{ id: string; hp: number }>({ x: 0, y: 0 });
        expect(hit?.item).toBe(tile);
        expect(hit?.item.data?.id).toBe("castle");
        expect(hit?.item.data?.hp).toBe(42);
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

describe("HitTester non-square rects", () => {
    it("uses width/height boxes with cell-center origin", () => {
        const ht = new HitTester();
        // cell origin: box spans [0,4] x [1,3]
        ht.register(handle(1), "rect", { x: 2, y: 2, width: 4, height: 2 }, 1);

        expect(ht.hitTestFirst({ x: 0.1, y: 1.1 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 3.9, y: 2.9 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 0.1, y: 0.9 })).toBeUndefined(); // above the box
        expect(ht.hitTestFirst({ x: 4.1, y: 2 })).toBeUndefined(); // right of the box
    });

    it("anchors per axis with self-mode origin", () => {
        const ht = new HitTester();
        // self {0,0}: box spans [1,3] x [1,2]
        ht.register(handle(1), "rect", { x: 1, y: 1, width: 2, height: 1, origin: { mode: "self", x: 0, y: 0 } }, 1);

        expect(ht.hitTestFirst({ x: 2.9, y: 1.9 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 2.9, y: 2.1 })).toBeUndefined(); // below the 1-high box
    });

    it("inverse-rotates against the non-square box", () => {
        const ht = new HitTester();
        // 2x1 box at origin, rotated 90 degrees: now effectively 1x2
        ht.register(handle(1), "rect", { x: 0, y: 0, width: 2, height: 1, rotate: 90 }, 1);

        expect(ht.hitTestFirst({ x: 0, y: 0.9 })).toBeDefined(); // tall now
        expect(ht.hitTestFirst({ x: 0.9, y: 0 })).toBeUndefined(); // no longer wide
    });

    it("pads spatial-index queries with the max per-axis extent", () => {
        const ht = new HitTester();
        // 600 wide bars: item i anchored at x = i * 10, box spans [i*10 - 4, i*10 + 4]
        const items = Array.from({ length: 600 }, (_, i) => ({ x: i * 10, y: 0, width: 8, height: 1 }));
        ht.register(handle(1), "rect", items, 1);

        const hit = ht.hitTestFirst({ x: 2003.9, y: 0 }); // far edge of item 200's box
        expect(hit).toBeDefined();
        expect(hit!.index).toBe(200);
        expect(ht.hitTestFirst({ x: 2004.1, y: 0 })).toBeUndefined();
    });
});

describe("HitTester padding", () => {
    it("expands circles by the padding radius", () => {
        const ht = new HitTester();
        // Station-dot scenario: drawn small, hit area kept generous
        ht.register(handle(1), "circle", { x: 0, y: 0, size: 0.95 }, 1);

        // 1.0 from the center, radius is 0.475
        expect(ht.hitTestFirst({ x: 1, y: 0 })).toBeUndefined();
        // padding 0.625 -> effective reach 1.1
        expect(ht.hitTestFirst({ x: 1, y: 0 }, { padding: 0.625 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 1.15, y: 0 }, { padding: 0.625 })).toBeUndefined();
    });

    it("expands rect boxes on every side", () => {
        const ht = new HitTester();
        // size 1, cell-center origin: box spans [1.5, 2.5] x [2.5, 3.5]
        ht.register(handle(1), "rect", { x: 2, y: 3, size: 1 }, 1);

        expect(ht.hitTestFirst({ x: 2.7, y: 3 })).toBeUndefined();
        expect(ht.hitTestFirst({ x: 2.7, y: 3 }, { padding: 0.25 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 1.3, y: 2.3 }, { padding: 0.25 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 2.8, y: 3 }, { padding: 0.25 })).toBeUndefined();
    });

    it("expands rotated rects in their rotated frame", () => {
        const ht = new HitTester();
        ht.register(handle(1), "rect", { x: 0, y: 0, size: 1, rotate: 45 }, 1);

        // Beyond the rotated square's ~0.707 reach on the x axis...
        expect(ht.hitTestFirst({ x: 0.9, y: 0 })).toBeUndefined();
        // ...but inside once each side moves out by 0.2 (reach ~0.99)
        expect(ht.hitTestFirst({ x: 0.9, y: 0 }, { padding: 0.2 })).toBeDefined();
    });

    it("treats negative padding as 0", () => {
        const ht = new HitTester();
        ht.register(handle(1), "circle", { x: 0, y: 0, size: 1 }, 1);

        expect(ht.hitTestFirst({ x: 0.4, y: 0 }, { padding: -5 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 0.6, y: 0 }, { padding: -5 })).toBeUndefined();
    });

    it("also expands the spatial-index query on the 500+ item path", () => {
        const ht = new HitTester();
        const items = Array.from({ length: 600 }, (_, i) => ({ x: i, y: 0, size: 0.2 }));
        ht.register(handle(1), "circle", items, 1);

        // 4 units above item 10: without widening the query by the padding,
        // the default pad (0.5 + maxSize) would not even surface it as a
        // candidate, let alone hit it
        expect(ht.hitTestFirst({ x: 10, y: 4 })).toBeUndefined();
        const hit = ht.hitTestFirst({ x: 10, y: 4 }, { padding: 4 });
        expect(hit).toBeDefined();
        expect(hit!.index).toBe(10);
    });
});

describe("HitTester paths", () => {
    // Scale 40 px/cell: an 8px-wide stroke covers 0.1 world units each side.
    const scaled = () => new HitTester(() => 40);

    it("hits an unfilled path on the stroke, not beside it", () => {
        const ht = scaled();
        const points = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
        ];
        ht.register(handle(1), "path", { points, style: { strokeStyle: "red", lineWidthPx: 8 } }, 1);

        expect(ht.hitTestFirst({ x: 2, y: 0.05 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 2, y: 0.2 })).toBeUndefined();
        expect(ht.hitTestFirst({ x: -0.2, y: 0 })).toBeUndefined(); // beyond the endpoint
    });

    it("includes the closing segment when closed", () => {
        const points = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ];
        const open = scaled();
        open.register(handle(1), "path", { points, style: { strokeStyle: "red", lineWidthPx: 8 } }, 1);
        expect(open.hitTestFirst({ x: 0, y: 2 })).toBeUndefined();

        const closed = scaled();
        closed.register(handle(1), "path", { points, closed: true, style: { strokeStyle: "red", lineWidthPx: 8 } }, 1);
        expect(closed.hitTestFirst({ x: 0, y: 2 })).toBeDefined();
        // Interior stays a miss without a fill
        expect(closed.hitTestFirst({ x: 2, y: 2 })).toBeUndefined();
    });

    it("hits a filled path on its interior", () => {
        const ht = scaled();
        const points = [
            { x: 0, y: 0 },
            { x: 4, y: 0 },
            { x: 4, y: 4 },
            { x: 0, y: 4 },
        ];
        ht.register(handle(1), "path", { points, style: { fillStyle: "green" }, data: { id: "zone" } }, 1);

        const hit = ht.hitTestFirst<{ id: string }>({ x: 2, y: 2 });
        expect(hit?.kind).toBe("path");
        expect(hit?.item.data?.id).toBe("zone");
        expect(ht.hitTestFirst({ x: 5, y: 5 })).toBeUndefined();
    });

    it("applies the item's fill rule on self-intersecting outlines", () => {
        // Pentagram: the center winds twice, so nonzero fills it and evenodd does not.
        const star = Array.from({ length: 5 }, (_, k) => {
            const angle = ((-90 + k * 144) * Math.PI) / 180;
            return { x: 2 * Math.cos(angle), y: 2 * Math.sin(angle) };
        });
        const nonzero = scaled();
        nonzero.register(handle(1), "path", { points: star, style: { fillStyle: "red" } }, 1);
        expect(nonzero.hitTestFirst({ x: 0, y: 0 })).toBeDefined();

        const evenodd = scaled();
        evenodd.register(handle(1), "path", { points: star, fillRule: "evenodd", style: { fillStyle: "red" } }, 1);
        expect(evenodd.hitTestFirst({ x: 0, y: 0 })).toBeUndefined();
        // The star tips are single-winding and hit under both rules
        expect(evenodd.hitTestFirst({ x: 0, y: -1.8 })).toBeDefined();
    });

    it("keeps hairline strokes tappable via the minimum tap width", () => {
        const ht = scaled();
        // No style: 1px hairline, but the hit test treats it as 8px wide
        ht.register(
            handle(1),
            "path",
            {
                points: [
                    { x: 0, y: 0 },
                    { x: 4, y: 0 },
                ],
            },
            1,
        );

        expect(ht.hitTestFirst({ x: 2, y: 0.09 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 2, y: 0.11 })).toBeUndefined();
    });

    it("expands the stroke threshold by world padding", () => {
        const ht = scaled();
        ht.register(
            handle(1),
            "path",
            {
                points: [
                    { x: 0, y: 0 },
                    { x: 4, y: 0 },
                ],
            },
            1,
        );

        expect(ht.hitTestFirst({ x: 2, y: 0.5 })).toBeUndefined();
        expect(ht.hitTestFirst({ x: 2, y: 0.5 }, { padding: 0.45 })).toBeDefined();
    });
});

describe("HitTester lines", () => {
    it("hits segments within half the stroke width and carries data", () => {
        const ht = new HitTester(() => 40);
        ht.register(handle(1), "line", [{ from: { x: 0, y: 0 }, to: { x: 3, y: 0 }, data: { id: "edge" } }], 1, {
            strokeStyle: "blue",
            lineWidthPx: 8,
        });

        const hit = ht.hitTestFirst<{ id: string }>({ x: 1.5, y: 0.05 });
        expect(hit?.kind).toBe("line");
        expect(hit?.item.data?.id).toBe("edge");
        expect(ht.hitTestFirst({ x: 1.5, y: 0.3 })).toBeUndefined();
    });

    it("linear-scans large line/path entries instead of the anchor index", () => {
        const ht = new HitTester(() => 40);
        const items = Array.from({ length: 600 }, (_, i) => ({
            from: { x: i * 2, y: 0 },
            to: { x: i * 2, y: 1 },
        }));
        ht.register(handle(1), "line", items, 1);

        const hit = ht.hitTestFirst({ x: 1000, y: 0.5 });
        expect(hit).toBeDefined();
        expect(hit?.index).toBe(500);
    });
});

describe("HitTester rounded corners", () => {
    // Scale 40; cornerRadius 1 world unit -> the corner arc of the square
    // (0,0)-(4,0)-(4,4)-(0,4) at vertex (0,0) is centered at (1,1), r=1.
    const points = [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 0, y: 4 },
    ];

    it("misses the cut-off sharp-corner region of a rounded filled path", () => {
        const ht = new HitTester(() => 40);
        ht.register(handle(1), "path", { points, closed: true, style: { fillStyle: "red", cornerRadius: 1 } }, 1);

        // Inside the sharp square but outside the rounded outline
        expect(ht.hitTestFirst({ x: 0.08, y: 0.08 })).toBeUndefined();
        // Inside the rounded outline
        expect(ht.hitTestFirst({ x: 1, y: 1 })).toBeDefined();
        expect(ht.hitTestFirst({ x: 2, y: 2 })).toBeDefined();
        // Edge midpoints are untouched by rounding
        expect(ht.hitTestFirst({ x: 2, y: 0.05 })).toBeDefined();
    });

    it("hits the arc itself on a rounded unfilled path, not the sharp corner", () => {
        const ht = new HitTester(() => 40);
        ht.register(
            handle(1),
            "path",
            { points, closed: true, style: { strokeStyle: "red", lineWidthPx: 8, cornerRadius: 1 } },
            1,
        );

        // The sharp vertex sits ~0.41 world units from the arc; the stroke
        // threshold is 0.1, so it no longer hits.
        expect(ht.hitTestFirst({ x: 0, y: 0 })).toBeUndefined();
        // A point on the arc (45deg around the corner center) hits.
        const onArc = { x: 1 - Math.SQRT1_2, y: 1 - Math.SQRT1_2 };
        expect(ht.hitTestFirst(onArc)).toBeDefined();
    });
});
