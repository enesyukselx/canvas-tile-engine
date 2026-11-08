---
"@canvas-tile-engine/renderer-server": patch
---

Fix loading images from `file://` URLs and report missing files clearly in `engine.images.load()`. `file://` URLs always failed with `Protocol "file:" not supported. Expected "http:"`, although the docs list them as supported, because `@napi-rs/canvas`'s `loadImage` fetches any URL-like string over http. A path to a file that does not exist failed with `Reason: Invalid URL`, which pointed at the URL format rather than at a wrong path or working directory. The loader now resolves paths and `file://` URLs to an absolute path itself, and a missing file fails at once, without the retry, with `Reason: file not found: <absolute path>`, plus `(relative paths resolve against <cwd>)` when the path was relative. This also fixes relative paths starting with `http`, such as `http-icon.png`, which `loadImage` took for URLs. `http(s)` URLs and `data:` URIs load as before.
