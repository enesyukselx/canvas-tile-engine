---
"@canvas-tile-engine/core": patch
---

Fix: `fitBounds(bounds, { durationMs: 0 })` no longer loses to an animation that is still running. The instant path writes the camera directly instead of going through the `AnimationController`, so unlike `goCenter`/`goScale` it never cancelled anything — an in-flight move or zoom kept interpolating on the next frame and dragged the view back off target. `fitBounds(a, { durationMs: 500 }); fitBounds(b, { durationMs: 0 });` jumped to `b` and then slid back toward `a`. The instant path now cancels the move and zoom animations before applying.
