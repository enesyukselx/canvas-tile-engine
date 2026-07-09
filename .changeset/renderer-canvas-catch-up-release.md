---
"@canvas-tile-engine/renderer-canvas": minor
---

Catch-up release: everything merged since 0.1.1.

**Features**

- Sprite rect support in `drawImage`/`drawStaticImage` (draws a sub-rectangle of a spritesheet via `ImageItem.sprite`) (#107)

**Fixes**

- Fix double render on init, `lineWidth` state leaking between draws, and static-cache rendering parity with the dynamic path (#98)

**Compatibility**

- Requires `@canvas-tile-engine/core` >= 0.4.0 (peer dependency raised)
