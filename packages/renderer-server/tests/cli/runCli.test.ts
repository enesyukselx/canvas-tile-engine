import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadImage } from "@napi-rs/canvas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EXIT_FAILURE, EXIT_OK, EXIT_USAGE, runCli } from "../../src/cli/runCli";

const FONT = fileURLToPath(new URL("../fixtures/Roboto-Regular.ttf", import.meta.url));

const BOARD = `
export const config = { scale: 40, size: { width: 200, height: 120 }, backgroundColor: "#0f172a" };
export const center = { x: 1.5, y: 1.5 };
export function draw(engine) {
    const cells = [];
    for (let x = 0; x < 4; x++) for (let y = 0; y < 4; y++) {
        cells.push({ x, y, size: 0.9, style: { fillStyle: (x + y) % 2 ? "#22c55e" : "#3b82f6" } });
    }
    engine.drawRect(cells, 1);
}
`;

const MODULES: Record<string, string> = {
    "board.mjs": BOARD,
    "default-export.mjs": `
export default {
    config: { scale: 20, size: { width: 60, height: 40 } },
    center: { x: 3, y: 4 },
    draw: (engine) => engine.drawRect({ x: 3, y: 4, size: 1, style: { fillStyle: "#f00" } }, 1),
};
`,
    "camera-in-draw.mjs": `
export const config = { scale: 10, size: { width: 50, height: 50 } };
export function draw(engine) { engine.setCenter({ x: 10, y: 10 }); }
`,
    "bounded.mjs": `
export const config = { scale: 10, size: { width: 20, height: 20 }, bounds: { minX: 0, maxX: 10, minY: 0, maxY: 10 } };
export const center = { x: -5, y: -5 };
`,
    "limits.mjs": `export const config = { scale: 40, minScale: 30, maxScale: 50, size: { width: 20, height: 20 } };`,
    "aligned.mjs": `
export const config = { scale: 10, size: { width: 40, height: 40 }, gridAligned: true };
export const center = { x: 1.2, y: 1.2 };
`,
    "responsive.mjs": `
export const config = { scale: 10, size: { width: 40, height: 40 }, responsive: "fill" };
export const center = { x: 3, y: 3 };
export function draw(engine) { engine.drawRect({ x: 3, y: 3, size: 1, style: { fillStyle: "#fff" } }, 1); }
`,
    "visible-in-draw.mjs": `
export const config = { scale: 10, size: { width: 40, height: 40 } };
export function draw(engine) {
    globalThis.__cteRenderSeen = { center: engine.getCenter(), scale: engine.getScale(), size: engine.getSize() };
}
`,
    "with-options.mjs": `
export const config = { scale: 10, size: { width: 20, height: 20 } };
export const pixelRatio = 2;
export const quality = 50;
`,
    "default-draw.mjs": `
export const config = { scale: 10, size: { width: 20, height: 20 } };
export default function draw(engine) { engine.drawRect({ x: 0, y: 0, size: 1 }, 1); }
`,
    "async-draw.mjs": `
export const config = { scale: 10, size: { width: 20, height: 20 } };
export async function draw(engine) {
    await new Promise((resolve) => setTimeout(resolve, 1));
    engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#fff" } }, 1);
}
`,
    "no-config.mjs": `export const draw = () => {};`,
    "bad-draw.mjs": `export const config = { scale: 10, size: { width: 20, height: 20 } }; export const draw = 5;`,
    "bad-center.mjs": `export const config = { scale: 10, size: { width: 20, height: 20 } }; export const center = { x: "1", y: 2 };`,
    "invalid-config.mjs": `export const config = { scale: -1, size: { width: 20, height: 20 } };`,
    "throws.mjs": `
export const config = { scale: 10, size: { width: 20, height: 20 } };
export function draw() { throw new Error("boom from draw"); }
`,
    "syntax-error.mjs": `export const config = {`,
};

let dir: string;

beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cte-render-"));
    for (const [name, source] of Object.entries(MODULES)) {
        writeFileSync(join(dir, name), source);
    }
});

afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
});

async function run(...argv: string[]) {
    let stdout = "";
    let stderr = "";
    const code = await runCli(argv, {
        cwd: dir,
        stdout: (text) => {
            stdout += text;
        },
        stderr: (text) => {
            stderr += text;
        },
    });
    return { code, stdout, stderr };
}

async function imageSize(path: string) {
    const image = await loadImage(readFileSync(path));
    return { width: image.width, height: image.height };
}

