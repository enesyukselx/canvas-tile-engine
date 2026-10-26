---
"@canvas-tile-engine/core": patch
---

Honor `SpriteAnimator.stop()` and `start()` calls from frame callbacks, including the immediate first frame and the last frame of non-looping playback. Stopped or replaced runs no longer schedule frames or fire completion callbacks, and stale animation-frame callbacks cannot interfere with a newer run.
