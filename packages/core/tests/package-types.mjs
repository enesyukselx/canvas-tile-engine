import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

// Turbo builds every package under test first. Resolve through actual packed
// exports outside the workspace, with no source aliases or ambient DOM shims.
const packageRoot = fileURLToPath(new URL("..", import.meta.url));
const serverRequire = createRequire(resolve(packageRoot, "../renderer-server/package.json"));
const keepArtifacts = process.env.CTE_TYPE_TEST_ARTIFACTS;
const artifactRoot = keepArtifacts ? resolve(keepArtifacts) : tmpdir();
mkdirSync(artifactRoot, { recursive: true });
const consumer = mkdtempSync(join(artifactRoot, "platform-types-"));

function run(command, args, cwd) {
    return execFileSync(command, args, { cwd, encoding: "utf8", stdio: "pipe" });
}

function linkDependency(name) {
    // Third-party dependencies come from the lockfile installation. Our four
    // packages must instead be extracted from their publishable tarballs.
    const source = dirname(serverRequire.resolve(`${name}/package.json`));
    const target = join(consumer, "node_modules", name);
    mkdirSync(dirname(target), { recursive: true });
    symlinkSync(source, target, "junction");
}

function unpackPackage(name) {
    const output = join(consumer, "packed", name);
    mkdirSync(output, { recursive: true });
    run(
        process.platform === "win32" ? "pnpm.cmd" : "pnpm",
        ["pack", "--pack-destination", output],
        resolve(packageRoot, "..", name),
    );
    const tarballs = readdirSync(output).filter((file) => file.endsWith(".tgz"));
    assert.equal(tarballs.length, 1);
    const target = join(consumer, "node_modules/@canvas-tile-engine", name);
    mkdirSync(target, { recursive: true });
    run("tar", ["-xzf", join(output, tarballs[0]), "--strip-components=1", "-C", target], consumer);
    const manifest = JSON.parse(readFileSync(join(target, "package.json"), "utf8"));
    assert.equal(manifest.name, `@canvas-tile-engine/${name}`);
    // Peer-only packages publish without a `dependencies` field at all.
    for (const field of ["dependencies", "peerDependencies"]) {
        assert.ok(!JSON.stringify(manifest[field] ?? {}).includes("workspace:"));
    }
    assert.ok(!readdirSync(target).includes("src"));
}

const assertions = `
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Assert<T extends true> = T;
`;

const nodeConsumer = `
import assert from "node:assert/strict";
import { CanvasTileEngine, SpriteSheet, type ICamera, type IRenderer, type IImageLoader, type IDrawAPI, type ImageItem, type RendererDependencies } from "@canvas-tile-engine/core";
import { RendererServer, SERVER_MOUNT, renderToBuffer, type ServerMount } from "@canvas-tile-engine/renderer-server";
import { Image } from "@napi-rs/canvas";
${assertions}
type Defaults = [
    Assert<Equal<ImageItem["img"], unknown>>,
    Assert<Equal<RendererDependencies["wrapper"], unknown>>,
    Assert<Equal<Awaited<ReturnType<IImageLoader["load"]>>, unknown>>,
    Assert<Equal<ReturnType<IRenderer["getDrawAPI"]>, IDrawAPI<unknown>>>,
    Assert<Equal<CanvasTileEngine["canvas"], undefined>>
];
const defaults: Defaults = [true, true, true, true, true];
assert.equal(defaults.length, 5);
function zoom(camera: ICamera) {
    camera.zoom(10, 10, -1, { left: 0, top: 0, width: 8, height: 8 });
}
void zoom;

async function main() {
    assert.equal("document" in globalThis, false);
    assert.equal("HTMLCanvasElement" in globalThis, false);
    const renderer = new RendererServer();
    const config = { size: { width: 8, height: 8 }, scale: 1 };
    const engine = new CanvasTileEngine(SERVER_MOUNT, config, renderer);
    type Inference = [
        Assert<Equal<typeof engine.canvasWrapper, ServerMount>>,
        Assert<Equal<Awaited<ReturnType<typeof engine.images.load>>, Image>>,
        Assert<Equal<typeof engine.canvas, undefined>>
    ];
    const inference: Inference = [true, true, true];
    assert.equal(inference.length, 3);
    assert.equal(engine.canvas, undefined);
    const image: ImageItem<Image, { id: number }> = { x: 0, y: 0, img: new Image(), data: { id: 1 } };
    engine.drawImage(image);
    engine.clearAll();
    engine.destroy();
    const png = await renderToBuffer({
        config,
        draw: (engine) => {
            const inferred: CanvasTileEngine<ServerMount, Image> = engine;
            inferred.drawRect({ x: 0, y: 0, style: { fillStyle: "#f00" } });
            engine.drawText({ x: 1, y: 1, text: "A", style: { textAlign: "center", textBaseline: "middle" } });
        },
    });
    assert.ok(Buffer.isBuffer(png));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(new SpriteSheet({ frameWidth: 4, frameHeight: 4 }).frame(1, 0).x, 4);
}
void main().catch((error) => { console.error(error); process.exitCode = 1; });
`;

