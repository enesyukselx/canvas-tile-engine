# @canvas-tile-engine/renderer-canvas

## 0.2.0

### Minor Changes

- 2068dac: Catch-up release: everything merged since 0.1.1.

  **Features**

  - Sprite rect support in `drawImage`/`drawStaticImage` (draws a sub-rectangle of a spritesheet via `ImageItem.sprite`) (#107)

  **Fixes**

  - Fix double render on init, `lineWidth` state leaking between draws, and static-cache rendering parity with the dynamic path (#98)

  **Compatibility**

  - Requires `@canvas-tile-engine/core` >= 0.4.0 (peer dependency raised)

### Patch Changes

- 2068dac: Publish internal `@canvas-tile-engine/core` dependency as a caret range (`^x.y.z`) instead of an exact pin, so core patch/minor updates flow to consumers without requiring a re-release of dependent packages.
- Updated dependencies [2068dac]
  - @canvas-tile-engine/core@0.4.0
