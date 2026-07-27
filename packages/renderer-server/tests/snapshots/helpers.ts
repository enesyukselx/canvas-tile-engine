import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { createCanvas, loadImage, type Image } from "@napi-rs/canvas";

const SNAPSHOT_DIR = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(SNAPSHOT_DIR, "__baselines__");
const DIFF_DIR = join(SNAPSHOT_DIR, "__diffs__");

/** Set UPDATE_SNAPSHOTS=1 to regenerate every committed baseline. */
const UPDATE = process.env.UPDATE_SNAPSHOTS === "1";

/** Per-pixel color distance threshold for pixelmatch (0..1). */
const PIXEL_THRESHOLD = 0.1;
/** Max fraction of pixels allowed to differ — headroom for anti-aliasing noise. */
const MAX_DIFF_RATIO = 0.001;

/**
 * Compare a rendered PNG against the committed baseline for `name`.
 *
 * - Missing baseline: it is created (first run behaves like jest snapshots).
 * - `UPDATE_SNAPSHOTS=1`: the baseline is overwritten.
 * - Mismatch beyond the diff budget: throws, and writes `__diffs__/{name}.png`
 *   highlighting the differing pixels for inspection.
 */
export function expectMatchesBaseline(name: string, actualPng: Buffer): void {
    const baselinePath = join(BASELINE_DIR, `${name}.png`);

    if (UPDATE || !existsSync(baselinePath)) {
        mkdirSync(BASELINE_DIR, { recursive: true });
        writeFileSync(baselinePath, actualPng);
        return;
    }

    const expected = PNG.sync.read(readFileSync(baselinePath));
    const actual = PNG.sync.read(actualPng);

    if (expected.width !== actual.width || expected.height !== actual.height) {
        throw new Error(
            `Snapshot "${name}": size changed ` +
                `(baseline ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}). ` +
                `Run with UPDATE_SNAPSHOTS=1 if this is intended.`,
        );
    }

    const diff = new PNG({ width: expected.width, height: expected.height });
    const differing = pixelmatch(expected.data, actual.data, diff.data, expected.width, expected.height, {
        threshold: PIXEL_THRESHOLD,
    });

    const ratio = differing / (expected.width * expected.height);
    if (ratio > MAX_DIFF_RATIO) {
        mkdirSync(DIFF_DIR, { recursive: true });
        const diffPath = join(DIFF_DIR, `${name}.png`);
        writeFileSync(diffPath, PNG.sync.write(diff));
        throw new Error(
            `Snapshot "${name}": ${differing} pixels differ ` +
                `(${(ratio * 100).toFixed(3)}% > ${(MAX_DIFF_RATIO * 100).toFixed(3)}% budget). ` +
                `Diff written to ${diffPath}. Run with UPDATE_SNAPSHOTS=1 if the change is intended.`,
        );
    }
}

/**
 * Assert two PNG buffers decode to identical pixels. Used for invariants
 * (determinism, static-vs-dynamic equality) that need no committed baseline.
 */
export function expectSamePixels(a: Buffer, b: Buffer, label: string): void {
    const pa = PNG.sync.read(a);
    const pb = PNG.sync.read(b);
    if (pa.width !== pb.width || pa.height !== pb.height) {
        throw new Error(`${label}: sizes differ (${pa.width}x${pa.height} vs ${pb.width}x${pb.height})`);
    }
    if (!pa.data.equals(pb.data)) {
        const diff = new PNG({ width: pa.width, height: pa.height });
        const differing = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { threshold: 0 });
        mkdirSync(DIFF_DIR, { recursive: true });
        const diffPath = join(DIFF_DIR, `${label}.png`);
        writeFileSync(diffPath, PNG.sync.write(diff));
        throw new Error(`${label}: ${differing} pixels differ. Diff written to ${diffPath}.`);
    }
}

/**
 * Assert two PNG buffers are perceptually identical: pixels may differ only
 * by sub-threshold rounding noise. Static caches render shapes onto a
 * transparent intermediate canvas and composite it afterwards, which rounds
 * anti-aliased edge pixels ±1 versus drawing straight onto the background —
 * so static-vs-dynamic equality is near-exact, not bit-exact, by nature.
 */
export function expectNearIdenticalPixels(a: Buffer, b: Buffer, label: string, maxDiffRatio = 0.001): void {
    const pa = PNG.sync.read(a);
    const pb = PNG.sync.read(b);
    if (pa.width !== pb.width || pa.height !== pb.height) {
        throw new Error(`${label}: sizes differ (${pa.width}x${pa.height} vs ${pb.width}x${pb.height})`);
    }
    const diff = new PNG({ width: pa.width, height: pa.height });
    const differing = pixelmatch(pa.data, pb.data, diff.data, pa.width, pa.height, { threshold: PIXEL_THRESHOLD });
    const ratio = differing / (pa.width * pa.height);
    if (ratio > maxDiffRatio) {
        mkdirSync(DIFF_DIR, { recursive: true });
        const diffPath = join(DIFF_DIR, `${label}.png`);
        writeFileSync(diffPath, PNG.sync.write(diff));
        throw new Error(
            `${label}: ${differing} pixels differ perceptually ` +
                `(${(ratio * 100).toFixed(3)}% > ${(maxDiffRatio * 100).toFixed(3)}% budget). ` +
                `Diff written to ${diffPath}.`,
        );
    }
}

export const FIXTURES_DIR = join(SNAPSHOT_DIR, "..", "fixtures");

/**
 * Deterministic 32x32 test image (quadrant colors + diagonal), generated in
 * memory so image scenes need no binary fixture and stay reproducible.
 * Async because @napi-rs/canvas decodes images off-thread: setting `src`
 * returns before the bitmap is ready and drawImage silently paints nothing
 * until decode completes — `loadImage` awaits that.
 */
export function makeTestImage(): Promise<Image> {
    const canvas = createCanvas(32, 32);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(0, 0, 16, 16);
    ctx.fillStyle = "#2563eb";
    ctx.fillRect(16, 0, 16, 16);
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(0, 16, 16, 16);
    ctx.fillStyle = "#f59e0b";
    ctx.fillRect(16, 16, 16, 16);
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(32, 32);
    ctx.stroke();

    return loadImage(canvas.toBuffer("image/png"));
}
