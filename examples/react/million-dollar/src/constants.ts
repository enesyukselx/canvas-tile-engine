import { gridToSize, type SpriteRect } from "@canvas-tile-engine/core";

// The 2005 original sold 1,000,000 pixels in 10x10 blocks: a 100x100 grid.
export const GRID = 100;
export const BLOCK_PX = 10;
export const SURFACE_COLOR = "#f5f5f4";

const { center, ...board } = gridToSize({
    columns: GRID,
    rows: GRID,
    cellSize: BLOCK_PX,
});

export const INITIAL_CENTER = center;

export const BOARD = board; // { size: { width, height }, scale }

// One runtime-generated sheet, 24px per block of frame resolution.
// Frame aspect ratios (2:1, 1:1, 3:1) must match the ad regions using them.
const U = 24;
export const SHEET_FRAMES: Record<LogoId, SpriteRect> = {
    acme: { x: 0, y: 0, w: 20 * U, h: 10 * U },
    tile: { x: 20 * U, y: 0, w: 10 * U, h: 10 * U },
    zoom: { x: 30 * U, y: 0, w: 30 * U, h: 10 * U },
};

const SHEET_W = 60 * U;
const SHEET_H = 10 * U;

export type LogoId = "acme" | "tile" | "zoom";

export type Ad = {
    name: string;
    url: string;
    /** Top-left block of the region. */
    x: number;
    y: number;
    /** Region size in blocks. Must match the logo frame's aspect ratio. */
    w: number;
    h: number;
    logo: LogoId;
};

/** Draws the three dummy advertiser logos onto an offscreen canvas. */
export function createLogoSheet(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = SHEET_W;
    canvas.height = SHEET_H;
    const ctx = canvas.getContext("2d")!;

    // ACME (2:1) — garish yellow banner, 2005 energy
    {
        const f = SHEET_FRAMES.acme;
        ctx.fillStyle = "#ffd400";
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.strokeStyle = "#dc2626";
        ctx.lineWidth = 12;
        ctx.strokeRect(f.x + 10, f.y + 10, f.w - 20, f.h - 20);
        ctx.fillStyle = "#dc2626";
        ctx.font = "900 104px sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("ACME", f.x + f.w / 2, f.y + 96);
        ctx.fillStyle = "#1f2937";
        ctx.font = "700 30px sans-serif";
        ctx.fillText("★ ROCKET SUPPLY CO. ★", f.x + f.w / 2, f.y + 182);
    }

    // TILECO (1:1) — navy square with a checker texture
    {
        const f = SHEET_FRAMES.tile;
        ctx.fillStyle = "#1e3a8a";
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.fillStyle = "#2563eb";
        const cell = U;
        for (let cy = 0; cy < 10; cy++) {
            for (let cx = 0; cx < 10; cx++) {
                if ((cx + cy) % 3 === 0) {
                    ctx.fillRect(f.x + cx * cell, f.y + cy * cell, cell, cell);
                }
            }
        }
        ctx.fillStyle = "rgba(15, 23, 42, 0.75)";
        ctx.fillRect(f.x + 24, f.y + 62, f.w - 48, 116);
        ctx.fillStyle = "#ffffff";
        ctx.font = "800 64px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("TILE", f.x + f.w / 2, f.y + 106);
        ctx.fillStyle = "#7dd3fc";
        ctx.font = "700 34px monospace";
        ctx.fillText("CO.", f.x + f.w / 2, f.y + 152);
    }

    // zoom.io (3:1) — hacker-green on black, dashed border
    {
        const f = SHEET_FRAMES.zoom;
        ctx.fillStyle = "#0a0a0a";
        ctx.fillRect(f.x, f.y, f.w, f.h);
        ctx.strokeStyle = "#a3e635";
        ctx.lineWidth = 8;
        ctx.setLineDash([18, 12]);
        ctx.strokeRect(f.x + 12, f.y + 12, f.w - 24, f.h - 24);
        ctx.setLineDash([]);
        ctx.fillStyle = "#a3e635";
        ctx.font = "700 96px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("zoom.io", f.x + f.w / 2, f.y + 100);
        ctx.fillStyle = "#e5e5e5";
        ctx.font = "600 28px monospace";
        ctx.fillText("PAN FASTER →", f.x + f.w / 2, f.y + 180);
    }

    return canvas;
}

export const ADS: Ad[] = [
    {
        name: "zoom.io",
        url: "https://example.com/zoom",
        x: 34,
        y: 2,
        w: 30,
        h: 10,
        logo: "zoom",
    },
    {
        name: "ACME Rocket Supply",
        url: "https://example.com/acme",
        x: 6,
        y: 14,
        w: 20,
        h: 10,
        logo: "acme",
    },
    {
        name: "TileCo",
        url: "https://example.com/tileco",
        x: 74,
        y: 10,
        w: 12,
        h: 12,
        logo: "tile",
    },
    {
        name: "TileCo",
        url: "https://example.com/tileco",
        x: 48,
        y: 22,
        w: 10,
        h: 10,
        logo: "tile",
    },
    {
        name: "ACME Rocket Supply",
        url: "https://example.com/acme",
        x: 62,
        y: 34,
        w: 16,
        h: 8,
        logo: "acme",
    },
    {
        name: "zoom.io",
        url: "https://example.com/zoom",
        x: 10,
        y: 44,
        w: 24,
        h: 8,
        logo: "zoom",
    },
    {
        name: "TileCo",
        url: "https://example.com/tileco",
        x: 40,
        y: 40,
        w: 8,
        h: 8,
        logo: "tile",
    },
    {
        name: "ACME Rocket Supply",
        url: "https://example.com/acme",
        x: 82,
        y: 52,
        w: 12,
        h: 6,
        logo: "acme",
    },
    {
        name: "zoom.io",
        url: "https://example.com/zoom",
        x: 52,
        y: 56,
        w: 18,
        h: 6,
        logo: "zoom",
    },
    {
        name: "TileCo",
        url: "https://example.com/tileco",
        x: 18,
        y: 62,
        w: 12,
        h: 12,
        logo: "tile",
    },
    {
        name: "ACME Rocket Supply",
        url: "https://example.com/acme",
        x: 44,
        y: 70,
        w: 20,
        h: 10,
        logo: "acme",
    },
    {
        name: "zoom.io",
        url: "https://example.com/zoom",
        x: 64,
        y: 78,
        w: 30,
        h: 10,
        logo: "zoom",
    },
    {
        name: "TileCo",
        url: "https://example.com/tileco",
        x: 8,
        y: 82,
        w: 6,
        h: 6,
        logo: "tile",
    },
    {
        name: "ACME Rocket Supply",
        url: "https://example.com/acme",
        x: 30,
        y: 88,
        w: 8,
        h: 4,
        logo: "acme",
    },
];