describe("cte-render", () => {
    it("renders a module's named exports to a PNG next to the working directory", async () => {
        const result = await run("board.mjs");

        expect(result).toMatchObject({ code: EXIT_OK, stderr: "" });
        const out = join(dir, "board.png");
        expect(readFileSync(out).subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect(await imageSize(out)).toEqual({ width: 200, height: 120 });
        expect(result.stdout).toBe(
            [
                `Wrote ${out} (200x120 px, png)`,
                "Center (1.5, 1.5), scale 40 px per unit (limits 20 to 80)",
                "Visible x -1 to 4, y 0 to 3 (item space: integers are cell centers)",
                "",
            ].join("\n"),
        );
    });

    it("accepts a default-exported scene object", async () => {
        const result = await run("default-export.mjs", "-o", "out/default.png");

        expect(result.code).toBe(EXIT_OK);
        expect(result.stdout).toContain("Center (3, 4), scale 20");
        expect(await imageSize(join(dir, "out/default.png"))).toEqual({ width: 60, height: 40 });
    });

    it("awaits an async draw", async () => {
        const plain = await run("async-draw.mjs", "-o", "async.png");

        expect(plain.code).toBe(EXIT_OK);
        const image = await loadImage(readFileSync(join(dir, "async.png")));
        expect(image.width).toBe(20);
    });

    it("draws the grid and the coordinate overlay only when asked", async () => {
        await run("board.mjs", "-o", "plain.png");
        await run("board.mjs", "-o", "grid.png", "--grid");
        await run("board.mjs", "-o", "coords.png", "--coords");

        const plain = readFileSync(join(dir, "plain.png"));
        expect(readFileSync(join(dir, "grid.png")).equals(plain)).toBe(false);
        expect(readFileSync(join(dir, "coords.png")).equals(plain)).toBe(false);
    });

    it("lets --center and --scale win over camera moves made in draw", async () => {
        const moved = await run("camera-in-draw.mjs", "-o", "moved.png");
        expect(moved.stdout).toContain("Center (10, 10), scale 10");

        const pinned = await run("camera-in-draw.mjs", "-o", "pinned.png", "--center=-2,3", "--scale", "15");
        expect(pinned.code).toBe(EXIT_OK);
        expect(pinned.stdout).toContain("Center (-2, 3), scale 15 px per unit");
    });

    it("renders a --scale outside the configured limits and says so", async () => {
        const result = await run("limits.mjs", "--scale", "64");

        expect(result.code).toBe(EXIT_OK);
        expect(result.stderr).toBe(
            "note: --scale 64 is above maxScale 50, so the app cannot zoom this far; rendered anyway\n",
        );
        expect(result.stdout).toContain("scale 64 px per unit (limits 30 to 64)");

        const below = await run("limits.mjs", "--scale", "8");
        expect(below.stderr).toContain("note: --scale 8 is below minScale 30");
        expect(below.stdout).toContain("(limits 8 to 50)");
    });

    it("checks --scale against the default limits when the config sets none", async () => {
        // scale 40 without minScale/maxScale: the app zooms from 20 to 80.
        const result = await run("board.mjs", "-o", "deep.png", "--scale", "200");

        expect(result.stderr).toContain("note: --scale 200 is above maxScale 80");
        expect(result.stdout).toContain("scale 200 px per unit (limits 20 to 200)");
        expect((await run("board.mjs", "-o", "inside.png", "--scale", "60")).stderr).toBe("");
    });

    it("reports a module center that config.bounds moved", async () => {
        const result = await run("bounded.mjs");

        expect(result.code).toBe(EXIT_OK);
        expect(result.stderr).toMatch(
            /^note: the module's center \(-5, -5\) became \(0\.5, 0\.5\)\. config\.bounds keeps/,
        );
        expect(result.stdout).toContain("Center (0.5, 0.5)");
    });

    it("reports a --center that config.bounds clamped, once", async () => {
        const result = await run("bounded.mjs", "-o", "clamped.png", "--center", "20,3");

        expect(result.code).toBe(EXIT_OK);
        // Corner-space maxX 10 is item 9.5; a 2-unit-wide view centers at most at 8.5.
        expect(result.stderr).toBe(
            "note: --center (20, 3) became (8.5, 3). config.bounds keeps the camera inside the world (corner space: cell k spans k..k+1).\n",
        );
        expect(result.stdout).toContain("Center (8.5, 3)");
    });

    it("snaps the module's center with gridAligned like the app, but renders --center as given", async () => {
        const snapped = await run("aligned.mjs");
        expect(snapped.stderr).toContain("note: the module's center (1.2, 1.2) became (1.5, 1.5)");
        expect(snapped.stdout).toContain("Center (1.5, 1.5)");

        const exact = await run("aligned.mjs", "-o", "exact.png", "--center", "1.2,1.2");
        expect(exact.stderr).toBe("");
        expect(exact.stdout).toContain("Center (1.2, 1.2)");
    });

    it("applies --size and --pixel-ratio to the output dimensions, keeping the center", async () => {
        const result = await run("board.mjs", "-o", "big.png", "--size", "100x50", "--pixel-ratio", "2");

        expect(result.stdout).toContain("(200x100 px, png)");
        expect(result.stdout).toContain("Center (1.5, 1.5)");
        expect(await imageSize(join(dir, "big.png"))).toEqual({ width: 200, height: 100 });
    });

    it("resizes a responsive browser config", async () => {
        const result = await run("responsive.mjs", "--size", "100x60");

        expect(result).toMatchObject({ code: EXIT_OK, stderr: "" });
        expect(result.stdout).toContain("(100x60 px, png)");
        expect(result.stdout).toContain("Center (3, 3)");
    });

    it("lets draw see the camera the flags ask for", async () => {
        const result = await run("visible-in-draw.mjs", "--center", "5,6", "--scale", "8", "--size", "80x40");
        expect(result.code).toBe(EXIT_OK);

        const seen = (globalThis as { __cteRenderSeen?: unknown }).__cteRenderSeen;
        expect(seen).toEqual({ center: { x: 5, y: 6 }, scale: 8, size: { width: 80, height: 40 } });
    });

    it("notes module exports that only flags control", async () => {
        const result = await run("with-options.mjs");

        expect(result.code).toBe(EXIT_OK);
        expect(result.stderr).toBe(
            "note: the module's pixelRatio export is ignored; set it with --pixel-ratio\n" +
                "note: the module's quality export is ignored; set it with --quality\n",
        );
        expect(result.stdout).toContain("(20x20 px, png)");
    });

    it("picks the format from the output extension", async () => {
        await run("board.mjs", "-o", "board.jpg", "--quality", "80");
        await run("board.mjs", "-o", "board.webp");

        expect(readFileSync(join(dir, "board.jpg")).subarray(0, 3).toString("hex")).toBe("ffd8ff");
        const webp = readFileSync(join(dir, "board.webp"));
        expect(webp.subarray(0, 4).toString("latin1")).toBe("RIFF");
        expect(webp.subarray(8, 12).toString("latin1")).toBe("WEBP");
    });

    it("registers fonts from --font, with or without a family name", async () => {
        expect((await run("board.mjs", "-o", "font.png", "--font", `${FONT}=Preview Sans`)).code).toBe(EXIT_OK);
        expect((await run("board.mjs", "-o", "font2.png", "--font", FONT)).code).toBe(EXIT_OK);

        const missing = await run("board.mjs", "--font", "missing.ttf");
        expect(missing.code).toBe(EXIT_FAILURE);
        expect(missing.stderr).toContain(`could not register the font ${join(dir, "missing.ttf")}`);
    });

    it.each([
        [[], "missing the preview module argument"],
        [["a.mjs", "b.mjs"], "expected one preview module, got 2"],
        [["missing.mjs"], "cannot find the preview module"],
        [["board.mjs", "-o", "board.gif"], "--out must end in .png, .jpg, .jpeg or .webp"],
        [["board.mjs", "--center", "1"], "--center expects x,y"],
        [["board.mjs", "--center", "1,2,3"], "--center expects x,y"],
        [["board.mjs", "--center", "a,b"], "--center expects x,y"],
        [["board.mjs", "--size", "800"], "--size expects WIDTHxHEIGHT"],
        [["board.mjs", "--size", "0x10"], "--size expects WIDTHxHEIGHT"],
        [["board.mjs", "--scale", "0"], "--scale expects a positive number"],
        [["board.mjs", "--pixel-ratio", "x"], "--pixel-ratio expects a positive number"],
        [["board.mjs", "--quality", "101"], "--quality expects a number from 0 to 100"],
        [["board.mjs", "--wat"], "Unknown option '--wat'"],
    ])("exits 2 on a bad command line: %j", async (argv, message) => {
        const result = await run(...argv);

        expect(result.code).toBe(EXIT_USAGE);
        expect(result.stderr).toContain(message);
        expect(result.stdout).toBe("");
    });

    it.each([
        ["no-config.mjs", "must export a config object"],
        ["bad-draw.mjs", "draw must be a function"],
        ["default-draw.mjs", "export draw by name (`export function draw(engine)`), not as the default export"],
        ["bad-center.mjs", "center must be { x: number, y: number }"],
        ["invalid-config.mjs", "scale must be positive"],
        ["throws.mjs", "boom from draw"],
        ["syntax-error.mjs", "could not load"],
    ])("exits 1 when %s cannot render", async (module, message) => {
        const result = await run(module, "-o", "failed.png");

        expect(result.code).toBe(EXIT_FAILURE);
        expect(result.stderr).toContain(message);
        expect(result.stdout).toBe("");
    });

    it("prints help and the version", async () => {
        const help = await run("--help");
        expect(help.code).toBe(EXIT_OK);
        expect(help.stdout).toMatch(/^Usage: cte-render <preview-module> \[options\]/);

        // Builds replace the version through tsup's define; source runs report this.
        expect((await run("-v")).stdout).toBe("development build\n");
    });
});
