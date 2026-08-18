---
"@canvas-tile-engine/renderer-canvas": minor
"@canvas-tile-engine/renderer-webgl": minor
---

Add a `crossOrigin` option to `RendererCanvas` and `RendererWebGL`. The DOM image loader hardcoded `crossOrigin="anonymous"`, which turns every image request into a CORS request: tiles and sprites served from a bucket, a CDN, or a third-party tile server without an `Access-Control-Allow-Origin` header failed to load entirely, where without the attribute they would have loaded fine and merely tainted the canvas. The failure also surfaced as `Image failed to load: <src>`, pointing at the URL rather than at the missing header.

The default is unchanged (`"anonymous"`); pass `new RendererCanvas({ crossOrigin: null })` to drop the attribute, or `"use-credentials"` for CORS requests with cookies. Failure messages now name CORS as a possible cause while the attribute is set.

WebGL genuinely needs CORS-clean images — a tainted image cannot be uploaded as a texture — so `crossOrigin: null` is only safe there when every image is same-origin. Relatedly, `RendererWebGL` no longer throws when it meets a tainted image: the upload is attempted once, logged with the CORS cause, and that image is skipped so the rest of the frame still draws.
