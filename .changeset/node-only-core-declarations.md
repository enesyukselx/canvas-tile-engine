---
"@canvas-tile-engine/core": patch
---

Allow strict Node-only TypeScript consumers to import core and the server renderer
without the DOM library or `skipLibCheck`. Resolve browser-specific generic defaults
from the consumer's available globals, preserving exact DOM types in web projects
and native renderer inference elsewhere. Use structural bounds for camera zoom.
