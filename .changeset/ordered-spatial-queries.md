---
"@canvas-tile-engine/core": patch
---

Preserve item registration order in spatial-index query results. Draw calls with more than 500 items now retain the same overlap and transparency order as smaller arrays, keeping the painted top item consistent with hit testing. Ordering also remains stable across incremental loads, viewport subsets, repeated item references, and clearing and reloading the index.
