---
"@canvas-tile-engine/renderer-webgl": patch
---

Release GPU textures when their image sources are garbage-collected. The texture cache held every image or canvas ever drawn, so apps that swap spritesheets, stream tiles, or load and drop assets grew GPU memory without bound and kept those sources from being collected even after `ImageLoader.clear()`. Sources are now held weakly and a collected source's texture is deleted; `invalidateTexture` and `destroy()` still free textures immediately.
