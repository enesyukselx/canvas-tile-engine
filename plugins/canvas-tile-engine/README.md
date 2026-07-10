# Canvas Tile Engine - Agent Skill Plugin

A [Claude Code plugin](https://code.claude.com/docs/en/plugins) containing an
[Agent Skill](https://code.claude.com/docs/en/skills) that teaches AI coding
agents how to build apps with the `@canvas-tile-engine/*` packages. The
library is not in LLM training data; with this skill installed, an agent can
correctly scaffold and implement tile maps, game boards, minimaps, pixel
editors, spritesheet animations, and server-rendered map images on the first
try.

## Install

### Claude Code (recommended)

```
/plugin marketplace add enesyukselx/canvas-tile-engine
/plugin install canvas-tile-engine@canvas-tile-engine
```

Updates ship with the repository: run `/plugin marketplace update
canvas-tile-engine` to pull the latest version.

### Manual copy (Claude Code or any skills-compatible agent)

Copy the skill directory into your project's skills folder:

```bash
npx degit enesyukselx/canvas-tile-engine/plugins/canvas-tile-engine/skills/canvas-tile-engine .claude/skills/canvas-tile-engine
```

Or user-level, for all your projects:

```bash
npx degit enesyukselx/canvas-tile-engine/plugins/canvas-tile-engine/skills/canvas-tile-engine ~/.claude/skills/canvas-tile-engine
```

## Use

Just describe what you want - the skill activates automatically:

> Build a pannable strategy-game map with terrain tiles, unit markers, and a
> synced minimap using canvas-tile-engine.

> Add an OG-image endpoint that renders a map snapshot with
> @canvas-tile-engine/renderer-server.

Or invoke it explicitly (plugin installs are namespaced):

```
/canvas-tile-engine:canvas-tile-engine build me a 32x32 pixel-art editor in React
```

## Contents

| File | Covers |
| :-- | :-- |
| `skills/canvas-tile-engine/SKILL.md` | Mental model, package selection, quick starts, critical rules. |
| `skills/canvas-tile-engine/references/core-api.md` | Engine API, full config reference, types, image loader. |
| `skills/canvas-tile-engine/references/drawing.md` | All draw primitives, layers, origin, static caching, custom drawing. |
| `skills/canvas-tile-engine/references/events.md` | Callbacks, coordinate payload, interaction patterns. |
| `skills/canvas-tile-engine/references/react.md` | React bindings: hook, compound components, lifecycle rules. |
| `skills/canvas-tile-engine/references/react-native.md` | React Native + Skia bindings and platform differences. |
| `skills/canvas-tile-engine/references/server.md` | Headless Node.js rendering to PNG/JPEG/WebP. |
| `skills/canvas-tile-engine/references/sprites.md` | Spritesheets and animation. |
| `skills/canvas-tile-engine/references/performance.md` | Culling, spatial index, renderer choice, WebGL notes. |
| `skills/canvas-tile-engine/references/recipes.md` | End-to-end build patterns to adapt. |

## Versioning

Written against `@canvas-tile-engine/core@0.4.x` and the renderer/binding
packages published alongside it. The plugin manifest omits a `version` field,
so every commit to this repository is picked up as a new version by
`/plugin marketplace update`. If a future major release changes the API,
update the reference files from the docs at
[canvastileengine.dev](https://canvastileengine.dev).
