---
"@canvas-tile-engine/core": minor
---

Fix fixed-board centering: `gridToSize` now also returns the board `center` (`(columns-1)/2, (rows-1)/2`) to pass to the engine, and `gridAligned` snaps the initial center to the nearest aligned value instead of always flooring - half-integers for even tile counts (integer ties snap down, so a center computed as `N/2` lands on the true board center `(N-1)/2`), and integers for odd tile counts (previously not snapped at all). Non-integer tile counts are left untouched. This makes a `gridToSize` board of cells `0..N-1` exactly fill the viewport.
