import type { Line, PathItem, Text } from "@canvas-tile-engine/core";

export type ShapeData = { name: string };

const star = (cx: number, cy: number, r: number) =>
    Array.from({ length: 5 }, (_, k) => {
        const a = ((-90 + k * 144) * Math.PI) / 180;
        return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
    });

/**
 * Every Path v2 capability in one scene. Top row: the `points` polyline form
 * (fill, closed, fillRule, cornerRadius, dashes, hairline min-tap). Bottom
 * row: the free-form `commands` form (curves, arcs, subpaths, holes). Every
 * item carries `data.name`, surfaced by the hit-test panel on click.
 */
export const pathItems: PathItem<ShapeData>[] = [
    // ── points form ─────────────────────────────────────────────────────────
    {
        points: [
            { x: 1, y: 1 },
            { x: 7, y: 1 },
            { x: 7, y: 5 },
            { x: 1, y: 5 },
        ],
        closed: true,
        style: {
            fillStyle: "#22c55e55",
            strokeStyle: "#16a34a",
            lineWidthPx: 2,
            cornerRadius: 0.6,
        },
        data: { name: "Filled zone — points + closed + cornerRadius" },
    },
    {
        points: star(11.5, 3, 2.4),
        style: {
            fillStyle: "#f9731688",
            strokeStyle: "#9a3412",
            lineWidthPx: 1.5,
        },
        data: { name: "Star, nonzero — center is filled and clickable" },
    },
    {
        points: star(17.5, 3, 2.4),
        fillRule: "evenodd",
        style: {
            fillStyle: "#a855f788",
            strokeStyle: "#6b21a8",
            lineWidthPx: 1.5,
        },
        data: {
            name: "Star, evenodd — center is a hole (click passes through)",
        },
    },
    {
        points: [
            { x: 21, y: 1 },
            { x: 26, y: 1 },
            { x: 26, y: 5 },
            { x: 21, y: 5 },
        ],
        closed: true,
        data: {
            name: "Hairline rect — 1px stroke, still tappable (8px min tap width)",
        },
    },
    {
        points: [
            { x: 1, y: 7.5 },
            { x: 4, y: 9.5 },
            { x: 7, y: 7.5 },
            { x: 10, y: 9.5 },
            { x: 13, y: 7.5 },
        ],
        style: {
            strokeStyle: "#0ea5e9",
            lineWidthPx: 4,
            lineDashPx: [10, 6],
            cornerRadius: 0.8,
        },
        data: { name: "Dashed route — px dash flows through rounded corners" },
    },
    {
        points: [
            { x: 15, y: 7.5 },
            { x: 18, y: 9.5 },
            { x: 21, y: 7.5 },
            { x: 24, y: 9.5 },
        ],
        style: {
            strokeStyle: "#facc15",
            lineWidth: 0.25,
            lineDash: [0.6, 0.3],
        },
        data: { name: "World-unit stroke & dash — scales with zoom" },
    },

    // ── commands form ───────────────────────────────────────────────────────
    {
        commands: [
            { type: "moveTo", x: 1, y: 15 },
            { type: "lineTo", x: 3, y: 15 },
            { type: "quadraticCurveTo", cpx: 6, cpy: 15, x: 6, y: 12.5 },
            {
                type: "bezierCurveTo",
                cp1x: 6,
                cp1y: 11,
                cp2x: 9,
                cp2y: 11,
                x: 9,
                y: 12.5,
            },
            { type: "quadraticCurveTo", cpx: 9, cpy: 15, x: 12, y: 15 },
        ],
        style: { strokeStyle: "#e11d48", lineWidthPx: 4 },
        data: {
            name: "Metro line — quadratic + bezier curves (hit the curve, not the chord)",
        },
    },
    {
        commands: [
            {
                type: "arc",
                x: 15,
                y: 13.5,
                radius: 2,
                startAngle: 0,
                endAngle: 360,
            },
        ],
        style: {
            fillStyle: "#38bdf866",
            strokeStyle: "#0284c7",
            lineWidthPx: 2,
        },
        data: { name: "Circle — a single 360° arc command" },
    },
    {
        commands: [
            { type: "moveTo", x: 19, y: 11.5 },
            { type: "lineTo", x: 25, y: 11.5 },
            { type: "lineTo", x: 25, y: 16 },
            { type: "lineTo", x: 19, y: 16 },
            { type: "closePath" },
            // moveTo first: without it the arc would draw a visible connecting
            // line from the outer ring (Canvas2D semantics). Then a ccw inner
            // ring -> opposite winding -> a real hole under nonzero.
            { type: "moveTo", x: 23.3, y: 13.75 },
            {
                type: "arc",
                x: 22,
                y: 13.75,
                radius: 1.3,
                startAngle: 0,
                endAngle: 360,
                ccw: true,
            },
        ],
        style: {
            fillStyle: "#94a3b855",
            strokeStyle: "#64748b",
            lineWidthPx: 1.5,
        },
        data: {
            name: "Plaza with a hole — nonzero, inner ring wound opposite",
        },
    },
    {
        commands: [
            { type: "moveTo", x: 1, y: 17.5 },
            { type: "lineTo", x: 6, y: 17.5 },
            { type: "lineTo", x: 6, y: 21.5 },
            { type: "lineTo", x: 1, y: 21.5 },
            { type: "closePath" },
            { type: "moveTo", x: 2.5, y: 18.5 },
            { type: "lineTo", x: 4.5, y: 18.5 },
            { type: "lineTo", x: 4.5, y: 20.5 },
            { type: "lineTo", x: 2.5, y: 20.5 },
            { type: "closePath" },
        ],
        fillRule: "evenodd",
        style: {
            fillStyle: "#f472b655",
            strokeStyle: "#be185d",
            lineWidthPx: 1.5,
        },
        data: {
            name: "Evenodd hole — same-direction rings, overlap punches through",
        },
    },
    {
        commands: [
            { type: "moveTo", x: 10.5, y: 19.5 },
            {
                type: "arc",
                x: 10.5,
                y: 19.5,
                radius: 2,
                startAngle: 35,
                endAngle: 325,
            },
            { type: "closePath" },
        ],
        style: {
            fillStyle: "#fbbf24cc",
            strokeStyle: "#b45309",
            lineWidthPx: 2,
        },
        data: { name: "Pac-Man — partial arc + closePath back to the center" },
    },
    {
        // A curved balcony band: an annular sector. The outer arc sweeps
        // over the top (y-down: 270° = up), the inner arc returns ccw at a
        // smaller radius (the arc command auto-connects them), closePath seals
        // the second end. Clicks land only on the band itself.
        commands: [
            {
                type: "arc",
                x: 37.5,
                y: 14,
                radius: 3.4,
                startAngle: 150,
                endAngle: 390,
            },
            {
                type: "arc",
                x: 37.5,
                y: 14,
                radius: 2.1,
                startAngle: 390,
                endAngle: 150,
                ccw: true,
            },
            { type: "closePath" },
        ],
        style: {
            fillStyle: "#f9731655",
            strokeStyle: "#ea580c",
            lineWidthPx: 2,
        },
        data: {
            name: "Balcony band — annular sector (two arcs + closePath)",
        },
    },
];

export const lineItems: Line<ShapeData>[] = [
    {
        from: { x: 15, y: 18 },
        to: { x: 19, y: 21 },
        data: { name: "Line A — segments are hit-testable too" },
    },
    {
        from: { x: 19, y: 21 },
        to: { x: 23, y: 18 },
        data: { name: "Line B — with its own data payload" },
    },
];

export const labelItems: Text[] = [
    {
        x: 1.2,
        y: 0.2,
        text: "points form",
        fontPx: 13,
        style: { fillStyle: "#94a3b8", textAlign: "left" },
    },
    {
        x: 1.2,
        y: 10.8,
        text: "commands form",
        fontPx: 13,
        style: { fillStyle: "#94a3b8", textAlign: "left" },
    },
];
