const { spawn } = require("child_process");
const example = process.argv.find(arg => arg.startsWith("--example="))?.split("=")[1];
const onlyExample = process.argv.includes("--only");

if (!example) {
  console.error("Please provide an example to run using --example=<example-name>");
  process.exit(1);
}

if (!onlyExample) {
  spawn("pnpm", ["--filter", "@canvas-tile-engine/core", "dev"], { stdio: "inherit" });
}

spawn("pnpm", ["--filter", example, "dev"], { stdio: "inherit" });