---
"@canvas-tile-engine/core": patch
"@canvas-tile-engine/renderer-canvas": patch
"@canvas-tile-engine/renderer-webgl": patch
---

Keep browser mouse drags active outside the canvas until release, without duplicate movement or release callbacks on re-entry. Cancel interrupted mouse and touch gestures on lost buttons, window blur, renderer teardown, and touchcancel without generating clicks or leaving stale drag/pinch state. Preserve immediate onMouseLeave notifications, release active presses once, and isolate touch gestures to contacts that started on the canvas.
