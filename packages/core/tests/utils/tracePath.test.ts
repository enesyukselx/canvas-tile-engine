import { describe, expect, it } from "vitest";
import { traceCommands, traceRoundedPath, type CommandTraceTarget } from "../../src/utils/tracePath";
import type { Coords, PathCommand } from "../../src/types";

/**
 * Path sink that behaves like the strictest platform for each call: a
 * negative radius throws like a browser's `arc()` (IndexSizeError), and a
 * non-finite value throws where `@napi-rs/canvas` would abort the process.
 */
function strictSink() {
    const calls: string[] = [];
    const finite = (name: string, values: number[]) => {
        if (!values.every(Number.isFinite)) {
            throw new Error(`${name} got a non-finite value: ${values.join(", ")}`);
        }
    };
    const sink: CommandTraceTarget = {
        moveTo: (x, y) => void calls.push(`M ${x} ${y}`),
        lineTo: (x, y) => void calls.push(`L ${x} ${y}`),
        arc: (x, y, radius, start, end) => {
            finite("arc", [x, y, radius, start, end]);
            if (radius < 0) {
                throw new Error(`IndexSizeError: The radius provided (${radius}) is negative.`);
            }
            calls.push(`A ${x} ${y} ${radius}`);
        },
        quadraticCurveTo: (cpx, cpy, x, y) => void calls.push(`Q ${cpx} ${cpy} ${x} ${y}`),
        bezierCurveTo: (a, b, c, d, x, y) => void calls.push(`C ${a} ${b} ${c} ${d} ${x} ${y}`),
        closePath: () => void calls.push("Z"),
    };
    return { sink, calls };
}

const identity = (x: number, y: number): Coords => ({ x, y });

describe("traceCommands", () => {
    const slice = (arc: Partial<Extract<PathCommand, { type: "arc" }>>): PathCommand[] => [
        { type: "moveTo", x: 0, y: 0 },
        { type: "lineTo", x: 4, y: 0 },
        { type: "arc", x: 0, y: 0, radius: 4, startAngle: 0, endAngle: 90, ...arc },
        { type: "closePath" },
    ];

    it("traces a valid list, scaling the radius", () => {
        const { sink, calls } = strictSink();
        traceCommands(sink, slice({}), identity, 10);

        expect(calls).toEqual(["M 0 0", "L 4 0", "A 0 0 40", "Z"]);
    });

    // The renderers skip such a path through its null bounds; the tracer
    // agrees on its own, so a direct caller, or a command edited in place
    // after registration, can never make arc() throw or abort.
    it.each([
        ["a negative radius", { radius: -4 }],
        ["a NaN radius", { radius: NaN }],
        ["a NaN center", { x: NaN }],
        ["an infinite center", { y: Infinity }],
        ["a NaN angle", { startAngle: NaN }],
    ])("traces nothing for a list with %s", (_case, arc) => {
        const { sink, calls } = strictSink();

        expect(() => traceCommands(sink, slice(arc), identity, 10)).not.toThrow();
        expect(calls).toEqual([]);
    });

    it("skips an arc whose projection overflows, keeping the rest of the path", () => {
        const { sink, calls } = strictSink();
        // 1e308 is finite in world space; times the scale it is Infinity on screen
        const commands = slice({ x: 1e308 });

        expect(() => traceCommands(sink, commands, (x, y) => ({ x: x * 10, y: y * 10 }), 10)).not.toThrow();
        expect(calls).toEqual(["M 0 0", "L 40 0", "Z"]);
    });
});

describe("traceRoundedPath", () => {
    it("rounds corners with tangent arcs", () => {
        const { sink, calls } = strictSink();
        const square = [
            { x: 0, y: 0 },
            { x: 40, y: 0 },
            { x: 40, y: 40 },
            { x: 0, y: 40 },
        ];
        traceRoundedPath(sink, square, true, 5);

        expect(calls.filter((c) => c.startsWith("A"))).toHaveLength(4);
    });

    // cornerArc lets a NaN through, and a NaN arc center aborts Node on
    // @napi-rs/canvas. The corners next to the bad vertex join straight.
    it.each([
        ["closed", true],
        ["open", false],
    ])("never hands arc() a non-finite corner next to a NaN vertex (%s)", (_case, closed) => {
        const { sink, calls } = strictSink();
        const points = [
            { x: 0, y: 0 },
            { x: NaN, y: 0 },
            { x: 40, y: 40 },
            { x: 0, y: 40 },
            { x: -20, y: 20 },
        ];

        expect(() => traceRoundedPath(sink, points, closed, 5)).not.toThrow();
        // The corner opposite the bad vertex still rounds
        expect(calls.some((c) => c.startsWith("A"))).toBe(true);
    });
});
