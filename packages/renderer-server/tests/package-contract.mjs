import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Run through the root `pnpm test:package` task so Turbo builds both packages first.
// This consumer lives outside the workspace: package imports must resolve through
// the packed exports maps, never source aliases or workspace package symlinks.
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const consumer = mkdtempSync(join(tmpdir(), "renderer-server-package-"));
const packed = join(consumer, "packed");
const runtimeNames = ["GlobalFonts", "RendererServer", "SERVER_MOUNT", "registerFont", "renderToBuffer"];
const typeNames = ["Image", "Canvas", "SKRSContext2D"];

function run(command, args, cwd) {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
}

function linkDependency(name) {
    // Reuse the lockfile-installed third-party dependency (and its native binary).
    // Only core and renderer-server are under test; neither may be linked here.
    const source = dirname(require.resolve(`${name}/package.json`));
    const target = join(consumer, "node_modules", name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source, target, "junction");
}

function unpackPackage(directory, name) {
    const output = join(packed, name.split("/").at(-1));
    mkdirSync(output, { recursive: true });
    run(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["pack", "--pack-destination", output], directory);
    const tarballs = readdirSync(output).filter((file) => file.endsWith(".tgz"));
    assert.equal(tarballs.length, 1, `Expected exactly one ${name} tarball`);
    const target = join(consumer, "node_modules", name);
    mkdirSync(target, { recursive: true });
    run("tar", ["-xzf", join(output, tarballs[0]), "--strip-components=1", "-C", target], consumer);
    const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    assert.equal(manifest.name, name);
    assert.ok(!JSON.stringify(manifest.dependencies).includes("workspace:"), "Packed dependencies must be publishable");
    assert.ok(!readdirSync(target).includes("src"), "Consumer must use published artifacts only");
}

function diagnostics(program) {
    return ts.getPreEmitDiagnostics(program);
}

function explain(errors) {
    return ts.formatDiagnosticsWithColorAndContext(errors, {
        getCanonicalFileName: (file) => file,
        getCurrentDirectory: () => consumer,
        getNewLine: () => "\n",
    });
}

// Both import type and ordinary type-position imports remain valid. The exact
// runtime-key assertion catches any additional declaration-only value exports.
const validConsumer = `
import assert from "node:assert/strict";
import * as server from "@canvas-tile-engine/renderer-server";
import { GlobalFonts, RendererServer, SERVER_MOUNT, registerFont, renderToBuffer } from "@canvas-tile-engine/renderer-server";
import type { Image, Canvas, SKRSContext2D } from "@canvas-tile-engine/renderer-server";
import { Image as OrdinaryImage, Canvas as OrdinaryCanvas, SKRSContext2D as OrdinaryContext } from "@canvas-tile-engine/renderer-server";
import { Image as NativeImage, Canvas as NativeCanvas } from "@napi-rs/canvas";
import type { SKRSContext2D as NativeContext } from "@napi-rs/canvas";

type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Assert<T extends true> = T;
type TypeContract = [
    Assert<Equal<Image, NativeImage>>,
    Assert<Equal<Canvas, NativeCanvas>>,
    Assert<Equal<SKRSContext2D, NativeContext>>,
    Assert<Equal<OrdinaryImage, NativeImage>>,
    Assert<Equal<OrdinaryCanvas, NativeCanvas>>,
    Assert<Equal<OrdinaryContext, NativeContext>>,
    // NodeNext may synthesize a default for a CJS declaration; compare named exports.
    Assert<Equal<Exclude<keyof typeof server, "default">, ${runtimeNames.map((name) => JSON.stringify(name)).join(" | ")}>>,
    Assert<Equal<ReturnType<RendererServer["getCanvas"]>, Canvas>>,
    Assert<Equal<ReturnType<RendererServer["getContext"]>, SKRSContext2D>>
];
const contract: TypeContract = [true, true, true, true, true, true, true, true, true];
assert.equal(contract.length, 9);

async function main() {
    assert.deepEqual(Object.keys(server).sort(), ${JSON.stringify(runtimeNames)});
    for (const name of ${JSON.stringify(typeNames)}) {
        assert.equal(Object.hasOwn(server, name), false, name + " must be type-only");
    }
    assert.equal(typeof RendererServer, "function");
    assert.equal(typeof registerFont, "function");
    assert.equal(typeof GlobalFonts.registerFromPath, "function");
    assert.equal(typeof SERVER_MOUNT, "object");
    const image: Image = new NativeImage();
    const canvas: Canvas = new NativeCanvas(4, 4);
    const context: SKRSContext2D = canvas.getContext("2d");
    assert.equal(typeof image.width, "number");
    assert.equal(context.canvas.width, 4);
    const png = await renderToBuffer({
        config: { size: { width: 4, height: 4 }, scale: 1 },
        draw: (engine) => { engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#f00" } }); },
    });
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
`;

const invalidConsumer = `
import { Image, Canvas, SKRSContext2D } from "@canvas-tile-engine/renderer-server";
new Image();
new Canvas(4, 4);
void SKRSContext2D;
`;

