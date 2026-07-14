import { describe, expect, it } from "vitest";
import { appendDashedSegment } from "../../src/utils/dash";

type Seg = { a: { x: number; y: number }; b: { x: number; y: number } };

function xs(segs: Seg[]): Array<[number, number]> {
    return segs.map((s) => [s.a.x, s.b.x]);
}

describe("appendDashedSegment", () => {
    it("tessellates a horizontal segment into on-intervals", () => {
        const out: Seg[] = [];
        // 24px long, pattern 8 on / 4 off -> [0,8], [12,20], gap [20,24]
        const phase = appendDashedSegment(out, { x: 0, y: 0 }, { x: 24, y: 0 }, [8, 4], 0);

        expect(xs(out)).toEqual([
            [0, 8],
            [12, 20],
        ]);
        expect(phase).toBe(0); // 24 % 12
    });

    it("carries the phase across polyline joints for a continuous pattern", () => {
        const out: Seg[] = [];
        // First segment ends mid-dash (10 of 12 consumed: 8 on + 2 gap)...
        let phase = appendDashedSegment(out, { x: 0, y: 0 }, { x: 10, y: 0 }, [8, 4], 0);
        expect(phase).toBe(10);
        // ...second segment finishes the gap (2px) before dashing again.
        phase = appendDashedSegment(out, { x: 10, y: 0 }, { x: 24, y: 0 }, [8, 4], phase);

        expect(xs(out)).toEqual([
            [0, 8],
            [12, 20],
        ]);
        expect(phase).toBe(0);
    });

    it("starts inside a gap when the phase says so", () => {
        const out: Seg[] = [];
        // Phase 9 = 1px into the gap; first dash starts after the remaining 3px.
        appendDashedSegment(out, { x: 0, y: 0 }, { x: 12, y: 0 }, [8, 4], 9);

        expect(xs(out)).toEqual([[3, 11]]);
    });

    it("handles diagonal segments in screen distance", () => {
        const out: Seg[] = [];
        // 3-4-5 triangle: 10px long diagonal, 5 on / 5 off.
        appendDashedSegment(out, { x: 0, y: 0 }, { x: 6, y: 8 }, [5, 5], 0);

        expect(out).toHaveLength(1);
        expect(out[0].a).toEqual({ x: 0, y: 0 });
        expect(out[0].b.x).toBeCloseTo(3);
        expect(out[0].b.y).toBeCloseTo(4);
    });

    it("ignores zero-length segments without touching the phase", () => {
        const out: Seg[] = [];
        const phase = appendDashedSegment(out, { x: 5, y: 5 }, { x: 5, y: 5 }, [8, 4], 7);

        expect(out).toHaveLength(0);
        expect(phase).toBe(7);
    });

    it("survives zero-length intervals inside the pattern", () => {
        const out: Seg[] = [];
        // [6, 0, 6, 4]: 6 on, no gap, 6 on, 4 off -> effectively 12 on / 4 off.
        appendDashedSegment(out, { x: 0, y: 0 }, { x: 16, y: 0 }, [6, 0, 6, 4], 0);

        expect(xs(out)).toEqual([
            [0, 6],
            [6, 12],
        ]);
    });
});
