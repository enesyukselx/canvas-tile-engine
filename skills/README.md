# Canvas Tile Engine - Agent Skill

An [Agent Skill](https://code.claude.com/docs/en/skills) that teaches AI
coding agents how to build apps with the `@canvas-tile-engine/*` packages.
The library is not in LLM training data; with this skill installed, an agent
can correctly scaffold and implement tile maps, game boards, minimaps, pixel
editors, spritesheet animations, and server-rendered map images on the first
try.

## Install

### skills CLI (Claude Code, Cursor, Codex, and 60+ other agents)

```bash
npx skills add enesyukselx/canvas-tile-engine
```

### Manual copy

```bash
# Project-level
npx degit enesyukselx/canvas-tile-engine/skills/canvas-tile-engine .claude/skills/canvas-tile-engine

# User-level (all your projects)
npx degit enesyukselx/canvas-tile-engine/skills/canvas-tile-engine ~/.claude/skills/canvas-tile-engine
```

## Use

Just describe what you want - the skill activates automatically:

> Build a pannable strategy-game map with terrain tiles, unit markers, and a
> synced minimap using canvas-tile-engine.

> Add an OG-image endpoint that renders a map snapshot with
> @canvas-tile-engine/renderer-server.

Or invoke it explicitly: `/canvas-tile-engine`.

## Contents

| File                                            | Covers                                                               |
| :---------------------------------------------- | :------------------------------------------------------------------- |
| `canvas-tile-engine/SKILL.md`                   | Mental model, package selection, quick starts, critical rules.       |
| `canvas-tile-engine/references/core-api.md`     | Engine API, full config reference, types, image loader.              |
| `canvas-tile-engine/references/drawing.md`      | All draw primitives, layers, origin, static caching, custom drawing. |
| `canvas-tile-engine/references/events.md`       | Callbacks, coordinate payload, interaction patterns.                 |
| `canvas-tile-engine/references/react.md`        | React bindings: hook, compound components, lifecycle rules.          |
| `canvas-tile-engine/references/react-native.md` | React Native + Skia bindings and platform differences.               |
| `canvas-tile-engine/references/server.md`       | Headless Node.js rendering to PNG/JPEG/WebP.                         |
| `canvas-tile-engine/references/sprites.md`      | Spritesheets and animation.                                          |
| `canvas-tile-engine/references/performance.md`  | Culling, spatial index, renderer choice, WebGL notes.                |
| `canvas-tile-engine/references/recipes.md`      | End-to-end build patterns to adapt.                                  |

## Versioning

Written against `@canvas-tile-engine/core@0.12.x` and the renderer/binding
packages published alongside it. This directory always describes what is on
npm: the upcoming copy lives in `skills-next/`, and the release ("Version
Packages") PR copies it here and updates the version above, so the skill
changes in the same commit that publishes the packages. Features marked
`core >= x.y` need at least that version; check the project's installed
version if it is older.
