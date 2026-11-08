#!/usr/bin/env node
// `cte-render` bin entry. The command itself lives in ./cli/runCli.ts; this
// file only turns its result, and the preview module's stray failures, into
// one stderr line and an exit code.
import { EXIT_FAILURE, runCli } from "./cli/runCli";

let finished = false;

function finish(code: number): void {
    finished = true;
    process.exitCode = code;
    // Exit once the output has flushed, even if the preview module left a
    // timer, socket or pool open that would otherwise keep Node running.
    let pending = 2;
    const done = () => {
        pending -= 1;
        if (pending === 0) {
            process.exit(code);
        }
    };
    process.stdout.write("", done);
    process.stderr.write("", done);
}

function fail(message: string): void {
    if (finished) {
        return;
    }
    process.stderr.write(`cte-render: ${message}\n`);
    finish(EXIT_FAILURE);
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

process.on("unhandledRejection", (error) => fail(`${messageOf(error)} (from a promise nothing awaited)`));
process.on("uncaughtException", (error) => fail(messageOf(error)));
// The event loop drained before runCli settled: an awaited promise never will.
process.on("beforeExit", () =>
    fail("the preview module never finished loading or drawing: it awaits a promise that never settles"),
);

void runCli(process.argv.slice(2), {
    cwd: process.cwd(),
    stdout: (text) => process.stdout.write(text),
    stderr: (text) => process.stderr.write(text),
}).then((code) => {
    if (!finished) {
        finish(code);
    }
});
