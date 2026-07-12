---
"@canvas-tile-engine/core": minor
"@canvas-tile-engine/react": minor
---

Remove the dead `config.cursor` option. It has not been applied by any renderer since the modular renderer architecture refactor - the engine never touches `canvas.style.cursor`, so the option silently did nothing while the docs claimed otherwise.

Cursor styling is fully owned by the application: set `engine.canvas.style.cursor` from the event callbacks (`onMouseDown`/`onMouseUp`/`onMouseLeave`/`onHover`). See the new "Managing the Cursor" section in the events docs for the recommended pattern - in particular, always reset the cursor in `onMouseLeave` too, because releasing the mouse button outside the canvas never fires `onMouseUp`.

Passing `cursor` in the config is now a type error; delete the field. Runtime behavior is unchanged (it was already ignored).
