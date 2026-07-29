---
"@canvas-tile-engine/react": patch
---

Internal refactor: the engine handle hook, engine context, and all compound draw components now come from the private `@canvas-tile-engine/react-shared` package shared with `@canvas-tile-engine/react-native` (bundled into dist, no new dependency). Public API and behavior are unchanged.