try {
    mkdirSync(packed);
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }));
    unpackPackage(resolve(packageRoot, "../core"), "@canvas-tile-engine/core");
    unpackPackage(packageRoot, "@canvas-tile-engine/renderer-server");
    linkDependency("@napi-rs/canvas");
    linkDependency("@types/node");

    for (const [extension, module, moduleResolution] of [
        ["mts", ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
        ["cts", ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
        ["ts", ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
    ]) {
        const outDir = join(consumer, `output-${extension}`);
        const options = {
            target: ts.ScriptTarget.ES2022,
            module,
            moduleResolution,
            strict: true,
            skipLibCheck: false,
            esModuleInterop: true,
            // DOM is deliberately included: the separate Node-only declaration
            // issue must not mask this runtime/type export contract regression.
            lib: ["lib.es2022.d.ts", "lib.dom.d.ts"],
            types: ["node"],
            typeRoots: [join(consumer, "node_modules/@types")],
            noEmitOnError: true,
            outDir,
        };
        const valid = join(consumer, `consumer.${extension}`);
        writeFileSync(valid, validConsumer);
        const program = ts.createProgram([valid], options);
        const errors = diagnostics(program);
        assert.equal(errors.length, 0, explain(errors));
        assert.equal(program.emit().emitSkipped, false, "Valid consumer should emit JavaScript");
        const outputExtension = extension === "ts" ? "js" : extension.replace("ts", "js");
        run(process.execPath, [join(outDir, `consumer.${outputExtension}`)], consumer);

        const invalid = join(consumer, `invalid.${extension}`);
        writeFileSync(invalid, invalidConsumer);
        const rejected = diagnostics(ts.createProgram([invalid], { ...options, noEmit: true }));
        assert.deepEqual(
            rejected.map((error) => error.code),
            [1362, 1362, 2693],
            explain(rejected),
        );
        for (const [index, name] of typeNames.entries()) {
            assert.ok(ts.flattenDiagnosticMessageText(rejected[index].messageText, "\n").includes(`'${name}'`));
        }
        console.log(`Packed consumer .${extension}: type-only exports, runtime exports, and PNG rendering passed`);
    }

    // The `cte-render` bin runs from the packed artifact and resolves core from
    // the consumer, as it does after `npx` or a project install.
    const serverRoot = join(consumer, "node_modules", "@canvas-tile-engine/renderer-server");
    const manifest = JSON.parse(readFileSync(join(serverRoot, "package.json"), "utf8"));
    assert.deepEqual(manifest.bin, { "cte-render": "dist/cli.mjs" });
    const bin = join(serverRoot, manifest.bin["cte-render"]);
    assert.ok(readFileSync(bin, "utf8").startsWith("#!/usr/bin/env node\n"), "The bin needs a node shebang");
    assert.equal(run(process.execPath, [bin, "--version"], consumer).trim(), manifest.version);

    const preview = (annotation) => `
export const config = { scale: 4, size: { width: 8, height: 6 } };
export function draw(engine${annotation}) {
    engine.drawRect({ x: 0, y: 0, size: 1, style: { fillStyle: "#f00" } });
}
`;
    const previews = [["preview.mjs", preview("")]];
    // Node strips types natively from 22.18 / 23.6; older runtimes skip the .mts case.
    if (process.features.typescript) {
        previews.push(["preview.mts", preview(": { drawRect(item: object): unknown }")]);
    }
    for (const [file, source] of previews) {
        writeFileSync(join(consumer, file), source);
        const out = join(consumer, `${file}.png`);
        const stdout = run(process.execPath, [bin, file, "-o", out, "--grid", "--coords"], consumer);
        assert.ok(stdout.startsWith(`Wrote ${out} (8x6 px, png)`), stdout);
        assert.equal(readFileSync(out).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
        console.log(`Packed bin: cte-render rendered ${file}`);
    }

    // Process lifecycle: what the preview module leaves behind must not hang the
    // command or turn a failure into exit 0.
    const config = "export const config = { scale: 4, size: { width: 8, height: 6 } };";
    mkdirSync(join(consumer, "cjs"));
    writeFileSync(join(consumer, "cjs/package.json"), JSON.stringify({ type: "commonjs" }));
    const lifecycle = [
        ["timer.mjs", `setInterval(() => {}, 1000);\n${config}`, 0, /^Wrote /],
        [
            "hang.mjs",
            `${config}\nexport function draw() { return new Promise(() => {}); }`,
            1,
            /never finished loading or drawing/,
        ],
        [
            "stray.mjs",
            `${config}\nexport function draw() { Promise.reject(new Error("stray")); }`,
            1,
            /^cte-render: stray \(from a promise nothing awaited\)\n$/,
        ],
        ["cjs/scene.js", config, 1, /rename it to \.mjs\/\.mts/],
    ];
    for (const [file, source, status, output] of lifecycle) {
        writeFileSync(join(consumer, file), source);
        const result = spawnSync(process.execPath, [bin, file, "-o", join(consumer, "lifecycle.png")], {
            cwd: consumer,
            encoding: "utf8",
            timeout: 30_000,
        });
        assert.equal(result.signal, null, `${file} timed out`);
        assert.equal(result.status, status, `${file}: ${result.stderr}`);
        assert.match(status === 0 ? result.stdout : result.stderr, output);
        console.log(`Packed bin: ${file} exits ${status}`);
    }
} finally {
    rmSync(consumer, { recursive: true, force: true });
}
