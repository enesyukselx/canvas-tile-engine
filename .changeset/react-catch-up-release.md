---
"@canvas-tile-engine/react": minor
---

Catch-up release: everything merged since 0.3.0.

**Features**

- Declarative `<CanvasTileEngine.Sprite>` compound component for spritesheet animation (frames/fps/loop/playing/onComplete); re-exports `SpriteSheet`, `SpriteAnimator` and sprite types from core (#107)

**Fixes**

- Repaint canvas on draw component unmount and on `DrawFunction` updates (#99)

**Compatibility**

- Requires `@canvas-tile-engine/core` >= 0.4.0 (peer dependency raised)
