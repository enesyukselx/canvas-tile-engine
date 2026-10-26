import { describe, expect, it } from "vitest";
import { Layer } from "../src/scene/Layer";

/** Canvas2D-shaped target: `save()` returns nothing, so the layer pairs it with `restore()`. */
function canvas2dContext() {
    const calls: string[] = [];
    return {
        calls,
        ctx: {
            save: () => void calls.push("save"),
            restore: () => void calls.push("restore"),
        },
    };
}

/** Skia-shaped target: `save()` returns the depth, which `restoreToCount` unwinds back to. */
function skiaContext() {
    const calls: string[] = [];
    let depth = 0;
    return {
        calls,
        depthAfter: () => depth,
        ctx: {
            save: () => {
                calls.push("save");
                return depth++;
            },
            restore: () => {
                calls.push("restore");
                depth--;
            },
            restoreToCount: (count: number) => {
                calls.push(`restoreToCount(${count})`);
                depth = count;
            },
        },
    };
}

describe("Layer", () => {
    it("draws callbacks in ascending layer order", () => {
        const layer = new Layer<{ ctx: { save(): void; restore(): void }; order: string[] }>();
        const order: string[] = [];

        layer.add(5, () => order.push("five"));
        layer.add(0, () => order.push("zero"));
        layer.add(2, () => order.push("two"));

        layer.drawAll({ ctx: canvas2dContext().ctx, order });

        expect(order).toEqual(["zero", "two", "five"]);
    });

    it("keeps registration order within a layer", () => {
        const layer = new Layer<{ ctx: { save(): void; restore(): void } }>();
        const order: string[] = [];

        layer.add(1, () => order.push("first"));
        layer.add(1, () => order.push("second"));

        layer.drawAll({ ctx: canvas2dContext().ctx });

        expect(order).toEqual(["first", "second"]);
    });

    it("wraps each callback in save/restore on a Canvas2D context", () => {
        const layer = new Layer<{ ctx: { save(): void; restore(): void } }>();
        const target = canvas2dContext();

        layer.add(0, () => target.calls.push("draw a"));
        layer.add(1, () => target.calls.push("draw b"));

        layer.drawAll({ ctx: target.ctx });

        expect(target.calls).toEqual(["save", "draw a", "restore", "save", "draw b", "restore"]);
    });

    it("restores to the save depth on a Skia canvas", () => {
        const layer = new Layer<{ ctx: ReturnType<typeof skiaContext>["ctx"] }>();
        const target = skiaContext();

        layer.add(0, () => target.calls.push("draw"));
        layer.drawAll({ ctx: target.ctx });

        expect(target.calls).toEqual(["save", "draw", "restoreToCount(0)"]);
    });

    it("unwinds saves a Skia callback forgot to pop", () => {
        const layer = new Layer<{ ctx: ReturnType<typeof skiaContext>["ctx"] }>();
        const target = skiaContext();

        // A custom draw function that saves twice and never restores.
        layer.add(0, ({ ctx }) => {
            ctx.save();
            ctx.save();
        });
        layer.add(1, () => target.calls.push("next layer"));

        layer.drawAll({ ctx: target.ctx });

        // The second layer still starts from depth 0, not from the leaked depth 3.
        expect(target.calls).toEqual([
            "save",
            "save",
            "save",
            "restoreToCount(0)",
            "save",
            "next layer",
            "restoreToCount(0)",
        ]);
        expect(target.depthAfter()).toBe(0);
    });

    it("removes a single callback by handle and leaves the rest", () => {
        const layer = new Layer<{ ctx: { save(): void; restore(): void } }>();
        const order: string[] = [];

        const handle = layer.add(1, () => order.push("removed"));
        layer.add(1, () => order.push("kept"));
        layer.remove(handle);
        layer.remove(handle); // no-op the second time

        layer.drawAll({ ctx: canvas2dContext().ctx });

        expect(order).toEqual(["kept"]);
    });

    it("clears one layer or all of them", () => {
        const layer = new Layer<{ ctx: { save(): void; restore(): void } }>();
        const order: string[] = [];

        layer.add(0, () => order.push("zero"));
        layer.add(1, () => order.push("one"));
        layer.clear(0);
        layer.drawAll({ ctx: canvas2dContext().ctx });
        expect(order).toEqual(["one"]);

        layer.clear();
        order.length = 0;
        layer.drawAll({ ctx: canvas2dContext().ctx });
        expect(order).toEqual([]);
    });
});

describe("Layer clipping", () => {
    const CLIP = { minX: 0, maxX: 4, minY: 0, maxY: 2 };

    function setup() {
        const events: string[] = [];
        const ctx = {
            save: () => void events.push("save"),
            restore: () => void events.push("restore"),
        };
        return { events, dc: { ctx } as never };
    }

    it("applies the clip before the callback and releases it after", () => {
        const { events, dc } = setup();
        const layers = new Layer<never>((_dc, clip) => {
            events.push(`clip:${clip.minX}-${clip.maxX}`);
            return () => void events.push("release");
        });

        layers.add(1, () => void events.push("draw"), CLIP);
        layers.drawAll(dc);

        // Inside the save/restore pair, so a context-stack clip unwinds itself
        expect(events).toEqual(["save", "clip:0-4", "draw", "release", "restore"]);
    });

    it("leaves an unclipped registration alone", () => {
        const { events, dc } = setup();
        const layers = new Layer<never>(() => void events.push("clip"));

        layers.add(1, () => void events.push("draw"));
        layers.drawAll(dc);

        expect(events).toEqual(["save", "draw", "restore"]);
    });

    it("draws unclipped when the renderer supplies no adapter", () => {
        const { events, dc } = setup();
        const layers = new Layer<never>();

        layers.add(1, () => void events.push("draw"), CLIP);
        layers.drawAll(dc);

        expect(events).toEqual(["save", "draw", "restore"]);
    });

    it("clips each registration independently", () => {
        const { events, dc } = setup();
        const layers = new Layer<never>((_dc, clip) => {
            events.push(`clip:${clip.maxX}`);
            return () => void events.push("release");
        });

        layers.add(1, () => void events.push("a"), { ...CLIP, maxX: 4 });
        layers.add(1, () => void events.push("b"));
        layers.add(2, () => void events.push("c"), { ...CLIP, maxX: 9 });
        layers.drawAll(dc);

        expect(events.filter((e) => e !== "save" && e !== "restore")).toEqual([
            "clip:4",
            "a",
            "release",
            "b",
            "clip:9",
            "c",
            "release",
        ]);
    });
});
