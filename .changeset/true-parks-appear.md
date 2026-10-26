---
"@canvas-tile-engine/core": patch
---

Make instant center and zoom commands cancel the corresponding camera animation without stopping a concurrent animation on the other channel. Ignore stale frames and prevent animations interrupted from camera callbacks from rescheduling or firing their completion callback.