const browserConsumer = `
import { CanvasTileEngine, type ICamera, type IRenderer, type IImageLoader, type IDrawAPI, type ImageItem, type RendererDependencies } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";
${assertions}
type Defaults = [
    Assert<Equal<ImageItem["img"], HTMLImageElement>>,
    Assert<Equal<RendererDependencies["wrapper"], HTMLDivElement>>,
    Assert<Equal<Awaited<ReturnType<IImageLoader["load"]>>, HTMLImageElement>>,
    Assert<Equal<ReturnType<IRenderer["getDrawAPI"]>, IDrawAPI<HTMLImageElement>>>,
    Assert<Equal<CanvasTileEngine["canvas"], HTMLCanvasElement>>
];
const defaults: Defaults = [true, true, true, true, true];
void defaults;
const wrapper = document.createElement("div");
const config = { size: { width: 8, height: 8 }, scale: 1 };
const canvasEngine = new CanvasTileEngine(wrapper, config, new RendererCanvas());
const webglEngine = new CanvasTileEngine(wrapper, config, new RendererWebGL());
const defaultEngine: CanvasTileEngine = canvasEngine;
type Inference = [
    Assert<Equal<typeof canvasEngine.canvasWrapper, HTMLDivElement>>,
    Assert<Equal<typeof canvasEngine.canvas, HTMLCanvasElement>>,
    Assert<Equal<Awaited<ReturnType<typeof canvasEngine.images.load>>, HTMLImageElement>>,
    Assert<Equal<Awaited<ReturnType<typeof webglEngine.images.load>>, HTMLImageElement>>,
    Assert<Equal<CanvasTileEngine<{ native: true }, { image: true }>["canvas"], HTMLCanvasElement | undefined>>
];
const inference: Inference = [true, true, true, true, true];
void inference;
defaultEngine.canvas.getContext("2d");
canvasEngine.drawImage({ x: 0, y: 0, img: new Image() });
webglEngine.drawImage({ x: 0, y: 0, img: new Image() });
function zoom(camera: ICamera) { camera.zoom(10, 10, -1, wrapper.getBoundingClientRect()); }
void zoom;
`;

const invalidNodeConsumer = `
import { CanvasTileEngine, type ImageItem } from "@canvas-tile-engine/core";
import { RendererServer, SERVER_MOUNT } from "@canvas-tile-engine/renderer-server";
import type { Image } from "@napi-rs/canvas";
const engine = new CanvasTileEngine(SERVER_MOUNT, { size: { width: 8, height: 8 }, scale: 1 }, new RendererServer());
engine.drawImage({ x: 0, y: 0, img: "not a native image" });
const image: ImageItem<Image> = { x: 0, y: 0, img: "not a native image" };
engine.canvas.getContext("2d");
`;

const invalidBrowserConsumer = `
import { CanvasTileEngine, type ImageItem } from "@canvas-tile-engine/core";
import { RendererCanvas } from "@canvas-tile-engine/renderer-canvas";
import { RendererWebGL } from "@canvas-tile-engine/renderer-webgl";
const wrapper = document.createElement("div");
const config = { size: { width: 8, height: 8 }, scale: 1 };
new CanvasTileEngine(wrapper, config, new RendererCanvas()).drawImage({ x: 0, y: 0, img: "not a DOM image" });
new CanvasTileEngine(wrapper, config, new RendererWebGL()).drawImage({ x: 0, y: 0, img: "not a DOM image" });
const image: ImageItem = { x: 0, y: 0, img: "not a DOM image" };
`;

