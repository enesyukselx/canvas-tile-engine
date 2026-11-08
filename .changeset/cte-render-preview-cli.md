---
"@canvas-tile-engine/renderer-server": minor
---

Add the `cte-render` command, which renders a preview module (`config`, `center` and `draw`, the same fields as `renderToBuffer`) to a PNG, JPEG or WebP file. `--grid` and `--coords` overlay cell boundaries and cell numbers, `--center`, `--scale` and `--size` move the camera, and the command prints the final camera and the visible range. Run it from any project with `npx -y @canvas-tile-engine/renderer-server@latest map.preview.mjs -o map.png --grid --coords`.

`engines.node` is now `>=18.3.0`, the first Node 18 release with `util.parseArgs`, which the command uses.
