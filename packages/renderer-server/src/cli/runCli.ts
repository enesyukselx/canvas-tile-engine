import { mkdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import type { CanvasTileEngine, CanvasTileEngineConfig, Coords } from "@canvas-tile-engine/core";
import type { Image } from "@napi-rs/canvas";
import { GlobalFonts, registerFont } from "../fonts";
import { renderToBuffer } from "../renderToBuffer";
import type { ImageFormat, ServerMount } from "../types";

// Replaced with the package version by tsup's `define`; absent under vitest.
declare const __CTE_RENDER_VERSION__: string | undefined;

/** Where {@link runCli} reads files and writes its messages. */
export interface CliIO {
    cwd: string;
    stdout: (text: string) => void;
    stderr: (text: string) => void;
}

/** Exit codes: success, a failed render, a malformed command line. */
export const EXIT_OK = 0;
export const EXIT_FAILURE = 1;
export const EXIT_USAGE = 2;

type ServerEngine = CanvasTileEngine<ServerMount, Image>;
type Size = { width: number; height: number };

/** The scene a preview module exports. */
interface PreviewScene {
    config: CanvasTileEngineConfig;
    center?: Coords;
    draw?: (engine: ServerEngine) => void | Promise<void>;
}

interface CliOptions {
    module: string;
    out: string;
    format: ImageFormat;
    grid: boolean;
    coords: boolean;
    center?: Coords;
    scale?: number;
    size?: { width: number; height: number };
    pixelRatio?: number;
    quality?: number;
    fonts: { path: string; family?: string }[];
}

/** Drawn above every scene layer so the cell boundaries stay visible. */
const GRID_LAYER = Number.MAX_SAFE_INTEGER;
const GRID_COLOR = "rgba(236, 72, 153, 0.65)";

/** Why config.bounds can move a center. */
const BOUNDS_HINT = "config.bounds keeps the camera inside the world (corner space: cell k spans k..k+1).";
/** Why the engine can move the initial center. */
const CAMERA_HINT =
    "config.bounds keeps the camera inside the world (corner space: cell k spans k..k+1), " +
    "and config.gridAligned snaps the initial center to the pixel grid.";

/** renderToBuffer options that the command line sets instead of the module. */
const FLAG_OPTIONS = { pixelRatio: "--pixel-ratio", format: "the --out extension", quality: "--quality" };

const HELP = `Usage: cte-render <preview-module> [options]

Render a Canvas Tile Engine scene to an image so you can check what it draws.

The preview module is an ES module that exports the scene as named exports
or as one default-exported object, with the same meaning as the
renderToBuffer() options:
  config   CanvasTileEngineConfig (required)
  center   initial camera center, item space (default { x: 0, y: 0 })
  draw     (engine) => void | Promise<void>, registers the draw calls
.mjs always works and .mts needs Node 22.18 or newer. .js and .ts load as ES
modules only inside a "type": "module" package.

Options:
  -o, --out <file>          Output image: .png, .jpg, .jpeg or .webp
                            (default: <module name>.png in the current directory)
      --grid                Draw one-cell grid lines above everything
      --coords              Show the coordinate overlay (cell numbers on the edges)
      --center <x,y>        Move the camera there, like engine.setCenter (item
                            space); for a negative x write --center=-3,4
      --scale <px>          Zoom to this many pixels per world unit, like
                            engine.setScale, even outside the zoom limits
      --size <WxH>          Resize the viewport (CSS pixels), keeping the center
      --pixel-ratio <n>     Output pixel ratio (default 1)
      --quality <0-100>     JPEG/WebP quality
      --font <file[=family]>
                            Register a font file before rendering; repeatable
  -h, --help                Show this help
  -v, --version             Show the version

The engine starts from the module's config and center, as the app does; the
camera flags apply before draw runs and again after it, so they win over
camera moves inside draw.

The image comes from the Canvas2D drawing code that the browser Canvas2D
renderer also uses. WebGL and React Native Skia can differ in places: WebGL
draws text and custom drawing above all shapes.
`;

class UsageError extends Error {}

/**
 * Run the `cte-render` command line. Never throws: every failure is reported
 * on `io.stderr` and turned into an exit code.
 */
export async function runCli(argv: readonly string[], io: CliIO): Promise<number> {
    let options: CliOptions | "help" | "version";
    try {
        options = parseCliArgs(argv);
    } catch (error) {
        io.stderr(`cte-render: ${errorMessage(error)}\nRun cte-render --help for usage.\n`);
        return EXIT_USAGE;
    }
    if (options === "help") {
        io.stdout(HELP);
        return EXIT_OK;
    }
    if (options === "version") {
        io.stdout(`${version()}\n`);
        return EXIT_OK;
    }

    try {
        await render(options, io);
        return EXIT_OK;
    } catch (error) {
        io.stderr(`cte-render: ${errorMessage(error)}\n`);
        return error instanceof UsageError ? EXIT_USAGE : EXIT_FAILURE;
    }
}

async function render(options: CliOptions, io: CliIO): Promise<void> {
    for (const font of options.fonts) {
        const path = resolve(io.cwd, font.path);
        if (!registerFont(path, font.family)) {
            throw new Error(`could not register the font ${path}`);
        }
    }
    if (GlobalFonts.families.length === 0) {
        io.stderr("note: no fonts are installed on this system, so text will not render; pass --font <file>\n");
    }

    const scene = await loadScene(resolve(io.cwd, options.module), io);
    const moduleCenter = scene.center ?? { x: 0, y: 0 };

    let camera: { center: Coords; scale: number; minScale: number; maxScale: number; size: Size } | undefined;
    const image = await renderToBuffer({
        config: previewConfig(scene.config, options),
        center: moduleCenter,
        pixelRatio: options.pixelRatio,
        format: options.format,
        quality: options.quality,
        draw: async (engine) => {
            // The engine starts exactly like the app, so gridAligned snapping and
            // bounds clamping of the initial center match what the app shows.
            const start = engine.getCenter();
            if (!options.center && !sameCoords(start, moduleCenter)) {
                io.stderr(
                    `note: the module's center ${formatCoords(moduleCenter)} became ${formatCoords(start)}. ${CAMERA_HINT}\n`,
                );
            }
            widenScaleLimits(engine, options, io);
            // Before draw, so draw sees the requested camera (e.g. getVisibleBounds)...
            applyCameraFlags(engine, options);
            if (scene.draw) {
                await scene.draw(engine);
            }
            // ...and after it, so the flags win over fitBounds/setCenter inside draw.
            applyCameraFlags(engine, options);
            if (options.center) {
                const applied = engine.getCenter();
                if (!sameCoords(applied, options.center)) {
                    io.stderr(
                        `note: --center ${formatCoords(options.center)} became ${formatCoords(applied)}. ${BOUNDS_HINT}\n`,
                    );
                }
            }
            if (options.grid) {
                engine.drawGridLines(1, 1, GRID_COLOR, GRID_LAYER);
            }
            const live = engine.getConfig();
            camera = {
                center: engine.getCenter(),
                scale: engine.getScale(),
                minScale: live.minScale,
                maxScale: live.maxScale,
                size: engine.getSize(),
            };
        },
    });

    const out = resolve(io.cwd, options.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, image);

    const lines = [`Wrote ${out}`];
    if (camera) {
        const { width, height } = camera.size;
        const ratio = options.pixelRatio ?? 1;
        const halfWidth = width / (2 * camera.scale);
        const halfHeight = height / (2 * camera.scale);
        lines[0] += ` (${Math.max(1, Math.round(width * ratio))}x${Math.max(1, Math.round(height * ratio))} px, ${options.format})`;
        lines.push(
            `Center ${formatCoords(camera.center)}, scale ${formatNumber(camera.scale)} px per unit ` +
                `(limits ${formatNumber(camera.minScale)} to ${formatNumber(camera.maxScale)})`,
            `Visible x ${formatNumber(camera.center.x - halfWidth)} to ${formatNumber(camera.center.x + halfWidth)}, ` +
                `y ${formatNumber(camera.center.y - halfHeight)} to ${formatNumber(camera.center.y + halfHeight)} ` +
                "(item space: integers are cell centers)",
        );
    }
    io.stdout(`${lines.join("\n")}\n`);
}

/** The module's config, plus the coordinate overlay when asked for. */
function previewConfig(source: CanvasTileEngineConfig, options: CliOptions): CanvasTileEngineConfig {
    // responsive only gates engine.resize() here (the server has no container to
    // follow), so turn it off for --size to work on a browser app's config.
    const config: CanvasTileEngineConfig = { ...source, responsive: false };
    if (options.coords) {
        config.coordinates = { ...source.coordinates, enabled: true, shownScaleRange: { min: 0, max: Infinity } };
    }
    return config;
}

/** Let --scale go outside the zoom limits, and say how far the app could zoom. */
function widenScaleLimits(engine: ServerEngine, options: CliOptions, io: CliIO): void {
    const scale = options.scale;
    if (scale === undefined) {
        return;
    }
    const { minScale, maxScale } = engine.getConfig();
    if (scale >= minScale && scale <= maxScale) {
        return;
    }
    const [side, limit] = scale < minScale ? ["below minScale", minScale] : ["above maxScale", maxScale];
    io.stderr(
        `note: --scale ${formatNumber(scale)} is ${side} ${formatNumber(limit)}, so the app cannot zoom this far; rendered anyway\n`,
    );
    engine.setScaleLimits(Math.min(minScale, scale), Math.max(maxScale, scale));
}

function applyCameraFlags(engine: ServerEngine, options: CliOptions): void {
    const size = options.size;
    if (size) {
        const current = engine.getSize();
        if (current.width !== size.width || current.height !== size.height) {
            // The server resize keeps the top-left corner; keep the center instead.
            const center = engine.getCenter();
            engine.resize(size.width, size.height, 0);
            engine.setCenter(center);
        }
    }
    if (options.scale !== undefined) {
        engine.setScale(options.scale);
    }
    if (options.center) {
        engine.setCenter(options.center);
    }
}

async function loadScene(path: string, io: CliIO): Promise<PreviewScene> {
    if (!(await stat(path).catch(() => null))?.isFile()) {
        throw new UsageError(`cannot find the preview module ${path}`);
    }
    let module: Record<string, unknown>;
    try {
        module = (await import(pathToFileURL(path).href)) as Record<string, unknown>;
    } catch (error) {
        const code = (error as { code?: unknown } | null)?.code;
        if (code === "ERR_UNKNOWN_FILE_EXTENSION" && /\.[cm]?ts$/.test(path)) {
            throw new Error(
                `${path}: this Node.js version cannot load TypeScript. Use Node 22.18 or newer, or write the preview module as .mjs.`,
            );
        }
        // A .js/.ts file outside a "type": "module" package can load as CommonJS.
        const hint =
            error instanceof SyntaxError && /\.[jt]s$/.test(path)
                ? ' (if it uses import/export, rename it to .mjs/.mts or run it inside a "type": "module" package)'
                : "";
        throw new Error(`could not load ${path}: ${errorMessage(error)}${hint}`);
    }

    const fallback = module.default;
    const source =
        "config" in module || typeof fallback !== "object" || fallback === null
            ? module
            : (fallback as Record<string, unknown>);
    const { config, center, draw } = source;

    if (typeof config !== "object" || config === null) {
        throw new Error(
            `${path} must export a config object, as \`export const config = {...}\` or \`export default { config, draw }\``,
        );
    }
    if (source === module && draw === undefined && typeof fallback === "function") {
        throw new Error(`${path}: export draw by name (\`export function draw(engine)\`), not as the default export`);
    }
    if (draw !== undefined && typeof draw !== "function") {
        throw new Error(`${path}: draw must be a function that receives the engine`);
    }
    for (const [name, flag] of Object.entries(FLAG_OPTIONS)) {
        if (name in source) {
            io.stderr(`note: the module's ${name} export is ignored; set it with ${flag}\n`);
        }
    }
    if (center !== undefined && !isCoords(center)) {
        throw new Error(`${path}: center must be { x: number, y: number }`);
    }
    return { config: config as CanvasTileEngineConfig, center, draw: draw as PreviewScene["draw"] };
}

function parseCliArgs(argv: readonly string[]): CliOptions | "help" | "version" {
    const { values, positionals } = parseArgs({
        args: [...argv],
        allowPositionals: true,
        strict: true,
        options: {
            out: { type: "string", short: "o" },
            grid: { type: "boolean" },
            coords: { type: "boolean" },
            center: { type: "string" },
            scale: { type: "string" },
            size: { type: "string" },
            "pixel-ratio": { type: "string" },
            quality: { type: "string" },
            font: { type: "string", multiple: true },
            help: { type: "boolean", short: "h" },
            version: { type: "boolean", short: "v" },
        },
    });

    if (values.help) {
        return "help";
    }
    if (values.version) {
        return "version";
    }
    if (positionals.length === 0) {
        throw new UsageError("missing the preview module argument");
    }
    if (positionals.length > 1) {
        throw new UsageError(`expected one preview module, got ${positionals.length}: ${positionals.join(" ")}`);
    }

    const module = positionals[0];
    const out = values.out ?? `${basename(module, extname(module))}.png`;
    return {
        module,
        out,
        format: formatOf(out),
        grid: values.grid ?? false,
        coords: values.coords ?? false,
        center: values.center === undefined ? undefined : parseCenter(values.center),
        scale: values.scale === undefined ? undefined : positiveNumber("--scale", values.scale),
        size: values.size === undefined ? undefined : parseSize(values.size),
        pixelRatio:
            values["pixel-ratio"] === undefined ? undefined : positiveNumber("--pixel-ratio", values["pixel-ratio"]),
        quality: values.quality === undefined ? undefined : parseQuality(values.quality),
        fonts: (values.font ?? []).map(parseFont),
    };
}

function formatOf(out: string): ImageFormat {
    const extension = extname(out).toLowerCase();
    if (extension === ".png") {
        return "png";
    }
    if (extension === ".jpg" || extension === ".jpeg") {
        return "jpeg";
    }
    if (extension === ".webp") {
        return "webp";
    }
    throw new UsageError(`--out must end in .png, .jpg, .jpeg or .webp, got "${out}"`);
}

function parseCenter(value: string): Coords {
    const parts = value.split(",");
    const [x, y] = parts.map((part) => Number(part.trim()));
    if (parts.length !== 2 || parts.some((part) => part.trim() === "") || !Number.isFinite(x) || !Number.isFinite(y)) {
        throw new UsageError(`--center expects x,y (e.g. 4.5,4.5), got "${value}"`);
    }
    return { x, y };
}

function parseSize(value: string): { width: number; height: number } {
    const match = /^\s*(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)\s*$/i.exec(value);
    const width = Number(match?.[1]);
    const height = Number(match?.[2]);
    if (!match || width <= 0 || height <= 0) {
        throw new UsageError(`--size expects WIDTHxHEIGHT (e.g. 800x600), got "${value}"`);
    }
    return { width, height };
}

function positiveNumber(flag: string, value: string): number {
    const number = Number(value);
    if (value.trim() === "" || !Number.isFinite(number) || number <= 0) {
        throw new UsageError(`${flag} expects a positive number, got "${value}"`);
    }
    return number;
}

function parseQuality(value: string): number {
    const number = Number(value);
    if (value.trim() === "" || !Number.isFinite(number) || number < 0 || number > 100) {
        throw new UsageError(`--quality expects a number from 0 to 100, got "${value}"`);
    }
    return number;
}

function parseFont(value: string): { path: string; family?: string } {
    // "file=Family"; a "=" followed by a path separator belongs to the path.
    const index = value.lastIndexOf("=");
    if (index > 0 && !/[\\/]/.test(value.slice(index + 1))) {
        const family = value.slice(index + 1).trim();
        return family ? { path: value.slice(0, index), family } : { path: value.slice(0, index) };
    }
    return { path: value };
}

function isCoords(value: unknown): value is Coords {
    const coords = value as { x?: unknown; y?: unknown } | null;
    return (
        typeof coords === "object" &&
        coords !== null &&
        typeof coords.x === "number" &&
        typeof coords.y === "number" &&
        Number.isFinite(coords.x) &&
        Number.isFinite(coords.y)
    );
}

function sameCoords(a: Coords, b: Coords): boolean {
    return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9;
}

function formatNumber(value: number): string {
    return String(Number(value.toFixed(3)));
}

function formatCoords(coords: Coords): string {
    return `(${formatNumber(coords.x)}, ${formatNumber(coords.y)})`;
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function version(): string {
    return typeof __CTE_RENDER_VERSION__ === "string" ? __CTE_RENDER_VERSION__ : "development build";
}
