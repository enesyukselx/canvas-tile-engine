---
"@canvas-tile-engine/core": patch
---

Close config validation gaps: size limits (`minWidth`/`maxWidth`/`minHeight`/`maxHeight`) now reject NaN, non-number values, and `Infinity` min limits (Infinity stays valid for max limits); bounds now reject NaN and degenerate infinite pairs like `minX: Infinity`, which previously slipped through and silently blanked the canvas via NaN camera math. `-Infinity`/`Infinity` remain valid for unbounded axes.
