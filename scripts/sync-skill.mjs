// Publish the upcoming agent skill: copy skills-next/ over skills/.
//
// Runs inside `changeset:version`, so the "Version Packages" PR carries the
// sync and skills/ (which the skills CLI installs straight from master) changes
// exactly when the packages it describes reach npm. Run it after
// `changeset version`: it stamps the freshly bumped core version into the
// published copy.
import { cpSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const from = new URL("skills-next/canvas-tile-engine/", root);
const to = new URL("skills/canvas-tile-engine/", root);

// Remove first so files deleted from skills-next disappear from skills too.
rmSync(to, { recursive: true, force: true });
cpSync(from, to, { recursive: true });

const { version } = JSON.parse(readFileSync(new URL("packages/core/package.json", root), "utf8"));
const [major, minor] = version.split(".");
const stamp = `@canvas-tile-engine/core@${major}.${minor}.x`;

for (const file of [new URL("SKILL.md", to), new URL("skills/README.md", root)]) {
    const text = readFileSync(file, "utf8");
    writeFileSync(file, text.replace(/@canvas-tile-engine\/core@\d+\.\d+\.x/g, stamp));
}

console.log(`Synced skills-next -> skills (${stamp})`);
