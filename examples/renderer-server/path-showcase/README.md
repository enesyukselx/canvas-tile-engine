# Path Showcase (server)

The same scene as `examples/react/path-showcase`, rendered headlessly to a
PNG with `@canvas-tile-engine/renderer-server` — every Path v2 capability
(points form, fills, fill rules, corner rounding, dashes, and the free-form
`commands` form with curves, arcs, subpaths, and holes).

It also probes the scene with `engine.hitTestFirst` before encoding, showing
that hit testing is fully headless: the same registry the browser uses
answers "what is at this point?" on the server.

```bash
pnpm --filter renderer-server-path-showcase start
# -> output/path-showcase.png + hit-test probe results on stdout
```