function explain(diagnostics) {
    return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (name) => name,
        getCurrentDirectory: () => consumer,
        getNewLine: () => "\n",
    });
}

try {
    writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: "module" }));
    for (const name of ["core", "renderer-server", "renderer-canvas", "renderer-webgl"]) {
        unpackPackage(name);
    }
    linkDependency("@napi-rs/canvas");
    linkDependency("@types/node");
    for (const [extension, module, moduleResolution] of [
        ["mts", ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
        ["cts", ts.ModuleKind.NodeNext, ts.ModuleResolutionKind.NodeNext],
        ["ts", ts.ModuleKind.ESNext, ts.ModuleResolutionKind.Bundler],
    ]) {
        for (const [platform, source] of [
            ["node", nodeConsumer],
            ["browser", browserConsumer],
        ]) {
            const file = join(consumer, `${platform}.${extension}`);
            const outDir = join(consumer, `output-${platform}-${extension}`);
            const options = {
                target: ts.ScriptTarget.ES2022,
                module,
                moduleResolution,
                strict: true,
                skipLibCheck: false,
                esModuleInterop: true,
                lib: platform === "node" ? ["lib.es2022.d.ts"] : ["lib.es2022.d.ts", "lib.dom.d.ts"],
                types: platform === "node" ? ["node"] : [],
                typeRoots: [join(consumer, "node_modules/@types")],
                noEmitOnError: true,
                outDir,
            };
            // Retain an independently runnable compiler configuration with the
            // same options as the API invocation, alongside the consumer files.
            writeFileSync(
                join(consumer, `tsconfig-${platform}-${extension}.json`),
                JSON.stringify(
                    {
                        compilerOptions: {
                            ...options,
                            target: "ES2022",
                            module: ts.ModuleKind[module],
                            moduleResolution: ts.ModuleResolutionKind[moduleResolution],
                            lib: platform === "node" ? ["ES2022"] : ["ES2022", "DOM"],
                        },
                        files: [file],
                    },
                    null,
                    2,
                ),
            );
            writeFileSync(file, source);
            const program = ts.createProgram([file], options);
            const diagnostics = ts.getPreEmitDiagnostics(program);
            const details = explain(diagnostics);
            writeFileSync(join(consumer, `${platform}-${extension}.log`), details || "No diagnostics\n");
            assert.equal(diagnostics.length, 0, details);
            if (platform === "node") {
                assert.ok(!program.getSourceFiles().some((entry) => /lib\.dom(?:\.|$)/.test(entry.fileName)));
                assert.equal(program.emit().emitSkipped, false);
                const outputExtension = extension === "ts" ? "js" : extension.replace("ts", "js");
                const runtimeOutput = run(process.execPath, [join(outDir, `node.${outputExtension}`)], consumer);
                writeFileSync(
                    join(consumer, `runtime-${extension}.log`),
                    runtimeOutput || "DOM-free PNG runtime passed\n",
                );
            }
            const invalid = join(consumer, `invalid-${platform}.${extension}`);
            writeFileSync(invalid, platform === "node" ? invalidNodeConsumer : invalidBrowserConsumer);
            const rejected = ts.getPreEmitDiagnostics(ts.createProgram([invalid], { ...options, noEmit: true }));
            writeFileSync(join(consumer, `invalid-${platform}-${extension}.log`), explain(rejected));
            assert.deepEqual(
                rejected.map((diagnostic) => diagnostic.code).sort((a, b) => a - b),
                platform === "node" ? [2322, 2322, 18048] : [2322, 2322, 2322],
                explain(rejected),
            );
            console.log(
                `Packed ${platform} .${extension}: strict types${platform === "node" ? " and DOM-free PNG runtime" : " and browser defaults"} passed`,
            );
        }
    }
} finally {
    if (keepArtifacts) {
        console.log(`Consumer sources, tarballs and diagnostics retained at ${consumer}`);
    } else {
        rmSync(consumer, { recursive: true, force: true });
    }
}
